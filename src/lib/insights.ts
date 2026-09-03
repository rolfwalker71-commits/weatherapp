import { comfortAdvice } from './comfort';
import { formatTime } from './format';
import type { MinutePoint, WeatherBundle } from './types';
import { getWmo } from './wmo';

export function nextPrecipLine(bundle: WeatherBundle): string | null {
	const wet = bundle.hours.find((hour) => hour.precipMm >= 0.3);
	if (!wet) return null;
	const now = bundle.hours[0];
	if (now && now.precipMm >= 0.3) {
		return `Niederschlag jetzt`;
	}
	return `Niederschlag ab ${formatTime(wet.time)}`;
}

export function insightLine(bundle: WeatherBundle): string | null {
	const now = bundle.hours[0];
	const later = bundle.hours[2] ?? bundle.hours[1];
	if (!now) {
		return getWmo(bundle.current.weather_code, bundle.current.is_day === 1).label;
	}

	const phrases: string[] = [];
	const laterPrecip = later?.precipMm ?? null;
	const laterProb = later?.precipProb ?? null;

	if (now.precipMm >= 0.3 && laterPrecip != null && laterPrecip < now.precipMm * 0.45) {
		phrases.push('Regen lässt nach');
	} else if (now.precipMm < 0.15 && laterPrecip != null && laterPrecip >= 0.5 && (laterProb == null || laterProb >= 45)) {
		phrases.push(`ab ${formatTime(later.time)} Regen`);
	} else if (now.snowfall != null && now.snowfall >= 0.2) {
		phrases.push('Schnee im Gang');
	}

	const clearHour = bundle.hours.find(
		(hour) => hour.cloud != null && hour.cloud <= 25 && hour.code <= 1 && new Date(hour.time).getTime() > Date.now()
	);
	if (clearHour && (now.cloud ?? bundle.current.cloud_cover) >= 55) {
		phrases.push(`ab ${formatTime(clearHour.time)} klar`);
	} else if ((now.cloud ?? bundle.current.cloud_cover) <= 25 && now.code <= 1) {
		phrases.push('weiterhin klar');
	}

	if (now.code >= 95) {
		phrases.push(getWmo(now.code, now.isDay).label);
	}

	if (later && later.temperature - now.temperature >= 3) {
		phrases.push('es wird milder');
	} else if (later && now.temperature - later.temperature >= 3) {
		phrases.push('es kühlt ab');
	}

	const unique = [...new Set(phrases)].slice(0, 2);
	if (unique.length) return unique.join(' · ');
	return `${getWmo(now.code, now.isDay).label} bleibt vorerst ähnlich`;
}

const WET_HOUR_MM = 0.4;
const WET_MINUTE_MM = 0.1;
const DRY_MM = 0.25;

function isWetHour(hour: { precipMm: number }): boolean {
	return hour.precipMm >= WET_HOUR_MM;
}

function isWetMinute(point: MinutePoint): boolean {
	return point.precipMm != null && point.precipMm >= WET_MINUTE_MM;
}

function precipOnsetTime(bundle: WeatherBundle): string | null {
	const hourOnset = bundle.hours.find(isWetHour);
	const minuteOnset = bundle.minutes.find(isWetMinute);
	if (!hourOnset && !minuteOnset) return null;
	if (!minuteOnset) return hourOnset!.time;
	if (!hourOnset) return minuteOnset.time;
	return new Date(minuteOnset.time).getTime() <= new Date(hourOnset.time).getTime()
		? minuteOnset.time
		: hourOnset.time;
}

export function clothingLine(bundle: WeatherBundle): string | null {
	const comfort = comfortAdvice(bundle);
	if (!comfort) return null;
	const nowMm = bundle.hours[0]?.precipMm ?? 0;
	const parts = [comfort.recommendation === 'Schirm' ? 'Schirm einpacken' : comfort.recommendation];
	const rainingNow = nowMm >= WET_HOUR_MM || (bundle.minutes[0] != null && isWetMinute(bundle.minutes[0]));

	if (nowMm < DRY_MM && !rainingNow) {
		const onset = precipOnsetTime(bundle);
		parts.push(onset ? `trocken bis ${formatTime(onset)}` : 'trocken');
	} else if (rainingNow) {
		parts.push('jetzt nass');
	}

	return parts.join(', ');
}

export function snowFrost(bundle: WeatherBundle): {
	freezingLevel: number | null;
	frost: boolean;
	frostLabel: string | null;
	snowLabel: string | null;
} {
	const hour = bundle.hours[0];
	const freezingLevel = hour?.freezingLevel ?? null;
	const tonight = bundle.days[0];
	const frost = tonight != null && tonight.tMin <= 1;
	return {
		freezingLevel,
		frost,
		frostLabel: null,
		snowLabel:
			freezingLevel != null ? `Nullgradgrenze ${Math.round(freezingLevel / 50) * 50} m` : null
	};
}

const STEP_15_MS = 15 * 60 * 1000;
const NOWCAST_BIN_MIN = 30;
const NOWCAST_HORIZON_MIN = 360;

export interface NowcastBar {
	time: string;
	precipMm: number;
	intervalMin: 30;
	source: 'minutely_15';
	code: number | null;
}

function higherCode(a: number | null, b: number | null): number | null {
	if (a == null) return b;
	if (b == null) return a;
	return Math.max(a, b);
}

/** Pair adjacent Open-Meteo 15-min points into 30-min bars. Does not invent values. */
export function nowcast30Bars(minutes: MinutePoint[], horizonMin = NOWCAST_HORIZON_MIN): NowcastBar[] {
	const bars: NowcastBar[] = [];
	let i = 0;
	while (i + 1 < minutes.length && bars.length * NOWCAST_BIN_MIN < horizonMin) {
		const first = minutes[i];
		const second = minutes[i + 1];
		if (first.precipMm == null || second.precipMm == null) {
			i += 1;
			continue;
		}
		const dt = new Date(second.time).getTime() - new Date(first.time).getTime();
		if (dt !== STEP_15_MS) {
			i += 1;
			continue;
		}
		bars.push({
			time: first.time,
			precipMm: first.precipMm + second.precipMm,
			intervalMin: NOWCAST_BIN_MIN,
			source: 'minutely_15',
			code: higherCode(first.code, second.code)
		});
		i += 2;
	}
	return bars;
}

export function nowcastTitle(bars: NowcastBar[]): string {
	const spanMin = bars.reduce((sum, bar) => sum + bar.intervalMin, 0);
	if (spanMin <= 0) return '';
	if (spanMin % 60 === 0) return `${spanMin / 60} Std.`;
	if (spanMin > 60) {
		const hours = spanMin / 60;
		const formatted = Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace('.', ',');
		return `${formatted} Std.`;
	}
	return `${spanMin} Min.`;
}

export function nowcastAriaLabel(bars: NowcastBar[]): string {
	const spanMin = bars.reduce((sum, bar) => sum + bar.intervalMin, 0);
	const window =
		spanMin >= 60 && spanMin % 60 === 0
			? `nächste ${spanMin / 60} Stunden`
			: `nächste ${spanMin} Minuten`;
	return `Niederschlag ${window}, 30-Minuten-Stufen aus 15-Minuten-Werten`;
}

export function thunderNowcast(points: Array<Pick<MinutePoint, 'precipMm' | 'code'> & { intervalMin?: number }>): {
	nextMm: number | null;
	windowMin: number;
	label: string | null;
} {
	const windowMin = points.reduce((sum, item) => sum + (item.intervalMin ?? 15), 0);
	if (!points.length) {
		return { nextMm: null, windowMin: 0, label: null };
	}
	const values = points.map((item) => item.precipMm).filter((value): value is number => value != null);
	if (!values.length) {
		return { nextMm: null, windowMin, label: null };
	}
	const nextMm = values.reduce((sum, item) => sum + item, 0);
	const storm = points.some((item) => item.code != null && item.code >= 95);
	return {
		nextMm,
		windowMin,
		label: storm ? 'Gewitter-Wettercode in den Minutenwerten' : null
	};
}
