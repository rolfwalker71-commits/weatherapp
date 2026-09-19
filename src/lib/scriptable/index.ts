import coreSource from './core.js?raw';
import scriptSource from './wetter-widget.js?raw';
import { BERN } from '$lib/api';
import { WEATHER_GLYPHS } from '$lib/icons/weather';
import { APP_ORIGIN } from '$lib/platform';
import type { Place, WindUnit } from '$lib/types';

/** `card` mirrors the Jetzt card (scene background), `classic` is the compact gradient set. */
export type WidgetStyle = 'card' | 'classic';

export interface WidgetScriptOptions {
	/** Fixed place, or null to follow the device location (GPS). */
	place: Place | null;
	wind: WindUnit;
	style: WidgetStyle;
}

interface ScriptPlace {
	name: string;
	latitude: number;
	longitude: number;
	admin1?: string;
	country?: string;
}

function toScriptPlace(place: Place): ScriptPlace {
	return {
		name: place.name,
		latitude: Math.round(place.latitude * 1e4) / 1e4,
		longitude: Math.round(place.longitude * 1e4) / 1e4,
		admin1: place.admin1,
		country: place.country
	};
}

const TS_NOCHECK = /^\/\/ @ts-nocheck.*\n/;

/** The shared core as plain script code (no module syntax) for Scriptable. */
function inlineCore(): string {
	return coreSource.replace(TS_NOCHECK, '').replace(/^export /gm, '');
}

/** The Scriptable script with the chosen place, units and style baked in. */
export function buildWidgetScript(
	{ place, wind, style }: WidgetScriptOptions,
	fallback: Place = BERN
): string {
	const config = {
		place: place ? toScriptPlace(place) : null,
		fallback: toScriptPlace(fallback),
		wind,
		style,
		appUrl: APP_ORIGIN
	};
	return scriptSource
		.replace(TS_NOCHECK, '')
		.replace('"__CONFIG__"', () => JSON.stringify(config, null, 2))
		.replace('"__GLYPHS__"', () => JSON.stringify(WEATHER_GLYPHS))
		.replace('//__CORE__', () => inlineCore());
}

export function widgetScriptName(place: Place | null, style: WidgetStyle = 'classic'): string {
	const base = `${style === 'card' ? 'Wetter Karte' : 'Wetter'} ${place ? place.name : 'Standort'}`;
	return base.replace(/[^\p{L}\p{N} _-]/gu, '').trim();
}
