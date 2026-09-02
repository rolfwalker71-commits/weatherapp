import { comfortAdvice } from './comfort';
import { formatTime } from './format';
import { clothingLine } from './insights';
import { moonInfo } from './moon';
import type { WeatherBundle } from './types';

export interface SkyWatch {
	goldenStart: string | null;
	goldenEnd: string | null;
	goldenLabel: string | null;
	starsLabel: string | null;
	moonLabel: string;
}

export function skyWatch(bundle: WeatherBundle): SkyWatch | null {
	const today = bundle.days[0];
	const moon = moonInfo(new Date(bundle.current.time));
	if (!today?.sunrise || !today.sunset) {
		return {
			goldenStart: null,
			goldenEnd: null,
			goldenLabel: null,
			starsLabel: null,
			moonLabel: moon.label
		};
	}
	const sunset = new Date(today.sunset);
	const eveningStart = new Date(sunset.getTime() - 55 * 60_000);
	const cloud = bundle.hours[0]?.cloud ?? bundle.current.cloud_cover;
	const goldOk = cloud <= 55;
	const starsOk = cloud <= 30 && moon.illumination < 0.75;
	return {
		goldenStart: eveningStart.toISOString(),
		goldenEnd: sunset.toISOString(),
		goldenLabel: goldOk
			? `Goldene Stunde gegen ${formatTime(eveningStart.toISOString())}`
			: 'Goldene Stunde hinter Wolken',
		starsLabel: starsOk ? 'Wenig Bewölkung, Mond nicht voll' : cloud > 45 ? 'Bewölkt' : moon.label,
		moonLabel: `${moon.label} · ${Math.round(moon.illumination * 100)} % beleuchtet`
	};
}

export function commuteHint(home: WeatherBundle, dest: WeatherBundle): string | null {
	const a = clothingLine(home);
	const b = clothingLine(dest);
	if (!a || !b) return null;
	const rainHome = home.hours.slice(0, 4).reduce((sum, hour) => sum + hour.precipMm, 0);
	const rainDest = dest.hours.slice(0, 4).reduce((sum, hour) => sum + hour.precipMm, 0);
	if (rainHome < 0.3 && rainDest >= 0.6) {
		return `Start trocken, Ziel nass — ${b}`;
	}
	if (rainHome >= 0.6 && rainDest < 0.3) {
		return `Start nass, Ziel trockener — ${a}`;
	}
	const comfort = comfortAdvice(dest);
	return comfort ? `${home.place.name}: ${a}. ${dest.place.name}: ${comfort.detail}` : `${a}. ${b}`;
}
