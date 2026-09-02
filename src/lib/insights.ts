import { comfortAdvice } from './comfort';
import { formatTime } from './format';
import type { MinutePoint, WeatherBundle } from './types';
import { getWmo } from './wmo';

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

export function clothingLine(bundle: WeatherBundle): string | null {
	const comfort = comfortAdvice(bundle);
	if (!comfort) return null;
	const hours = bundle.hours.slice(0, 8);
	const wetHour = hours.find((hour) => hour.precipMm >= 0.4 || (hour.precipProb != null && hour.precipProb >= 60));
	const lastDry = [...hours].reverse().find((hour) => hour.precipMm < 0.25 && (hour.precipProb == null || hour.precipProb < 45));
	const parts = [comfort.recommendation === 'Schirm' ? 'Schirm einpacken' : comfort.recommendation];

	if (wetHour && hours[0] && hours[0].precipMm < 0.25) {
		parts.push(`nass ab ${formatTime(wetHour.time)}`);
	} else if (lastDry && (hours[0]?.precipMm ?? 0) < 0.25) {
		parts.push(`trocken bis ${formatTime(lastDry.time)}`);
	} else if ((hours[0]?.precipMm ?? 0) >= 0.4) {
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

export function thunderNowcast(minutes: MinutePoint[]): {
	nextMm: number | null;
	windowMin: number;
	label: string | null;
} {
	if (!minutes.length) {
		return { nextMm: null, windowMin: 90, label: null };
	}
	const values = minutes.map((item) => item.precipMm).filter((value): value is number => value != null);
	if (!values.length) {
		return { nextMm: null, windowMin: 90, label: null };
	}
	const nextMm = values.reduce((sum, item) => sum + item, 0);
	const storm = minutes.some((item) => item.code != null && item.code >= 95);
	return {
		nextMm,
		windowMin: 90,
		label: storm ? 'Gewitter-Wettercode in den Minutenwerten' : null
	};
}
