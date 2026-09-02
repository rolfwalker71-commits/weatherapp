import { comfortAdvice } from './comfort';
import { formatTime } from './format';
import { namedWind } from './wind-situation';
import type { MinutePoint, WeatherBundle } from './types';
import { getWmo } from './wmo';

export function insightLine(bundle: WeatherBundle): string {
	const now = bundle.hours[0];
	const later = bundle.hours[2] ?? bundle.hours[1];
	if (!now) {
		return getWmo(bundle.current.weather_code, bundle.current.is_day === 1).label;
	}

	const phrases: string[] = [];
	const laterPrecip = later?.precipMm ?? 0;
	const laterProb = later?.precipProb ?? 0;

	if (now.precipMm >= 0.3 && laterPrecip < now.precipMm * 0.45) {
		phrases.push('Regen lässt nach');
	} else if (now.precipMm < 0.15 && laterPrecip >= 0.5 && laterProb >= 45) {
		phrases.push(`ab ${formatTime(later.time)} Regen`);
	} else if (now.snowfall && now.snowfall >= 0.2) {
		phrases.push('Schnee im Gang');
	}

	const wind = namedWind(bundle.place, bundle);
	if (wind.name === 'Bise' || wind.name === 'Südföhn' || wind.name === 'Nordföhn') {
		phrases.push(wind.name);
	} else if (later && now.windDir != null && later.windDir != null) {
		const delta = Math.abs(((later.windDir - now.windDir + 540) % 360) - 180);
		if (delta >= 50 && later.windDir >= 30 && later.windDir <= 90) {
			phrases.push('Wind dreht auf Bise');
		}
	}

	const clearHour = bundle.hours.find(
		(hour) => hour.cloud != null && hour.cloud <= 25 && hour.code <= 1 && new Date(hour.time).getTime() > Date.now()
	);
	if (clearHour && (now.cloud ?? bundle.current.cloud_cover) >= 55) {
		phrases.push(`ab ${formatTime(clearHour.time)} klar`);
	} else if ((now.cloud ?? bundle.current.cloud_cover) <= 25 && now.code <= 1) {
		phrases.push('weiterhin klar');
	}

	if ((now.cape ?? 0) >= 800 || now.code >= 95) {
		phrases.push('Gewitterlage');
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

export function clothingLine(bundle: WeatherBundle): string {
	const comfort = comfortAdvice(bundle);
	const hours = bundle.hours.slice(0, 8);
	const wetHour = hours.find((hour) => hour.precipMm >= 0.4 || hour.precipProb >= 60);
	const dryUntil = hours.find((hour) => hour.precipMm < 0.2 && hour.precipProb < 40);
	const lastDry = [...hours].reverse().find((hour) => hour.precipMm < 0.25 && hour.precipProb < 45);
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
	frostLabel: string;
	snowLabel: string;
} {
	const hour = bundle.hours[0];
	const freezingLevel = hour?.freezingLevel ?? null;
	const tonight = bundle.days[0];
	const frost = (tonight?.tMin ?? 99) <= 1 || bundle.current.temperature_2m <= 0.5;
	const frostLabel = frost
		? tonight && tonight.tMin <= -2
			? 'Frostgefahr, glatte Wege möglich'
			: 'leichte Frostgefahr'
		: 'kein relevanter Frost';
	let snowLabel = 'keine Schneegrenze';
	if (freezingLevel != null) {
		const meters = Math.round(freezingLevel / 50) * 50;
		snowLabel = `Nullgradgrenze ca. ${meters} m`;
		if (bundle.current.temperature_2m <= 1 && (hour?.snowfall ?? 0) > 0.1) {
			snowLabel += ' · Schnee bis in Lagen';
		}
	}
	return { freezingLevel, frost, frostLabel, snowLabel };
}

export function thunderNowcast(minutes: MinutePoint[]): {
	risk: 'ruhe' | 'möglich' | 'nah';
	label: string;
	nextMm: number;
	windowMin: number;
} {
	const upcoming = minutes.slice(0, 6);
	const nextMm = upcoming.reduce((sum, item) => sum + item.precipMm, 0);
	const maxCape = Math.max(0, ...upcoming.map((item) => item.cape ?? 0));
	const stormCode = upcoming.some((item) => (item.code ?? 0) >= 95);
	if (stormCode || (maxCape >= 1200 && nextMm >= 1)) {
		return { risk: 'nah', label: 'Gewitter in der nächsten Stunde möglich', nextMm, windowMin: 90 };
	}
	if (maxCape >= 700 || nextMm >= 1.5) {
		return { risk: 'möglich', label: 'Schauerlage, Gewitter nicht ausgeschlossen', nextMm, windowMin: 90 };
	}
	return { risk: 'ruhe', label: 'Kein Gewitter-Nowcast in den nächsten 90 Minuten', nextMm, windowMin: 90 };
}
