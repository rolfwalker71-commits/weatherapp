import { fetchMeteoalarm } from './alerts.js';
import {
	getForecastSnapshot,
	listApnsRecipients,
	listRecipients,
	pruneForecastSnapshots,
	pruneSendLog,
	recordSend,
	saveForecastSnapshot,
	wasRecentlySent
} from './db.js';
import { buildForecastSnapshot, diffForecastSnapshots } from './proactivity.js';
import { sendPush } from './send.js';
import { appendForecastChangeNotice, evaluateNotifications, fetchPlaceWeather } from './weather.js';

const DEFAULT_POLL_MS = 10 * 60 * 1000;
const weatherCache = new Map();

function locationKey(lat, lon) {
	return `${Number(lat).toFixed(2)},${Number(lon).toFixed(2)}`;
}

function hasAnyPref(row) {
	return (
		row.rain_soon ||
		row.warnings ||
		row.frost ||
		row.uv ||
		row.air ||
		row.daily_brief ||
		row.forecast_change
	);
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

/**
 * One entry per client: preferences plus every device it can be reached on (browsers, iPhones).
 * Rules, snapshots and cooldowns are per client, so a user with web and iOS gets each notice
 * on both and the forecast-change diff is not consumed by the first device.
 */
function recipientsByClient(db) {
	const groups = new Map();
	for (const row of [...listRecipients(db), ...listApnsRecipients(db)]) {
		const group = groups.get(row.client_id);
		if (group) group.channels.push(row);
		else groups.set(row.client_id, { row, channels: [row] });
	}
	return [...groups.values()];
}

export async function runPushCycle(db) {
	const clients = recipientsByClient(db);
	const results = { considered: clients.length, sent: 0, skipped: 0, errors: 0 };
	for (const { row, channels } of clients) {
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
			const loc = locationKey(row.latitude, row.longitude);
			const nextSnap = buildForecastSnapshot(weather, alerts);
			if (row.forecast_change) {
				const prevSnap = getForecastSnapshot(db, row.client_id, loc);
				const change = diffForecastSnapshots(prevSnap, nextSnap, weather.timezone, {
					includeWarnings: !row.warnings
				});
				appendForecastChangeNotice(notices, change);
			}
			saveForecastSnapshot(db, row.client_id, loc, nextSnap);
			for (const notice of notices) {
				if (wasRecentlySent(db, row.client_id, notice.category, notice.fingerprint, notice.cooldownHours)) {
					continue;
				}
				const payload = {
					title: notice.title,
					body: notice.body,
					url: notice.url || '/#jetzt',
					tag: notice.category
				};
				let delivered = false;
				for (const channel of channels) {
					const result = await sendPush(db, channel, payload);
					if (result.ok) {
						delivered = true;
						results.sent += 1;
					} else {
						results.errors += 1;
					}
				}
				if (delivered) recordSend(db, row.client_id, notice.category, notice.fingerprint);
			}
		} catch (error) {
			console.warn('push cycle', row.client_id, error.message);
			results.errors += 1;
		}
	}
	pruneSendLog(db);
	pruneForecastSnapshots(db);
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
