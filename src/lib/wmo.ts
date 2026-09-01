import type { Component } from 'svelte';
import type { WeatherMood } from './colors';
import Cloud from '@lucide/svelte/icons/cloud';
import CloudDrizzle from '@lucide/svelte/icons/cloud-drizzle';
import CloudFog from '@lucide/svelte/icons/cloud-fog';
import CloudLightning from '@lucide/svelte/icons/cloud-lightning';
import CloudMoon from '@lucide/svelte/icons/cloud-moon';
import CloudRain from '@lucide/svelte/icons/cloud-rain';
import CloudRainWind from '@lucide/svelte/icons/cloud-rain-wind';
import CloudSnow from '@lucide/svelte/icons/cloud-snow';
import CloudSun from '@lucide/svelte/icons/cloud-sun';
import Moon from '@lucide/svelte/icons/moon';
import Snowflake from '@lucide/svelte/icons/snowflake';
import Sun from '@lucide/svelte/icons/sun';

export type IconComponent = Component<{ class?: string; size?: number | string; 'aria-hidden'?: boolean | 'true' | 'false' }>;

interface WmoEntry {
	label: string;
	day: IconComponent;
	night: IconComponent;
}

const WMO: Record<number, WmoEntry> = {
	0: { label: 'Klarer Himmel', day: Sun, night: Moon },
	1: { label: 'Überwiegend klar', day: Sun, night: Moon },
	2: { label: 'Teilweise bewölkt', day: CloudSun, night: CloudMoon },
	3: { label: 'Bedeckt', day: Cloud, night: Cloud },
	45: { label: 'Nebel', day: CloudFog, night: CloudFog },
	48: { label: 'Reifnebel', day: CloudFog, night: CloudFog },
	51: { label: 'Leichter Nieselregen', day: CloudDrizzle, night: CloudDrizzle },
	53: { label: 'Nieselregen', day: CloudDrizzle, night: CloudDrizzle },
	55: { label: 'Starker Nieselregen', day: CloudDrizzle, night: CloudDrizzle },
	56: { label: 'Leichter Eisniesel', day: CloudDrizzle, night: CloudDrizzle },
	57: { label: 'Gefrierender Nieselregen', day: CloudDrizzle, night: CloudDrizzle },
	61: { label: 'Leichter Regen', day: CloudRain, night: CloudRain },
	63: { label: 'Regen', day: CloudRain, night: CloudRain },
	65: { label: 'Starker Regen', day: CloudRainWind, night: CloudRainWind },
	66: { label: 'Leichter Eisregen', day: CloudRain, night: CloudRain },
	67: { label: 'Eisregen', day: CloudRainWind, night: CloudRainWind },
	71: { label: 'Leichter Schneefall', day: CloudSnow, night: CloudSnow },
	73: { label: 'Schneefall', day: CloudSnow, night: CloudSnow },
	75: { label: 'Starker Schneefall', day: Snowflake, night: Snowflake },
	77: { label: 'Schneegriesel', day: CloudSnow, night: CloudSnow },
	80: { label: 'Leichte Regenschauer', day: CloudRain, night: CloudRain },
	81: { label: 'Regenschauer', day: CloudRain, night: CloudRain },
	82: { label: 'Heftige Regenschauer', day: CloudRainWind, night: CloudRainWind },
	85: { label: 'Leichte Schneeschauer', day: CloudSnow, night: CloudSnow },
	86: { label: 'Schneeschauer', day: Snowflake, night: Snowflake },
	95: { label: 'Gewitter', day: CloudLightning, night: CloudLightning },
	96: { label: 'Gewitter mit Hagel', day: CloudLightning, night: CloudLightning },
	99: { label: 'Schweres Gewitter mit Hagel', day: CloudLightning, night: CloudLightning }
};

function inferWmo(code: number): WmoEntry {
	if (code <= 3) return WMO[code] ?? WMO[2];
	if (code <= 19) return { label: 'Dunst oder Nebel', day: CloudFog, night: CloudFog };
	if (code <= 29) return { label: 'Niederschlag in der Nähe', day: CloudRain, night: CloudRain };
	if (code <= 39) return { label: 'Schneeverwehung', day: CloudSnow, night: CloudSnow };
	if (code <= 49) return { label: 'Nebel', day: CloudFog, night: CloudFog };
	if (code <= 59) return { label: 'Nieselregen', day: CloudDrizzle, night: CloudDrizzle };
	if (code <= 69) return { label: 'Regen', day: CloudRain, night: CloudRain };
	if (code <= 79) return { label: 'Schnee', day: CloudSnow, night: CloudSnow };
	if (code <= 84) return { label: 'Regenschauer', day: CloudRain, night: CloudRain };
	if (code <= 94) return { label: 'Schneeschauer', day: CloudSnow, night: CloudSnow };
	return { label: 'Gewitter', day: CloudLightning, night: CloudLightning };
}

export function getWmo(code: number, isDay = true): { label: string; icon: IconComponent } {
	const safe = Number.isFinite(code) ? Math.round(code) : 0;
	const entry = WMO[safe] ?? inferWmo(safe);
	return {
		label: entry.label,
		icon: isDay ? entry.day : entry.night
	};
}

export type { WeatherMood };

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
