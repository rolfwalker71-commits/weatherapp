import type { ScaleTone } from './colors';
import { comfortAdvice } from './comfort';
import { formatTime } from './format';
import { clothingLine, snowFrost } from './insights';
import { moonInfo } from './moon';
import type { WeatherBundle } from './types';

export interface OutdoorScore {
	id: string;
	label: string;
	score: number;
	tone: ScaleTone;
	hint: string;
}

function clamp(value: number, min = 0, max = 100): number {
	return Math.min(max, Math.max(min, Math.round(value)));
}

function toneFromScore(score: number): ScaleTone {
	if (score >= 75) return 'good';
	if (score >= 55) return 'fair';
	if (score >= 35) return 'warn';
	return 'bad';
}

export function outdoorScores(bundle: WeatherBundle): OutdoorScore[] {
	const now = bundle.hours[0];
	const next = bundle.hours.slice(0, 6);
	const temp = bundle.current.temperature_2m;
	const wind = bundle.current.wind_speed_10m;
	const precip = next.reduce((sum, hour) => sum + hour.precipMm, 0);
	const precipProb = Math.max(...next.map((hour) => hour.precipProb), 0);
	const uv = now?.uv ?? bundle.days[0]?.uvMax ?? 0;
	const frost = snowFrost(bundle).frost;
	const cape = now?.cape ?? 0;
	const month = new Date(bundle.current.time).getMonth();
	const winter = month <= 3 || month >= 10;

	const run = clamp(
		88 - precip * 28 - (precipProb > 55 ? 18 : 0) - Math.abs(temp - 12) * 2.2 - Math.max(0, wind - 22) * 1.4 - (frost ? 20 : 0)
	);
	const bike = clamp(
		86 - precip * 32 - (precipProb > 50 ? 20 : 0) - Math.max(0, wind - 18) * 2 - Math.abs(temp - 14) * 1.8 - (frost ? 25 : 0)
	);
	const grill = clamp(
		80 - precip * 40 - (precipProb > 40 ? 22 : 0) - Math.max(0, 16 - temp) * 4 - Math.max(0, wind - 20) * 2 + (uv >= 3 ? 4 : 0)
	);
	const washHours = bundle.hours.slice(0, 8);
	const washWet = washHours.some((hour) => hour.precipMm >= 0.3 || hour.precipProb >= 55);
	const wash = clamp(
		washWet ? 22 : 84 - bundle.current.relative_humidity_2m * 0.25 + Math.min(wind, 16) * 1.2
	);
	const snow = clamp(
		!winter
			? 12
			: 40 +
					(now?.snowfall && now.snowfall > 0 ? 20 : 0) +
					((now?.freezingLevel ?? 3000) < 1800 ? 18 : 0) +
					(temp <= 4 ? 10 : 0) -
					precip * 8 -
					Math.max(0, wind - 35) * 2 -
					(cape >= 900 ? 15 : 0)
	);

	return [
		{
			id: 'run',
			label: 'Laufen',
			score: run,
			tone: toneFromScore(run),
			hint: run >= 70 ? 'Gute Bedingungen' : run >= 45 ? 'Mit Einschränkung' : 'Eher drinnen'
		},
		{
			id: 'bike',
			label: 'Velofahren',
			score: bike,
			tone: toneFromScore(bike),
			hint: bike >= 70 ? 'Angenehm' : bike >= 45 ? 'Wind oder Nässe' : 'Ungünstig'
		},
		{
			id: 'grill',
			label: 'Grill',
			score: grill,
			tone: toneFromScore(grill),
			hint: grill >= 70 ? 'Passt' : grill >= 45 ? 'Kurz möglich' : 'Schlecht'
		},
		{
			id: 'wash',
			label: 'Waschtag',
			score: wash,
			tone: toneFromScore(wash),
			hint: washWet ? 'Wäsche wird nass' : 'Draussen trocknen möglich'
		},
		{
			id: 'ski',
			label: 'Skitour',
			score: snow,
			tone: toneFromScore(snow),
			hint: winter ? 'Nur Lage, keine Lawinenauskunft' : 'Keine Wintersaison'
		}
	];
}

export interface SkyWatch {
	goldenStart: string | null;
	goldenEnd: string | null;
	goldenLabel: string;
	starsLabel: string;
	moonLabel: string;
}

export function skyWatch(bundle: WeatherBundle): SkyWatch {
	const today = bundle.days[0];
	const moon = moonInfo(new Date(bundle.current.time));
	if (!today) {
		return {
			goldenStart: null,
			goldenEnd: null,
			goldenLabel: 'Keine Sonnenzeiten',
			starsLabel: 'Keine Einschätzung',
			moonLabel: moon.label
		};
	}
	const sunrise = new Date(today.sunrise);
	const sunset = new Date(today.sunset);
	const eveningStart = new Date(sunset.getTime() - 55 * 60_000);
	const eveningEnd = sunset;
	const cloud = bundle.hours[0]?.cloud ?? bundle.current.cloud_cover;
	const goldOk = cloud <= 55;
	const starsOk = cloud <= 30 && moon.illumination < 0.75;
	return {
		goldenStart: eveningStart.toISOString(),
		goldenEnd: eveningEnd.toISOString(),
		goldenLabel: goldOk
			? `Goldene Stunde gegen ${formatTime(eveningStart.toISOString())}`
			: 'Goldene Stunde hinter Wolken',
		starsLabel: starsOk
			? 'Sternenhimmel möglich — ohne Lichtverschmutzungs-Karte nur nach Mond und Wolken'
			: cloud > 45
				? 'Bewölkt, wenig Sterne'
				: `Hell durch ${moon.label}`,
		moonLabel: `${moon.label} · ${Math.round(moon.illumination * 100)} % beleuchtet`
	};
}

export function windowAdvice(bundle: WeatherBundle): { close: boolean; label: string } {
	const trend = bundle.airTrend;
	const now = trend[0] ?? {
		aqi: bundle.air?.european_aqi ?? null,
		pm25: bundle.air?.pm2_5 ?? null,
		time: bundle.current.time
	};
	const later = trend[3] ?? trend[trend.length - 1] ?? now;
	const pollenMax = Math.max(bundle.pollen.alder ?? 0, bundle.pollen.birch ?? 0, bundle.pollen.grass ?? 0);
	const badNow = (now.aqi ?? 0) >= 50 || (now.pm25 ?? 0) >= 25 || pollenMax >= 100;
	const rising = (later.pm25 ?? 0) - (now.pm25 ?? 0) >= 4 || (later.aqi ?? 0) - (now.aqi ?? 0) >= 8;
	if (badNow && rising) {
		return { close: true, label: 'Fenster zu — Feinstaub steigt' };
	}
	if (badNow) {
		return { close: true, label: 'Fenster zu — Luft oder Pollen belastet' };
	}
	if ((now.pm25 ?? 0) >= 15 && rising) {
		return { close: true, label: 'Fenster besser zu — Feinstaub-Trend aufwärts' };
	}
	if ((now.aqi ?? 99) <= 30 && (later.aqi ?? 0) <= (now.aqi ?? 0) + 5) {
		return { close: false, label: 'Fenster auf möglich — Luft bleibt gut' };
	}
	return { close: false, label: 'Lüften unproblematisch, Trend beobachten' };
}

export function commuteHint(home: WeatherBundle, dest: WeatherBundle): string {
	const a = clothingLine(home);
	const b = clothingLine(dest);
	const rainHome = home.hours.slice(0, 4).reduce((sum, hour) => sum + hour.precipMm, 0);
	const rainDest = dest.hours.slice(0, 4).reduce((sum, hour) => sum + hour.precipMm, 0);
	if (rainHome < 0.3 && rainDest >= 0.6) {
		return `Start trocken, Ziel nass — ${b}`;
	}
	if (rainHome >= 0.6 && rainDest < 0.3) {
		return `Start nass, Ziel trockener — ${a}`;
	}
	const comfort = comfortAdvice(dest);
	return `${home.place.name}: ${a}. ${dest.place.name}: ${comfort.detail}`;
}
