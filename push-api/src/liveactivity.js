import {
	deleteLiveActivityTokenValue,
	getLiveActivityState,
	getPreferences,
	listLiveActivityClients,
	pruneLiveActivityTokens,
	setLiveActivityState
} from './db.js';
import { sendLiveActivity } from './send.js';

/**
 * Live Activities driven from the server (ActivityKit pushes): «Regen im Anmarsch» and «Unwetter aktiv».
 *
 * The rules are a port of the app's `LiveActivitySync.rainActivityState` / `warningActivityState`
 * (iosweather/Platform/LiveActivitySync.swift), so a pushed activity reads exactly like one the app starts itself.
 * `content-state` keys and types follow `WeatherActivityAttributes.ContentState`: dates are epoch SECONDS.
 */

const STEP_MS = 15 * 60 * 1000;
const RAIN_LEAD_MS = 60 * 60 * 1000;
const WET_MM = 0.1;
const STALE_MS = 30 * 60 * 1000;
const END_LINGER_MS = 5 * 60 * 1000;
/** Same content is re-sent at this age so iOS does not grey the activity out at its stale date. */
const REFRESH_MS = 20 * 60 * 1000;
const KINDS = ['rain', 'warning'];

// --- time helpers (provider times are naive local strings) -------------------------------------------------

function zoneOffsetMs(timeZone, atMs) {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	}).formatToParts(new Date(atMs));
	const value = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
	return Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute, value.second) - Math.floor(atMs / 1000) * 1000;
}

/** "2026-10-02T14:15" in `timeZone` → epoch ms. */
export function localToEpoch(naive, timeZone) {
	const asUtc = Date.parse(`${naive}Z`);
	if (!Number.isFinite(asUtc)) return NaN;
	if (!timeZone) return asUtc;
	let guess = asUtc - zoneOffsetMs(timeZone, asUtc);
	guess = asUtc - zoneOffsetMs(timeZone, guess);
	return guess;
}

const hhmm = (naive) => String(naive).slice(11, 16);
const seconds = (ms) => Math.floor(ms / 1000);

// --- states (ports of the app's rules) ---------------------------------------------------------------------

function intensity(mmPerHour) {
	if (mmPerHour < 1) return 'leicht';
	if (mmPerHour < 4) return 'mässig';
	return 'stark';
}

/** State for «Regen im Anmarsch», or null when the next hour stays dry. */
export function rainActivityState(weather, nowMs = Date.now()) {
	const zone = weather.timezone;
	const upcoming = (weather.minutesAll || [])
		.map((slot) => ({ slot, at: localToEpoch(slot.time, zone) }))
		.filter(({ slot, at }) => slot.precipMm != null && Number.isFinite(at) && at + STEP_MS > nowMs)
		.slice(0, 8);
	if (!upcoming.length) return null;
	const wet = (item) => (item.slot.precipMm ?? 0) >= WET_MM;
	const firstIndex = upcoming.findIndex(wet);
	if (firstIndex < 0 || upcoming[firstIndex].at - nowMs > RAIN_LEAD_MS) return null;

	const first = upcoming[firstIndex];
	const rainingNow = first.at <= nowMs;
	const dryIndex = upcoming.findIndex((item, index) => index >= firstIndex && !wet(item));
	const dryAfter = dryIndex >= 0 ? upcoming[dryIndex] : null;
	const wetPoints = upcoming.slice(firstIndex, dryIndex >= 0 ? dryIndex : undefined);
	const totalMm = wetPoints.reduce((sum, item) => sum + (item.slot.precipMm ?? 0), 0);
	const peakPerHour = Math.max(...wetPoints.map((item) => (item.slot.precipMm ?? 0) * 4));
	const snow = (weather.upcoming || []).slice(0, 2).some((hour) => (hour.snowfall ?? 0) >= 0.1);
	const noun = snow ? 'Schnee' : 'Regen';
	const amount = totalMm >= 0.5 ? ` · etwa ${Math.round(totalMm)} mm` : '';
	const dry = dryAfter ? `, trocken ab ${hhmm(dryAfter.slot.time)}` : '';

	return {
		headline: rainingNow ? `${noun} jetzt` : `${noun} ab ${hhmm(first.slot.time)}`,
		detail: `${intensity(peakPerHour)}${amount}${dry}`,
		symbol: snow ? 'cloud.snow.fill' : peakPerHour >= 4 ? 'cloud.heavyrain.fill' : 'cloud.rain.fill',
		...(rainingNow ? {} : { startsAt: seconds(first.at) }),
		...(dryAfter ? { endsAt: seconds(dryAfter.at) } : {}),
		series: upcoming.map((item) => Math.round((item.slot.precipMm ?? 0) * 10) / 10),
		level: 0
	};
}

const SEVERITY_LEVEL = { unknown: 0, minor: 1, moderate: 2, severe: 3, extreme: 4 };

function warningSymbol(event) {
	const text = String(event || '').toLowerCase();
	if (/gewitter|thunder/.test(text)) return 'cloud.bolt.rain.fill';
	if (/wind|sturm/.test(text)) return 'wind';
	if (/schnee|snow|glätte|ice/.test(text)) return 'snowflake';
	if (/hitze|heat/.test(text)) return 'thermometer.sun.fill';
	if (/regen|rain|flood|hochwasser/.test(text)) return 'cloud.heavyrain.fill';
	return 'exclamationmark.triangle.fill';
}

/** State for «Unwetter aktiv»: the strongest orange/red warning in force now or within the hour. */
export function warningActivityState(alerts, nowMs = Date.now()) {
	let top = null;
	for (const alert of alerts || []) {
		const level = SEVERITY_LEVEL[alert?.severity] ?? 0;
		if (level < 3) continue;
		if (alert.onset && !(Date.parse(alert.onset) <= nowMs + 60 * 60 * 1000)) continue;
		if (alert.expires && !(Date.parse(alert.expires) > nowMs)) continue;
		if (!top || level > top.level) top = { alert, level };
	}
	if (!top) return null;
	const { alert, level } = top;
	const expires = alert.expires ? Date.parse(alert.expires) : NaN;
	return {
		headline: alert.event || 'Unwetter',
		detail: `Stufe ${level}${alert.headline ? ` · ${alert.headline}` : ''}`,
		symbol: warningSymbol(alert.event),
		...(Number.isFinite(expires) ? { endsAt: seconds(expires) } : {}),
		series: [],
		level
	};
}

// --- ActivityKit payloads ----------------------------------------------------------------------------------

/** What the user sees (headline, symbol, level): a change here is worth an immediate push. */
function contentKey(state) {
	return JSON.stringify([state.headline, state.symbol, state.level]);
}

/** Everything in the content state: the same hash means a push would change nothing on screen. */
function contentHash(state) {
	return `${contentKey(state)}\n${JSON.stringify([state.detail, state.startsAt ?? null, state.endsAt ?? null, state.series])}`;
}

export function startPayload(kind, placeName, state, nowMs) {
	return {
		timestamp: seconds(nowMs),
		event: 'start',
		'attributes-type': 'WeatherActivityAttributes',
		attributes: { kind, place: placeName },
		'content-state': state,
		'stale-date': seconds(nowMs + STALE_MS),
		alert: {
			title: kind === 'rain' ? 'Regen im Anmarsch' : 'Unwetter aktiv',
			body: `${state.headline} in ${placeName}`
		}
	};
}

export function updatePayload(state, nowMs) {
	return { timestamp: seconds(nowMs), event: 'update', 'content-state': state, 'stale-date': seconds(nowMs + STALE_MS) };
}

export function endPayload(kind, nowMs) {
	return {
		timestamp: seconds(nowMs),
		event: 'end',
		'dismissal-date': seconds(nowMs + END_LINGER_MS),
		'content-state': {
			headline: kind === 'rain' ? 'Regen vorbei' : 'Warnung beendet',
			detail: '',
			symbol: kind === 'rain' ? 'cloud.sun.fill' : 'checkmark.circle.fill',
			series: [],
			level: 0
		}
	};
}

// --- cycle -------------------------------------------------------------------------------------------------

function minutesSince(sqliteUtc, nowMs) {
	if (!sqliteUtc) return Infinity;
	const at = Date.parse(`${sqliteUtc.replace(' ', 'T')}Z`);
	return Number.isFinite(at) ? (nowMs - at) / 60000 : Infinity;
}

async function driveKind(db, { clientId, kind, rows, placeName, desired, nowMs, send }) {
	const state = getLiveActivityState(db, clientId, kind);
	const update = rows.find((row) => row.token_kind === 'update' && row.kind === kind);
	const start = rows.find((row) => row.token_kind === 'start' && row.kind === kind);
	const summary = { clientId, kind, action: 'none' };

	if (desired) {
		const hash = contentHash(desired);
		if (update) {
			const unchanged = state.phase === 'active' && state.last_hash === hash;
			if (unchanged && minutesSince(state.last_push_at, nowMs) * 60000 < REFRESH_MS) return summary;
			// Routine refresh (the nowcast moved on by a slot) = priority 5; a new headline, symbol or level = 10.
			const previousKey = state.last_hash ? state.last_hash.split('\n')[0] : null;
			const priority = previousKey && previousKey !== contentKey(desired) ? 10 : 5;
			const result = await send(db, update, updatePayload(desired, nowMs), { priority });
			summary.action = result.ok ? 'update' : 'update-failed';
			if (result.ok) setLiveActivityState(db, clientId, kind, { phase: 'active', hash });
			return summary;
		}
		// Started once per episode: after a start the app registers the activity token itself; a dismissed
		// activity stays dismissed until the weather has been calm once (phase goes back to idle).
		if (start && state.phase !== 'active') {
			const result = await send(db, start, startPayload(kind, placeName, desired, nowMs), { priority: 10 });
			summary.action = result.ok ? 'start' : 'start-failed';
			if (result.ok) setLiveActivityState(db, clientId, kind, { phase: 'active', hash, started: true });
		}
		return summary;
	}

	if (state.phase === 'active') {
		if (update) {
			const result = await send(db, update, endPayload(kind, nowMs), { priority: 10 });
			summary.action = result.ok ? 'end' : 'end-failed';
			// The activity is over either way; the app also unregisters its token when it ends.
			if (result.ok) deleteLiveActivityTokenValue(db, update.token);
		}
		setLiveActivityState(db, clientId, kind, { phase: 'idle', hash: null });
	}
	return summary;
}

/**
 * One pass over every client that registered ActivityKit tokens. `weatherFor(lat, lon, hints)` is the worker's cached
 * forecast + Meteoalarm lookup. `send` is injectable for tests.
 */
export async function runLiveActivityCycle(db, { weatherFor, send = sendLiveActivity, nowMs = Date.now() } = {}) {
	const results = { clients: 0, actions: [] };
	for (const { clientId, rows } of listLiveActivityClients(db)) {
		const prefs = getPreferences(db, clientId);
		const located = rows.find((row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude));
		const place = located
			? { latitude: located.latitude, longitude: located.longitude, name: located.place_name }
			: Number.isFinite(prefs?.latitude) && Number.isFinite(prefs?.longitude)
				? { latitude: prefs.latitude, longitude: prefs.longitude, name: prefs.place_name }
				: null;
		if (!place) continue;
		const kinds = KINDS.filter((kind) => rows.some((row) => row.kind === kind));
		if (!kinds.length) continue;
		results.clients += 1;
		try {
			const { weather, alerts } = await weatherFor(place.latitude, place.longitude, { name: place.name || '' });
			for (const kind of kinds) {
				const desired = kind === 'rain' ? rainActivityState(weather, nowMs) : warningActivityState(alerts, nowMs);
				const outcome = await driveKind(db, {
					clientId,
					kind,
					rows,
					placeName: place.name || 'Mein Standort',
					desired,
					nowMs,
					send
				});
				if (outcome.action !== 'none') results.actions.push(outcome);
			}
		} catch (error) {
			console.warn('live activity cycle', clientId, error.message);
		}
	}
	pruneLiveActivityTokens(db);
	return results;
}
