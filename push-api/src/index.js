import cors from 'cors';
import express from 'express';
import webpush from 'web-push';
import { fetchMeteoalarm } from './alerts.js';
import { fetchAvalanche } from './avalanche.js';
import { deleteSubscription, listSubscriptions, openDb, upsertPreferences, upsertSubscription } from './db.js';

const PORT = Number(process.env.PORT || 4426);
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:weather@localhost';
const PUSH_SEND_ENABLED = process.env.PUSH_SEND_ENABLED === 'true';

const db = openDb();
const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '32kb' }));

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
	webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

app.get('/health', (_req, res) => {
	res.json({ ok: true });
});

app.get('/v1/status', (_req, res) => {
	res.json({
		ok: true,
		configured: true,
		sendingEnabled: PUSH_SEND_ENABLED,
		hasVapid: Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY),
		message: PUSH_SEND_ENABLED
			? 'Versand eingeschaltet'
			: 'Versand aus. Subscriptions und Prefs werden gespeichert.'
	});
});

app.get('/v1/vapid-public-key', (_req, res) => {
	res.json({ publicKey: VAPID_PUBLIC_KEY || null });
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
	if (req.body?.preferences) {
		savePrefs(clientId, req.body.preferences, req.body.place);
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
		const result = await fetchMeteoalarm(lat, lon);
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

app.post('/v1/send', async (req, res) => {
	if (!PUSH_SEND_ENABLED) {
		return res.status(403).json({
			error: 'Versand deaktiviert',
			hint: 'Setze PUSH_SEND_ENABLED=true und gültige VAPID-Keys, dann diesen Endpunkt erneut aufrufen.'
		});
	}
	if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
		return res.status(503).json({ error: 'VAPID-Keys fehlen' });
	}
	const title = String(req.body?.title || 'Wetter');
	const body = String(req.body?.body || 'Neue Wetterinfo');
	const url = String(req.body?.url || '/');
	const rows = listSubscriptions(db);
	const results = [];
	for (const row of rows) {
		try {
			await webpush.sendNotification(
				{ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
				JSON.stringify({ title, body, url })
			);
			results.push({ endpoint: row.endpoint, ok: true });
		} catch (error) {
			if (error?.statusCode === 404 || error?.statusCode === 410) {
				deleteSubscription(db, row.endpoint);
			}
			results.push({ endpoint: row.endpoint, ok: false, status: error?.statusCode || 0 });
		}
	}
	res.json({ sent: results.filter((item) => item.ok).length, results });
});

function savePrefs(clientId, preferences, place) {
	upsertPreferences(db, {
		client_id: clientId,
		rain_soon: preferences.rainSoon ? 1 : 0,
		warnings: preferences.warnings ? 1 : 0,
		frost: preferences.frost ? 1 : 0,
		uv: preferences.uv ? 1 : 0,
		air: preferences.air ? 1 : 0,
		daily_brief: preferences.dailyBrief ? 1 : 0,
		latitude: Number.isFinite(place?.latitude) ? place.latitude : null,
		longitude: Number.isFinite(place?.longitude) ? place.longitude : null,
		place_name: place?.name ? String(place.name).slice(0, 80) : null,
		timezone: place?.timezone ? String(place.timezone).slice(0, 64) : null
	});
}

app.listen(PORT, '0.0.0.0', () => {
	console.log(`weather push api on ${PORT} (send=${PUSH_SEND_ENABLED ? 'on' : 'off'})`);
});
