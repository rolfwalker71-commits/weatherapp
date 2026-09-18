import { registerPlugin } from '@capacitor/core';
import { isNativeApp } from './platform';
import { fetchAlerts } from './push-client';
import { samePlace } from './storage';
import type { AlertItem, MinutePoint, Place, WeatherBundle } from './types';

/**
 * Live Activities (lock screen + Dynamic Island) in the iOS app:
 * "Regen im Anmarsch" from the 15-minute nowcast and "Unwetter aktiv" from Meteoalarm.
 * The app starts, updates and ends them whenever it loads weather for the user's own place.
 * Native side: ios/App/App/LiveActivityPlugin.swift, model in ios/App/Shared.
 */

type Kind = 'rain' | 'warning';

interface ActivityState {
	headline: string;
	detail: string;
	symbol: string;
	/** Epoch ms. */
	startsAt?: number;
	endsAt?: number;
	series: number[];
	level: number;
}

interface LiveActivityPlugin {
	isAvailable(): Promise<{ available: boolean }>;
	show(options: { kind: Kind; place: string; state: ActivityState }): Promise<void>;
	end(options: { kind: Kind }): Promise<void>;
}

const LiveActivity = registerPlugin<LiveActivityPlugin>('LiveActivity');

const PREFS_KEY = 'weather.liveActivities';
/** mm per 15 minutes that counts as rain. */
const WET_MM = 0.1;
/** Start "Regen im Anmarsch" when rain is at most this far away. */
const RAIN_LEAD_MS = 60 * 60 * 1000;
const STEP_MS = 15 * 60 * 1000;

export interface LiveActivityPrefs {
	rain: boolean;
	warning: boolean;
}

export function loadLiveActivityPrefs(): LiveActivityPrefs {
	try {
		const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<LiveActivityPrefs>;
		return { rain: raw.rain !== false, warning: raw.warning !== false };
	} catch {
		return { rain: true, warning: true };
	}
}

export function saveLiveActivityPrefs(prefs: LiveActivityPrefs): void {
	try {
		localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
	} catch {
		/* private mode */
	}
	if (!prefs.rain) void endActivity('rain');
	if (!prefs.warning) void endActivity('warning');
}

/** The user's own place (GPS, else home/fallback). Browsing other cities never starts activities. */
let ownPlace: Place | null = null;

export function setLiveActivityPlace(place: Place): void {
	ownPlace = place;
}

function endActivity(kind: Kind): Promise<void> {
	return LiveActivity.end({ kind }).catch(() => undefined);
}

function clock(ms: number): string {
	return new Date(ms).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
}

function intensity(mmPerHour: number): string {
	if (mmPerHour < 1) return 'leicht';
	if (mmPerHour < 4) return 'mässig';
	return 'stark';
}

function isSnow(point: MinutePoint): boolean {
	const code = point.code ?? 0;
	return (point.snowfall ?? 0) > 0 || (code >= 71 && code <= 77) || code === 85 || code === 86;
}

/** State for "Regen im Anmarsch", or null when the next hour stays dry. */
export function rainActivityState(minutes: MinutePoint[], now = Date.now()): ActivityState | null {
	const upcoming = minutes
		.filter((point) => point.precipMm != null && new Date(point.time).getTime() + STEP_MS > now)
		.slice(0, 8);
	if (!upcoming.length) return null;
	const at = (point: MinutePoint) => new Date(point.time).getTime();
	const wet = (point: MinutePoint) => (point.precipMm ?? 0) >= WET_MM;

	const first = upcoming.find(wet);
	if (!first || at(first) - now > RAIN_LEAD_MS) return null;

	const rainingNow = at(first) <= now;
	const firstIndex = upcoming.indexOf(first);
	const dryAfter = upcoming.slice(firstIndex).find((point) => !wet(point));
	const wetPoints = upcoming.slice(firstIndex, dryAfter ? upcoming.indexOf(dryAfter) : undefined);
	const totalMm = wetPoints.reduce((sum, point) => sum + (point.precipMm ?? 0), 0);
	const peakPerHour = Math.max(...wetPoints.map((point) => (point.precipMm ?? 0) * 4));
	const snow = wetPoints.some(isSnow);
	const noun = snow ? 'Schnee' : 'Regen';
	const amount = totalMm >= 0.5 ? ` · etwa ${Math.round(totalMm)} mm` : '';

	return {
		headline: rainingNow ? `${noun} jetzt` : `${noun} ab ${clock(at(first))}`,
		detail: `${intensity(peakPerHour)}${amount}${dryAfter ? `, trocken ab ${clock(at(dryAfter))}` : ''}`,
		symbol: snow ? 'cloud.snow.fill' : peakPerHour >= 4 ? 'cloud.heavyrain.fill' : 'cloud.rain.fill',
		startsAt: rainingNow ? undefined : at(first),
		endsAt: dryAfter ? at(dryAfter) : undefined,
		series: upcoming.map((point) => Math.round((point.precipMm ?? 0) * 10) / 10),
		level: 0
	};
}

const SEVERITY_LEVEL: Record<AlertItem['severity'], number> = {
	unknown: 0,
	minor: 1,
	moderate: 2,
	severe: 3,
	extreme: 4
};

/** State for "Unwetter aktiv": the strongest orange/red warning that is in force now. */
export function warningActivityState(alerts: AlertItem[], now = Date.now()): ActivityState | null {
	const active = alerts
		.filter((alert) => SEVERITY_LEVEL[alert.severity] >= 3)
		.filter((alert) => !alert.onset || new Date(alert.onset).getTime() <= now + 60 * 60 * 1000)
		.filter((alert) => !alert.expires || new Date(alert.expires).getTime() > now)
		.sort((a, b) => SEVERITY_LEVEL[b.severity] - SEVERITY_LEVEL[a.severity]);
	const top = active[0];
	if (!top) return null;
	const level = SEVERITY_LEVEL[top.severity];
	const event = top.event.toLowerCase();
	const symbol = /gewitter|thunder/.test(event)
		? 'cloud.bolt.rain.fill'
		: /wind|sturm/.test(event)
			? 'wind'
			: /schnee|snow|glätte|ice/.test(event)
				? 'snowflake'
				: /hitze|heat/.test(event)
					? 'thermometer.sun.fill'
					: /regen|rain|flood|hochwasser/.test(event)
						? 'cloud.heavyrain.fill'
						: 'exclamationmark.triangle.fill';
	return {
		headline: top.event,
		detail: `Stufe ${level}${top.headline ? ` · ${top.headline}` : ''}`,
		symbol,
		endsAt: top.expires ? new Date(top.expires).getTime() : undefined,
		series: [],
		level
	};
}

let syncing = false;

/** Call after each successful weather load; no-op outside the iOS app or for other places. */
export async function syncLiveActivities(bundle: WeatherBundle): Promise<void> {
	if (!isNativeApp() || syncing) return;
	if (!ownPlace || !samePlace(ownPlace, bundle.place)) return;
	syncing = true;
	try {
		const { available } = await LiveActivity.isAvailable().catch(() => ({ available: false }));
		if (!available) return;
		const prefs = loadLiveActivityPrefs();
		const place = bundle.place.name;

		const rain = prefs.rain ? rainActivityState(bundle.minutes) : null;
		if (rain) await LiveActivity.show({ kind: 'rain', place, state: rain }).catch(() => undefined);
		else await endActivity('rain');

		if (prefs.warning) {
			const alerts = await fetchAlerts(bundle.place.latitude, bundle.place.longitude, bundle.place);
			const warning = warningActivityState(alerts);
			if (warning) await LiveActivity.show({ kind: 'warning', place, state: warning }).catch(() => undefined);
			else await endActivity('warning');
		} else {
			await endActivity('warning');
		}
	} finally {
		syncing = false;
	}
}
