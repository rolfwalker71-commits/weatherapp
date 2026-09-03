import type { WeatherMood } from './colors';
import type { WeatherGlyph } from './icons/weather';

interface WmoEntry {
	label: string;
	day: WeatherGlyph;
	night: WeatherGlyph;
}

const WMO: Record<number, WmoEntry> = {
	0: { label: 'Klarer Himmel', day: 'sunny', night: 'nightlight' },
	1: { label: 'Überwiegend klar', day: 'sunny', night: 'nightlight' },
	2: { label: 'Teilweise bewölkt', day: 'partly_cloudy_day', night: 'partly_cloudy_night' },
	3: { label: 'Bedeckt', day: 'cloud', night: 'cloud' },
	45: { label: 'Nebel', day: 'foggy', night: 'foggy' },
	48: { label: 'Reifnebel', day: 'foggy', night: 'foggy' },
	51: { label: 'Leichter Nieselregen', day: 'rainy_light', night: 'rainy_light' },
	53: { label: 'Nieselregen', day: 'rainy_light', night: 'rainy_light' },
	55: { label: 'Starker Nieselregen', day: 'rainy', night: 'rainy' },
	56: { label: 'Leichter Eisniesel', day: 'rainy_light', night: 'rainy_light' },
	57: { label: 'Gefrierender Nieselregen', day: 'rainy', night: 'rainy' },
	61: { label: 'Leichter Regen', day: 'rainy', night: 'rainy' },
	63: { label: 'Regen', day: 'rainy', night: 'rainy' },
	65: { label: 'Starker Regen', day: 'rainy_heavy', night: 'rainy_heavy' },
	66: { label: 'Leichter Eisregen', day: 'rainy', night: 'rainy' },
	67: { label: 'Eisregen', day: 'rainy_heavy', night: 'rainy_heavy' },
	71: { label: 'Leichter Schneefall', day: 'weather_snowy', night: 'weather_snowy' },
	73: { label: 'Schneefall', day: 'weather_snowy', night: 'weather_snowy' },
	75: { label: 'Starker Schneefall', day: 'snowflake', night: 'snowflake' },
	77: { label: 'Schneegriesel', day: 'weather_snowy', night: 'weather_snowy' },
	80: { label: 'Leichte Regenschauer', day: 'rainy', night: 'rainy' },
	81: { label: 'Regenschauer', day: 'rainy', night: 'rainy' },
	82: { label: 'Heftige Regenschauer', day: 'rainy_heavy', night: 'rainy_heavy' },
	85: { label: 'Leichte Schneeschauer', day: 'weather_snowy', night: 'weather_snowy' },
	86: { label: 'Schneeschauer', day: 'snowflake', night: 'snowflake' },
	95: { label: 'Gewitter', day: 'thunderstorm', night: 'thunderstorm' },
	96: { label: 'Gewitter mit Hagel', day: 'weather_hail', night: 'weather_hail' },
	99: { label: 'Schweres Gewitter mit Hagel', day: 'weather_hail', night: 'weather_hail' }
};

function inferWmo(code: number): WmoEntry {
	if (code <= 3) return WMO[code] ?? WMO[2];
	if (code <= 19) return { label: 'Dunst oder Nebel', day: 'foggy', night: 'foggy' };
	if (code <= 29) return { label: 'Niederschlag in der Nähe', day: 'rainy', night: 'rainy' };
	if (code <= 39) return { label: 'Schneeverwehung', day: 'weather_snowy', night: 'weather_snowy' };
	if (code <= 49) return { label: 'Nebel', day: 'foggy', night: 'foggy' };
	if (code <= 59) return { label: 'Nieselregen', day: 'rainy_light', night: 'rainy_light' };
	if (code <= 69) return { label: 'Regen', day: 'rainy', night: 'rainy' };
	if (code <= 79) return { label: 'Schnee', day: 'weather_snowy', night: 'weather_snowy' };
	if (code <= 84) return { label: 'Regenschauer', day: 'rainy', night: 'rainy' };
	if (code <= 94) return { label: 'Schneeschauer', day: 'weather_snowy', night: 'weather_snowy' };
	return { label: 'Gewitter', day: 'thunderstorm', night: 'thunderstorm' };
}

export function getWmo(code: number, isDay = true): { label: string; glyph: WeatherGlyph } {
	const safe = Number.isFinite(code) ? Math.round(code) : 0;
	const entry = WMO[safe] ?? inferWmo(safe);
	return {
		label: entry.label,
		glyph: isDay ? entry.day : entry.night
	};
}

export type { WeatherMood };

/** Hero-only atmosphere. Hail is WMO 96 / 99; other moods follow `weatherMood`. */
export type HeroAtmosphere = WeatherMood | 'hail';

export function weatherMood(code: number, isDay: boolean): WeatherMood {
	if (!isDay && code <= 2) return 'night';
	if (code <= 1) return 'clear';
	if (code <= 3) return 'cloud';
	if (code >= 95) return 'storm';
	if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
	if ((code >= 10 && code <= 19) || (code >= 40 && code <= 49) || code === 45 || code === 48) {
		return 'fog';
	}
	if (code >= 51) return 'rain';
	return 'cloud';
}

export function heroAtmosphere(code: number, isDay: boolean): HeroAtmosphere {
	const safe = Number.isFinite(code) ? Math.round(code) : 0;
	if (safe === 96 || safe === 99) return 'hail';
	return weatherMood(safe, isDay);
}
