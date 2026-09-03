import cors from 'cors';
import express from 'express';
import { fetchMeteoalarm } from './alerts.js';
import { fetchAvalanche } from './avalanche.js';
import { deleteSubscription, getPreferences, listSubscriptions, openDb, upsertPreferences, upsertSubscription } from './db.js';
import { canTriggerManualSend, sendPush } from './send.js';
import { ensureWebPushConfigured } from './vapid.js';
import { startPushWorker } from './worker.js';

const PORT = Number(process.env.PORT || 4426);
const HOST = process.env.HOST || '0.0.0.0';
const PUSH_TEST_TOKEN = process.env.PUSH_TEST_TOKEN || '';

const db = openDb();
const vapid = ensureWebPushConfigured(db);
const sendingEnabled = process.env.PUSH_SEND_ENABLED !== 'false' && Boolean(vapid);

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', false);
app.use(cors());
app.use(express.json({ limit: '32kb' }));

app.get('/health', (_req, res) => {
	res.json({ ok: true });
});

app.get('/v1/status', (_req, res) => {
	res.json({
		ok: true,
		configured: true,
		sendingEnabled,
		hasVapid: Boolean(vapid),
		message: sendingEnabled
			? 'Versand eingeschaltet — der Worker prüft Kategorien periodisch.'
			: 'Versand aus. Subscriptions und Prefs werden gespeichert.'
	});
});

app.get('/v1/vapid-public-key', (_req, res) => {
	res.json({ publicKey: vapid?.publicKey || null });
});

app.post('/v1/subscriptions', (req, res) => {
	const endpoint = String(req.body?.endpoint || '');
	const keys = req.body?.keys || {};
	const clientId = String(req.body?.clientId || '').slice(0, 80);
	if (!endpoint.startsWith('https://') || !keys.p256dh || !keys.auth || !clientId) {
		return res.status(400).json({ error: 'Ungültiges Abonnement' });
	}
	upsertSubscription(db, {
		endpoint,
		p256dh: String(keys.p256dh),
		auth: String(keys.auth),
		client_id: clientId,
		user_agent: String(req.body?.userAgent || '').slice(0, 240)
	});
	if (req.body?.preferences || req.body?.place) {
		const previous = getPreferences(db, clientId);
		savePrefs(
			clientId,
			req.body.preferences || {
				rainSoon: previous?.rain_soon,
				warnings: previous?.warnings,
				frost: previous?.frost,
				uv: previous?.uv,
				air: previous?.air,
				dailyBrief: previous?.daily_brief
			},
			req.body.place
		);
	}
	res.json({ ok: true });
});

app.delete('/v1/subscriptions', (req, res) => {
	const endpoint = String(req.body?.endpoint || '');
	const clientId = String(req.body?.clientId || '');
	if (!endpoint) return res.status(400).json({ error: 'endpoint fehlt' });
	deleteSubscription(db, endpoint, clientId || undefined);
	res.json({ ok: true });
});

app.put('/v1/preferences', (req, res) => {
	const clientId = String(req.body?.clientId || '').slice(0, 80);
	if (!clientId) return res.status(400).json({ error: 'clientId fehlt' });
	savePrefs(clientId, req.body?.preferences || {}, req.body?.place);
	res.json({ ok: true });
});

app.get('/v1/alerts', async (req, res) => {
	const lat = Number(req.query.lat);
	const lon = Number(req.query.lon);
	if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
		return res.status(400).json({ error: 'lat/lon erforderlich' });
	}
	try {
		const result = await fetchMeteoalarm(lat, lon, {
			country: String(req.query.country || ''),
			name: String(req.query.name || ''),
			admin1: String(req.query.admin1 || '')
		});
		res.json({ alerts: result.alerts, coverage: result.coverage });
	} catch {
		res.json({ alerts: [], coverage: false, error: 'Warnungen nicht erreichbar' });
	}
});

app.get('/v1/avalanche', async (req, res) => {
	const lat = Number(req.query.lat);
	const lon = Number(req.query.lon);
	if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
		return res.status(400).json({ error: 'lat/lon erforderlich' });
	}
	try {
		res.json(await fetchAvalanche(lat, lon));
	} catch {
		res.json({
			available: false,
			level: null,
			label: 'nicht verfügbar',
			validUntil: null,
			source: 'SLF',
			note: 'Abruf fehlgeschlagen — keine Schätzwerte.'
		});
	}
});

function assertSendReady(res) {
	if (!sendingEnabled) {
		res.status(403).json({
			error: 'Versand deaktiviert',
			hint: vapid
				? 'Setze PUSH_SEND_ENABLED nicht auf false.'
				: 'VAPID-Keys fehlen — der Server erzeugt sie beim Start in SQLite.'
		});
		return false;
	}
	if (!vapid) {
		res.status(503).json({ error: 'VAPID-Keys fehlen' });
		return false;
	}
	return true;
}

async function broadcast(rows, payload) {
	const results = [];
	for (const row of rows) {
		results.push(await sendPush(db, row, payload));
	}
	return results;
}

app.post('/v1/send', async (req, res) => {
	if (!assertSendReady(res)) return;
	if (!canTriggerManualSend(req, PUSH_TEST_TOKEN)) {
		return res.status(403).json({
			error: 'Nur localhost oder X-Push-Test-Token',
			hint: 'Der Worker sendet selbst. Manuell: curl von diesem Host oder Token setzen.'
		});
	}
	const title = String(req.body?.title || 'Wetter');
	const body = String(req.body?.body || 'Neue Wetterinfo');
	const url = String(req.body?.url || '/');
	const results = await broadcast(listSubscriptions(db), { title, body, url });
	res.json({ sent: results.filter((item) => item.ok).length, results });
});

app.post('/v1/send-test', async (req, res) => {
	if (!assertSendReady(res)) return;
	if (!canTriggerManualSend(req, PUSH_TEST_TOKEN)) {
		return res.status(403).json({
			error: 'Nur localhost oder X-Push-Test-Token',
			hint: 'Lokal: curl -X POST http://127.0.0.1:4425/api/push/v1/send-test. Remote: PUSH_TEST_TOKEN setzen.'
		});
	}
	const clientId = req.body?.clientId ? String(req.body.clientId).slice(0, 80) : '';
	const rows = listSubscriptions(db).filter((row) => !clientId || row.client_id === clientId);
	if (!rows.length) {
		return res.status(404).json({ error: 'Kein Abonnement gespeichert' });
	}
	const payload = {
		title: String(req.body?.title || 'Testbenachrichtigung'),
		body: String(req.body?.body || 'Push funktioniert — das ist eine manuelle Probe.'),
		url: String(req.body?.url || '/')
	};
	const results = await broadcast(rows, payload);
	res.json({ sent: results.filter((item) => item.ok).length, results });
});

function savePrefs(clientId, preferences, place) {
	const previous = getPreferences(db, clientId);
	upsertPreferences(db, {
		client_id: clientId,
		rain_soon: preferences.rainSoon ? 1 : 0,
		warnings: preferences.warnings ? 1 : 0,
		frost: preferences.frost ? 1 : 0,
		uv: preferences.uv ? 1 : 0,
		air: preferences.air ? 1 : 0,
		daily_brief: preferences.dailyBrief ? 1 : 0,
		latitude: Number.isFinite(place?.latitude) ? place.latitude : (previous?.latitude ?? null),
		longitude: Number.isFinite(place?.longitude) ? place.longitude : (previous?.longitude ?? null),
		place_name: place?.name ? String(place.name).slice(0, 80) : (previous?.place_name ?? null),
		timezone: place?.timezone ? String(place.timezone).slice(0, 64) : (previous?.timezone ?? null)
	});
}

app.listen(PORT, HOST, () => {
	if (vapid) {
		console.log('Web-Push ist aktiv (VAPID-Schlüssel aus der Datenbank oder Umgebung).');
	} else {
		console.warn('Web-Push nicht bereit — VAPID-Schlüssel fehlen.');
	}
	console.log(`weather push api on ${HOST}:${PORT} (send=${sendingEnabled ? 'on' : 'off'})`);
	startPushWorker(db, {
		enabled: sendingEnabled,
		hasKeys: Boolean(vapid)
	});
});
