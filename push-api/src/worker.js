import { fetchMeteoalarm } from './alerts.js';
import { listRecipients, pruneSendLog, recordSend, wasRecentlySent } from './db.js';
import { sendPush } from './send.js';
import { evaluateNotifications, fetchPlaceWeather } from './weather.js';

const DEFAULT_POLL_MS = 10 * 60 * 1000;
const weatherCache = new Map();

function locationKey(lat, lon) {
	return `${Number(lat).toFixed(2)},${Number(lon).toFixed(2)}`;
}

function hasAnyPref(row) {
	return row.rain_soon || row.warnings || row.frost || row.uv || row.air || row.daily_brief;
}

async function weatherFor(lat, lon, hints = {}) {
	const key = locationKey(lat, lon);
	const cached = weatherCache.get(key);
	if (cached && Date.now() - cached.at < 8 * 60 * 1000) return cached.value;
	const [weather, alerts] = await Promise.all([
		fetchPlaceWeather(lat, lon),
		fetchMeteoalarm(lat, lon, hints).catch(() => ({ alerts: [] }))
	]);
	const value = { weather, alerts: alerts.alerts || [] };
	weatherCache.set(key, { at: Date.now(), value });
	return value;
}

export async function runPushCycle(db) {
	const rows = listRecipients(db);
	const results = { considered: rows.length, sent: 0, skipped: 0, errors: 0 };
	for (const row of rows) {
		if (!hasAnyPref(row)) {
			results.skipped += 1;
			continue;
		}
		if (!Number.isFinite(row.latitude) || !Number.isFinite(row.longitude)) {
			results.skipped += 1;
			continue;
		}
		try {
			const { weather, alerts } = await weatherFor(row.latitude, row.longitude, {
				name: row.place_name || ''
			});
			const notices = evaluateNotifications(weather, row, alerts);
			for (const notice of notices) {
				if (wasRecentlySent(db, row.client_id, notice.category, notice.fingerprint, notice.cooldownHours)) {
					continue;
				}
				const result = await sendPush(db, row, {
					title: notice.title,
					body: notice.body,
					url: '/',
					tag: notice.category
				});
				if (result.ok) {
					recordSend(db, row.client_id, notice.category, notice.fingerprint);
					results.sent += 1;
				} else {
					results.errors += 1;
				}
			}
		} catch (error) {
			console.warn('push cycle', row.client_id, error.message);
			results.errors += 1;
		}
	}
	pruneSendLog(db);
	return results;
}

export function startPushWorker(db, { enabled, hasKeys }) {
	if (!enabled || !hasKeys) {
		console.log('push worker idle (send off or keys missing)');
		return () => {};
	}
	const intervalMs = Number(process.env.PUSH_POLL_MS || DEFAULT_POLL_MS);
	const tick = () => {
		runPushCycle(db)
			.then((summary) => {
				if (summary.sent || summary.errors) {
					console.log('push cycle', summary);
				}
			})
			.catch((error) => console.warn('push cycle failed', error.message));
	};
	const wait = setTimeout(tick, 20_000);
	const timer = setInterval(tick, Math.max(60_000, intervalMs));
	console.log(`push worker every ${Math.round(intervalMs / 1000)}s`);
	return () => {
		clearTimeout(wait);
		clearInterval(timer);
	};
}
