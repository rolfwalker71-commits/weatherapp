/**
 * Moon phase, illumination, main phase instants and rise/set times — computed locally.
 * Main phases follow Meeus, "Astronomical Algorithms" ch. 49 (a few minutes accurate);
 * position, illumination and rise/set follow the low-precision suncalc approach.
 */

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const J1970 = 2440588;
const J2000 = 2451545;
const OBLIQUITY = RAD * 23.4397;
export const SYNODIC = 29.530588853;

export type MainPhase = 'new' | 'first' | 'full' | 'last';

export const MAIN_PHASE_LABEL: Record<MainPhase, string> = {
	new: 'Neumond',
	first: 'Zunehmender Halbmond',
	full: 'Vollmond',
	last: 'Abnehmender Halbmond'
};

export interface MoonInfo {
	/** Days since the last new moon (0 … ~29.5). */
	phase: number;
	/** Position in the cycle: 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter. */
	cycle: number;
	/** Illuminated fraction of the disk, 0 … 1. */
	illumination: number;
	waxing: boolean;
	label: string;
}

export interface PhaseEvent {
	phase: MainPhase;
	date: Date;
}

export interface MoonTimes {
	rise: Date | null;
	set: Date | null;
	alwaysUp: boolean;
	alwaysDown: boolean;
}

/* ── Main phases (Meeus ch. 49) ─────────────────────────────────────────── */

const PHASE_OFFSET: Record<MainPhase, number> = { new: 0, first: 0.25, full: 0.5, last: 0.75 };

function jdeToDate(jde: number): Date {
	// JDE is Terrestrial Time; ΔT ≈ 69 s in the 2020s.
	return new Date((jde - J1970 + 0.5) * DAY_MS - 69_000);
}

function phaseInstant(k: number, phase: MainPhase): Date {
	const T = k / 1236.85;
	const T2 = T * T;
	const T3 = T2 * T;
	const T4 = T3 * T;
	const jde =
		2451550.09766 + 29.530588861 * k + 0.00015437 * T2 - 0.00000015 * T3 + 0.00000000073 * T4;
	const E = 1 - 0.002516 * T - 0.0000074 * T2;
	const M = RAD * (2.5534 + 29.1053567 * k - 0.0000014 * T2 - 0.00000011 * T3);
	const Mp =
		RAD * (201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4);
	const F =
		RAD * (160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4);
	const Om = RAD * (124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3);
	const s = Math.sin;
	let c: number;
	if (phase === 'new' || phase === 'full') {
		const n = phase === 'new';
		c =
			(n ? -0.4072 : -0.40614) * s(Mp) +
			(n ? 0.17241 : 0.17302) * E * s(M) +
			(n ? 0.01608 : 0.01614) * s(2 * Mp) +
			(n ? 0.01039 : 0.01043) * s(2 * F) +
			(n ? 0.00739 : 0.00734) * E * s(Mp - M) -
			(n ? 0.00514 : 0.00515) * E * s(Mp + M) +
			(n ? 0.00208 : 0.00209) * E * E * s(2 * M) -
			0.00111 * s(Mp - 2 * F) -
			0.00057 * s(Mp + 2 * F) +
			0.00056 * E * s(2 * Mp + M) -
			0.00042 * s(3 * Mp) +
			0.00042 * E * s(M + 2 * F) +
			0.00038 * E * s(M - 2 * F) -
			0.00024 * E * s(2 * Mp - M) -
			0.00017 * s(Om);
	} else {
		c =
			-0.62801 * s(Mp) +
			0.17172 * E * s(M) -
			0.01183 * E * s(Mp + M) +
			0.00862 * s(2 * Mp) +
			0.00804 * s(2 * F) +
			0.00454 * E * s(Mp - M) +
			0.00204 * E * E * s(2 * M) -
			0.0018 * s(Mp - 2 * F) -
			0.0007 * s(Mp + 2 * F) -
			0.0004 * s(3 * Mp) -
			0.00034 * E * s(2 * Mp - M) +
			0.00032 * E * s(M + 2 * F) +
			0.00032 * E * s(M - 2 * F) -
			0.00028 * E * E * s(Mp + 2 * M) +
			0.00027 * E * s(2 * Mp + M) -
			0.00017 * s(Om);
		const cos = Math.cos;
		const W =
			0.00306 -
			0.00038 * E * cos(M) +
			0.00026 * cos(Mp) -
			0.00002 * cos(Mp - M) +
			0.00002 * cos(Mp + M) +
			0.00002 * cos(2 * F);
		c += phase === 'first' ? W : -W;
	}
	return jdeToDate(jde + c);
}

/** Lunation index k (new moon of 2000-01-06 = 0) just before `date`. */
function lunationBefore(date: Date): number {
	const k = Math.floor((date.getTime() - Date.UTC(2000, 0, 6, 18, 14)) / (SYNODIC * DAY_MS));
	return phaseInstant(k + 1, 'new').getTime() <= date.getTime() ? k + 1 : k;
}

const PHASE_ORDER: MainPhase[] = ['new', 'first', 'full', 'last'];

/** The next `count` main phases strictly after `from`, in order. */
export function nextMainPhases(from = new Date(), count = 4): PhaseEvent[] {
	const events: PhaseEvent[] = [];
	let k = lunationBefore(from) - 1;
	while (events.length < count) {
		for (const phase of PHASE_ORDER) {
			const date = phaseInstant(k + PHASE_OFFSET[phase], phase);
			if (date.getTime() > from.getTime()) events.push({ phase, date });
			if (events.length >= count) break;
		}
		k++;
	}
	return events;
}

export function nextPhase(phase: MainPhase, from = new Date()): Date {
	let k = lunationBefore(from) - 1;
	for (;;) {
		const date = phaseInstant(k + PHASE_OFFSET[phase], phase);
		if (date.getTime() > from.getTime()) return date;
		k++;
	}
}

/* ── Position & illumination (suncalc) ──────────────────────────────────── */

const toDays = (ms: number) => ms / DAY_MS - 0.5 + J1970 - J2000;

function rightAscension(l: number, b: number) {
	return Math.atan2(
		Math.sin(l) * Math.cos(OBLIQUITY) - Math.tan(b) * Math.sin(OBLIQUITY),
		Math.cos(l)
	);
}

function declination(l: number, b: number) {
	return Math.asin(
		Math.sin(b) * Math.cos(OBLIQUITY) + Math.cos(b) * Math.sin(OBLIQUITY) * Math.sin(l)
	);
}

function sunCoords(d: number) {
	const M = RAD * (357.5291 + 0.98560028 * d);
	const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
	const L = M + C + RAD * 102.9372 + Math.PI;
	return { dec: declination(L, 0), ra: rightAscension(L, 0) };
}

function moonCoords(d: number) {
	const L = RAD * (218.316 + 13.176396 * d);
	const M = RAD * (134.963 + 13.064993 * d);
	const F = RAD * (93.272 + 13.22935 * d);
	const l = L + RAD * 6.289 * Math.sin(M);
	const b = RAD * 5.128 * Math.sin(F);
	return { ra: rightAscension(l, b), dec: declination(l, b), dist: 385001 - 20905 * Math.cos(M) };
}

function moonAltitude(ms: number, lat: number, lon: number): number {
	const d = toDays(ms);
	const c = moonCoords(d);
	const phi = RAD * lat;
	const H = RAD * (280.16 + 360.9856235 * d) + RAD * lon - c.ra;
	const h = Math.asin(
		Math.sin(phi) * Math.sin(c.dec) + Math.cos(phi) * Math.cos(c.dec) * Math.cos(H)
	);
	const hr = Math.max(h, 0);
	return h + 0.0002967 / Math.tan(hr + 0.00312536 / (hr + 0.08901179));
}

function illuminatedFraction(ms: number): number {
	const d = toDays(ms);
	const sun = sunCoords(d);
	const moon = moonCoords(d);
	const sunDist = 149598000;
	const phi = Math.acos(
		Math.sin(sun.dec) * Math.sin(moon.dec) +
			Math.cos(sun.dec) * Math.cos(moon.dec) * Math.cos(sun.ra - moon.ra)
	);
	const inc = Math.atan2(sunDist * Math.sin(phi), moon.dist - sunDist * Math.cos(phi));
	return (1 + Math.cos(inc)) / 2;
}

/* ── Public API ─────────────────────────────────────────────────────────── */

/** Within this many days of a main phase instant, the day carries that phase's name. */
const MAIN_PHASE_WINDOW = 1;

export function moonInfo(date = new Date()): MoonInfo {
	const ms = date.getTime();
	const k = lunationBefore(date);
	const lastNew = phaseInstant(k, 'new').getTime();
	const nextNew = phaseInstant(k + 1, 'new').getTime();
	const cycle = (ms - lastNew) / (nextNew - lastNew);
	const phase = cycle * SYNODIC;
	const illumination = illuminatedFraction(ms);

	let label = '';
	for (const [kk, p] of [
		[k, 'new'],
		[k, 'first'],
		[k, 'full'],
		[k, 'last'],
		[k + 1, 'new']
	] as [number, MainPhase][]) {
		const at = phaseInstant(kk + PHASE_OFFSET[p], p).getTime();
		if (Math.abs(ms - at) < MAIN_PHASE_WINDOW * DAY_MS) {
			label = MAIN_PHASE_LABEL[p];
			break;
		}
	}
	if (!label) {
		if (cycle < 0.25) label = 'Zunehmende Sichel';
		else if (cycle < 0.5) label = 'Zunehmender Mond';
		else if (cycle < 0.75) label = 'Abnehmender Mond';
		else label = 'Abnehmende Sichel';
	}
	return { phase, cycle, illumination, waxing: cycle < 0.5, label };
}

/** Rise and set of the moon within [start, start + 24 h) at the given location. */
export function moonTimes(start: Date, lat: number, lon: number): MoonTimes {
	const t0 = start.getTime();
	const hc = 0.133 * RAD;
	const alt = (hours: number) => moonAltitude(t0 + hours * HOUR_MS, lat, lon) - hc;
	let h0 = alt(0);
	let rise: number | null = null;
	let set: number | null = null;
	let ye = 0;
	for (let i = 1; i <= 24; i += 2) {
		const h1 = alt(i);
		const h2 = alt(i + 1);
		const a = (h0 + h2) / 2 - h1;
		const b = (h2 - h0) / 2;
		const xe = -b / (2 * a);
		ye = (a * xe + b) * xe + h1;
		const d = b * b - 4 * a * h1;
		let roots = 0;
		let x1 = 0;
		let x2 = 0;
		if (d >= 0) {
			const dx = Math.sqrt(d) / (Math.abs(a) * 2);
			x1 = xe - dx;
			x2 = xe + dx;
			if (Math.abs(x1) <= 1) roots++;
			if (Math.abs(x2) <= 1) roots++;
			if (x1 < -1) x1 = x2;
		}
		if (roots === 1) {
			if (h0 < 0) rise = i + x1;
			else set = i + x1;
		} else if (roots === 2) {
			rise = i + (ye < 0 ? x2 : x1);
			set = i + (ye < 0 ? x1 : x2);
		}
		if (rise != null && set != null) break;
		h0 = h2;
	}
	const none = rise == null && set == null;
	return {
		rise: rise != null ? new Date(t0 + rise * HOUR_MS) : null,
		set: set != null ? new Date(t0 + set * HOUR_MS) : null,
		alwaysUp: none && ye > 0,
		alwaysDown: none && ye <= 0
	};
}

/* ── Time zone helpers ──────────────────────────────────────────────────── */

function zoneOffsetMs(ms: number, timeZone: string): number {
	try {
		const parts = new Intl.DateTimeFormat('en-US', {
			timeZone,
			hourCycle: 'h23',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		}).formatToParts(new Date(ms));
		const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
		const wall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
		return wall - Math.floor(ms / 1000) * 1000;
	} catch {
		return -new Date(ms).getTimezoneOffset() * 60_000;
	}
}

/** Midnight of the calendar day `YYYY-MM-DD` in `timeZone`, as an instant. */
export function zonedMidnight(isoDate: string, timeZone: string): Date {
	const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
	const guess = Date.UTC(y, m - 1, d);
	let ms = guess - zoneOffsetMs(guess, timeZone);
	ms = guess - zoneOffsetMs(ms, timeZone);
	return new Date(ms);
}

/** Calendar date `YYYY-MM-DD` of an instant in `timeZone`. */
export function zonedDate(date: Date, timeZone: string): string {
	return new Date(date.getTime() + zoneOffsetMs(date.getTime(), timeZone)).toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
	const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Rise/set during the place's local calendar day, sorted chronologically. */
export function moonDayEvents(
	isoDate: string,
	timeZone: string,
	lat: number,
	lon: number
): { times: MoonTimes; events: { kind: 'rise' | 'set'; date: Date }[] } {
	const times = moonTimes(zonedMidnight(isoDate, timeZone), lat, lon);
	const events: { kind: 'rise' | 'set'; date: Date }[] = [];
	if (times.rise) events.push({ kind: 'rise', date: times.rise });
	if (times.set) events.push({ kind: 'set', date: times.set });
	events.sort((a, b) => a.date.getTime() - b.date.getTime());
	return { times, events };
}
