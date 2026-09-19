import { formatTemp, formatTime, isNaiveLocalTime } from './format';
import type { Place, WeatherBundle } from './types';

const SNAPSHOT_KEY = 'weather.forecastSnapshots';
const NOTICE_KEY = 'weather.proactivityNotice';
const NOTICE_TTL_MS = 6 * 60 * 60 * 1000;

function placeKey(place: Place): string {
	const lat = Number(place?.latitude);
	const lon = Number(place?.longitude);
	if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
		return `invalid:${place?.name ?? '?'}`;
	}
	return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

const WET_MM = 0.4;
const DRY_PLAN_MM = 0.35;
const NEW_RAIN_MM = 0.8;
const EARLIER_MS = 60 * 60 * 1000;
const TEMP_SWING = 3.5;
const WIND_JUMP = 15;
const GUST_JUMP = 20;
const WIND_MIN = 35;
const GUST_MIN = 45;
const HORIZON_HOURS = 12;
const PRECIP_SUM_HOURS = 6;

export interface ForecastSnapshot {
	dayKey: string;
	precipOnsetIso: string | null;
	precipNext6Mm: number;
	maxWindKmh: number | null;
	maxGustKmh: number | null;
	todayMax: number | null;
	todayMin: number | null;
	todayCode: number | null;
}

export interface ProactivityChange {
	kind: 'rainEarlier' | 'rainNew' | 'rainCancel' | 'windJump' | 'tempSwing';
	fingerprint: string;
	/** Short German line for the hero (without «Wetteränderung:» prefix). */
	detail: string;
	title: string;
	body: string;
}

export interface ProactivityNotice {
	placeKey: string;
	line: string;
	fingerprint: string;
	at: string;
}

function readJson<T>(key: string, fallback: T): T {
	if (typeof localStorage === 'undefined') return fallback;
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return fallback;
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}

function writeJson(key: string, value: unknown): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(key, JSON.stringify(value));
}

function dayKeyInZone(iso: string, timeZone?: string): string {
	// Provider times are already wall-clock of the place.
	if (timeZone && isNaiveLocalTime(iso)) return iso.slice(0, 10);
	try {
		return new Intl.DateTimeFormat('en-CA', {
			timeZone: timeZone || undefined,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		}).format(new Date(iso));
	} catch {
		return iso.slice(0, 10);
	}
}

function hourLabel(iso: string | null, timeZone?: string): string {
	if (!iso) return '';
	return formatTime(iso, timeZone);
}

function isWet(mm: number | null | undefined): boolean {
	return mm != null && mm >= WET_MM;
}

/** Build a comparable plan snapshot from provider fields only. */
export function buildForecastSnapshot(bundle: WeatherBundle): ForecastSnapshot {
	const tz = bundle.timezone;
	const hours = bundle.hours.slice(0, HORIZON_HOURS);
	const precipHours = bundle.hours.slice(0, PRECIP_SUM_HOURS);
	const onset =
		hours.find((hour) => isWet(hour.precipMm)) ??
		bundle.minutes.find((m) => m.precipMm != null && m.precipMm >= 0.1) ??
		null;
	const precipNext6Mm = precipHours.reduce((sum, hour) => sum + (hour.precipMm ?? 0), 0);
	let maxWind: number | null = null;
	let maxGust: number | null = null;
	for (const hour of hours) {
		if (Number.isFinite(hour.wind)) {
			maxWind = maxWind == null ? hour.wind : Math.max(maxWind, hour.wind);
		}
		if (hour.gusts != null && Number.isFinite(hour.gusts)) {
			maxGust = maxGust == null ? hour.gusts : Math.max(maxGust, hour.gusts);
		}
	}
	const today = bundle.days[0];
	return {
		dayKey: dayKeyInZone(bundle.current.time || bundle.fetchedAt, tz),
		precipOnsetIso: onset?.time ?? null,
		precipNext6Mm,
		maxWindKmh: maxWind,
		maxGustKmh: maxGust,
		todayMax: today != null && Number.isFinite(today.tMax) ? today.tMax : null,
		todayMin: today != null && Number.isFinite(today.tMin) ? today.tMin : null,
		todayCode: today?.code ?? bundle.current.weather_code ?? null
	};
}

function wasDryPlan(snap: ForecastSnapshot): boolean {
	return !snap.precipOnsetIso && snap.precipNext6Mm < DRY_PLAN_MM;
}

function isWetPlan(snap: ForecastSnapshot): boolean {
	return Boolean(snap.precipOnsetIso) || snap.precipNext6Mm >= NEW_RAIN_MM;
}

/** Diff previous vs current plan. Returns the highest-priority meaningful change, or null. */
export function diffForecastSnapshots(
	previous: ForecastSnapshot | null,
	current: ForecastSnapshot,
	timeZone?: string
): ProactivityChange | null {
	if (!previous) return null;
	if (previous.dayKey !== current.dayKey) return null;

	const changes: ProactivityChange[] = [];

	if (isWetPlan(previous) && wasDryPlan(current)) {
		changes.push({
			kind: 'rainCancel',
			fingerprint: `rain-cancel-${current.dayKey}`,
			detail: 'Regen fällt aus',
			title: 'Wetteränderung',
			body: 'Regen fällt aus — die Prognose ist wieder trocken.'
		});
	} else if (wasDryPlan(previous) && isWetPlan(current) && current.precipOnsetIso) {
		const when = hourLabel(current.precipOnsetIso, timeZone);
		changes.push({
			kind: 'rainNew',
			fingerprint: `rain-new-${current.precipOnsetIso.slice(0, 13)}`,
			detail: when ? `Neu: Regen ab ${when}` : 'Neu: Regen in Sicht',
			title: 'Wetteränderung',
			body: when ? `Neu: Regen ab ${when}.` : 'Neu: Regen in der Prognose.'
		});
	} else if (
		previous.precipOnsetIso &&
		current.precipOnsetIso &&
		new Date(current.precipOnsetIso).getTime() <=
			new Date(previous.precipOnsetIso).getTime() - EARLIER_MS
	) {
		const when = hourLabel(current.precipOnsetIso, timeZone);
		changes.push({
			kind: 'rainEarlier',
			fingerprint: `rain-earlier-${current.precipOnsetIso.slice(0, 13)}`,
			detail: when ? `Regen ab ${when} (früher als gedacht)` : 'Regen kommt früher',
			title: 'Wetteränderung',
			body: when
				? `Regen ab ${when} — früher als gedacht.`
				: 'Regen kommt früher als zuvor erwartet.'
		});
	}

	const gustPrev = previous.maxGustKmh;
	const gustNow = current.maxGustKmh;
	const windPrev = previous.maxWindKmh;
	const windNow = current.maxWindKmh;
	const gustJump =
		gustPrev != null &&
		gustNow != null &&
		gustNow - gustPrev >= GUST_JUMP &&
		gustNow >= GUST_MIN;
	const windJump =
		windPrev != null &&
		windNow != null &&
		windNow - windPrev >= WIND_JUMP &&
		windNow >= WIND_MIN;
	if (gustJump || windJump) {
		const peak = gustJump && gustNow != null ? Math.round(gustNow) : Math.round(windNow!);
		const label = gustJump ? `Böen bis ${peak} km/h` : `Wind bis ${peak} km/h`;
		changes.push({
			kind: 'windJump',
			fingerprint: `wind-${current.dayKey}-${peak}`,
			detail: `Stärkerer Wind: ${label}`,
			title: 'Wetteränderung',
			body: `Stärkerer Wind in der Prognose: ${label}.`
		});
	}

	if (
		previous.todayMax != null &&
		current.todayMax != null &&
		Math.abs(current.todayMax - previous.todayMax) >= TEMP_SWING
	) {
		const dir = current.todayMax > previous.todayMax ? 'höher' : 'tiefer';
		changes.push({
			kind: 'tempSwing',
			fingerprint: `tmax-${current.dayKey}-${Math.round(current.todayMax)}`,
			detail: `Höchsttemperatur neu ${formatTemp(current.todayMax)} (${dir} als gedacht)`,
			title: 'Wetteränderung',
			body: `Höchsttemperatur neu ${formatTemp(current.todayMax)} (vorher ${formatTemp(previous.todayMax)}).`
		});
	} else if (
		previous.todayMin != null &&
		current.todayMin != null &&
		Math.abs(current.todayMin - previous.todayMin) >= TEMP_SWING
	) {
		const dir = current.todayMin > previous.todayMin ? 'höher' : 'tiefer';
		changes.push({
			kind: 'tempSwing',
			fingerprint: `tmin-${current.dayKey}-${Math.round(current.todayMin)}`,
			detail: `Tiefsttemperatur neu ${formatTemp(current.todayMin)} (${dir} als gedacht)`,
			title: 'Wetteränderung',
			body: `Tiefsttemperatur neu ${formatTemp(current.todayMin)} (vorher ${formatTemp(previous.todayMin)}).`
		});
	}

	const priority: ProactivityChange['kind'][] = [
		'rainCancel',
		'rainEarlier',
		'rainNew',
		'windJump',
		'tempSwing'
	];
	for (const kind of priority) {
		const hit = changes.find((item) => item.kind === kind);
		if (hit) return hit;
	}
	return null;
}

export function heroProactivityLine(change: ProactivityChange | null): string | null {
	if (!change) return null;
	return `Wetteränderung: ${change.detail}`;
}

export function loadForecastSnapshot(place: Place): ForecastSnapshot | null {
	const map = readJson<Record<string, ForecastSnapshot>>(SNAPSHOT_KEY, {});
	return map[placeKey(place)] ?? null;
}

export function saveForecastSnapshot(place: Place, snapshot: ForecastSnapshot): void {
	const map = readJson<Record<string, ForecastSnapshot>>(SNAPSHOT_KEY, {});
	map[placeKey(place)] = snapshot;
	const keys = Object.keys(map);
	if (keys.length > 12) {
		for (const key of keys.slice(0, keys.length - 12)) delete map[key];
	}
	writeJson(SNAPSHOT_KEY, map);
}

export function loadProactivityNotice(place: Place): ProactivityNotice | null {
	const notice = readJson<ProactivityNotice | null>(NOTICE_KEY, null);
	if (!notice) return null;
	if (notice.placeKey !== placeKey(place)) return null;
	const age = Date.now() - new Date(notice.at).getTime();
	if (!Number.isFinite(age) || age > NOTICE_TTL_MS) return null;
	return notice;
}

export function saveProactivityNotice(place: Place, change: ProactivityChange): ProactivityNotice {
	const notice: ProactivityNotice = {
		placeKey: placeKey(place),
		line: heroProactivityLine(change)!,
		fingerprint: change.fingerprint,
		at: new Date().toISOString()
	};
	writeJson(NOTICE_KEY, notice);
	return notice;
}

export function clearProactivityNotice(): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.removeItem(NOTICE_KEY);
}

/** Compare new bundle to stored plan; persist snapshot; return hero notice if any. */
export function applyProactivity(place: Place, bundle: WeatherBundle): ProactivityNotice | null {
	const previous = loadForecastSnapshot(place);
	const current = buildForecastSnapshot(bundle);
	const change = diffForecastSnapshots(previous, current, bundle.timezone);
	saveForecastSnapshot(place, current);
	if (change) {
		return saveProactivityNotice(place, change);
	}
	return loadProactivityNotice(place);
}
