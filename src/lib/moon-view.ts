import { formatTime } from './format';
import {
	addDays,
	MAIN_PHASE_LABEL,
	moonDayEvents,
	moonInfo,
	nextMainPhases,
	nextPhase,
	zonedDate,
	zonedMidnight,
	type MainPhase,
	type MoonInfo
} from './moon';
import type { WeatherBundle } from './types';

export interface MoonEventView {
	kind: 'rise' | 'set';
	label: string;
	time: string;
}

export interface MoonDayView {
	events: MoonEventView[];
	/** Shown when the moon neither rises nor sets that day (or only one of the two). */
	note: string | null;
}

export interface MoonView {
	info: MoonInfo;
	southern: boolean;
	timeZone: string;
	today: MoonDayView;
	nextFull: string;
	nextNew: string;
}

export interface MoonCalendarDay {
	date: string;
	day: number;
	weekday: string;
	cycle: number;
	illumination: number;
	phase: MainPhase | null;
	isToday: boolean;
}

function placeZone(bundle: WeatherBundle): string {
	return bundle.timezone || bundle.place.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function dateFmt(timeZone: string, opts: Intl.DateTimeFormatOptions) {
	try {
		return new Intl.DateTimeFormat('de-CH', { ...opts, timeZone });
	} catch {
		return new Intl.DateTimeFormat('de-CH', opts);
	}
}

/** e.g. «Sa., 26. Sept.» in the place's zone. */
export function formatMoonDate(date: Date, timeZone: string): string {
	return dateFmt(timeZone, { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
}

export function formatMoonDateTime(date: Date, timeZone: string): string {
	return `${formatMoonDate(date, timeZone)} · ${formatTime(date.toISOString(), timeZone)}`;
}

export function moonDay(isoDate: string, bundle: WeatherBundle): MoonDayView {
	const tz = placeZone(bundle);
	const { latitude, longitude } = bundle.place;
	const { times, events } = moonDayEvents(isoDate, tz, latitude, longitude);
	const view = events.map((event) => ({
		kind: event.kind,
		label: event.kind === 'rise' ? 'Aufgang' : 'Untergang',
		time: formatTime(event.date.toISOString(), tz)
	}));
	let note: string | null = null;
	if (times.alwaysUp) note = 'Den ganzen Tag über dem Horizont';
	else if (times.alwaysDown) note = 'Den ganzen Tag unter dem Horizont';
	else if (!times.rise) note = 'Kein Mondaufgang an diesem Tag';
	else if (!times.set) note = 'Kein Monduntergang an diesem Tag';
	return { events: view, note };
}

export function moonView(bundle: WeatherBundle, now = new Date()): MoonView {
	const tz = placeZone(bundle);
	return {
		info: moonInfo(now),
		southern: bundle.place.latitude < 0,
		timeZone: tz,
		today: moonDay(zonedDate(now, tz), bundle),
		nextFull: formatMoonDate(nextPhase('full', now), tz),
		nextNew: formatMoonDate(nextPhase('new', now), tz)
	};
}

/** Compact line for favourite cards, e.g. «Mond ↓ 01:00 · ↑ 17:16». */
export function moonTimesLine(day: MoonDayView): string {
	if (!day.events.length) return day.note ?? '';
	return `Mond ${day.events.map((e) => `${e.kind === 'rise' ? '↑' : '↓'} ${e.time}`).join(' · ')}`;
}

export function upcomingPhases(bundle: WeatherBundle, now = new Date(), count = 4) {
	const tz = placeZone(bundle);
	return nextMainPhases(now, count).map((event) => ({
		phase: event.phase,
		label: MAIN_PHASE_LABEL[event.phase],
		when: formatMoonDateTime(event.date, tz)
	}));
}

/** One entry per local day, starting today, with the phase at local noon. */
export function moonCalendar(bundle: WeatherBundle, now = new Date(), days = 30): MoonCalendarDay[] {
	const tz = placeZone(bundle);
	const today = zonedDate(now, tz);
	const end = zonedMidnight(addDays(today, days), tz);
	const phaseByDate = new Map<string, MainPhase>();
	for (const event of nextMainPhases(zonedMidnight(today, tz), 6)) {
		if (event.date.getTime() < end.getTime()) phaseByDate.set(zonedDate(event.date, tz), event.phase);
	}
	const weekday = dateFmt(tz, { weekday: 'short' });
	return Array.from({ length: days }, (_, i) => {
		const date = addDays(today, i);
		const noon = new Date(zonedMidnight(date, tz).getTime() + 12 * 3_600_000);
		const info = moonInfo(noon);
		return {
			date,
			day: Number(date.slice(8, 10)),
			weekday: weekday.format(noon),
			cycle: info.cycle,
			illumination: info.illumination,
			phase: phaseByDate.get(date) ?? null,
			isToday: i === 0
		};
	});
}
