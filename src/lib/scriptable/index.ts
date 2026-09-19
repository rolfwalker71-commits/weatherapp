import scriptSource from './wetter-widget.js?raw';
import { BERN } from '$lib/api';
import { APP_ORIGIN } from '$lib/platform';
import type { Place, WindUnit } from '$lib/types';

export interface WidgetScriptOptions {
	/** Fixed place, or null to follow the device location (GPS). */
	place: Place | null;
	wind: WindUnit;
}

interface ScriptPlace {
	name: string;
	latitude: number;
	longitude: number;
}

function toScriptPlace(place: Place): ScriptPlace {
	return {
		name: place.name,
		latitude: Math.round(place.latitude * 1e4) / 1e4,
		longitude: Math.round(place.longitude * 1e4) / 1e4
	};
}

/** The Scriptable script with the chosen place and units baked in. */
export function buildWidgetScript({ place, wind }: WidgetScriptOptions, fallback: Place = BERN): string {
	const config = {
		place: place ? toScriptPlace(place) : null,
		fallback: toScriptPlace(fallback),
		wind,
		appUrl: APP_ORIGIN
	};
	return scriptSource
		.replace(/^\/\/ @ts-nocheck.*\n/, '')
		.replace('"__CONFIG__"', JSON.stringify(config, null, 2));
}

export function widgetScriptName(place: Place | null): string {
	const base = place ? `Wetter ${place.name}` : 'Wetter Standort';
	return base.replace(/[^\p{L}\p{N} _-]/gu, '').trim();
}
