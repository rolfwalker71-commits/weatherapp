import { fetchWeatherLite } from './api';
import { samePlace } from './storage';
import type { Place, WeatherBundle } from './types';

const DEST_KEY = 'weather.commuteDest';

function loadDest(): Place | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(DEST_KEY);
		return raw ? (JSON.parse(raw) as Place) : null;
	} catch {
		return null;
	}
}

export const commuteState = $state({
	destination: null as Place | null,
	bundle: null as WeatherBundle | null,
	loading: false,
	error: null as string | null
});

export function hydrateCommute(): void {
	commuteState.destination = loadDest();
}

export function setCommuteDestination(place: Place | null): void {
	commuteState.destination = place;
	if (typeof localStorage === 'undefined') return;
	if (place) localStorage.setItem(DEST_KEY, JSON.stringify(place));
	else localStorage.removeItem(DEST_KEY);
}

export async function loadCommute(origin: Place): Promise<void> {
	const dest = commuteState.destination;
	if (!dest) {
		commuteState.bundle = null;
		return;
	}
	if (samePlace(origin, dest)) {
		commuteState.bundle = null;
		commuteState.error = 'Ziel ist derselbe Ort.';
		return;
	}
	commuteState.loading = true;
	commuteState.error = null;
	try {
		commuteState.bundle = await fetchWeatherLite(dest);
	} catch {
		commuteState.error = 'Zielwetter nicht verfügbar.';
	} finally {
		commuteState.loading = false;
	}
}

export const settingsUi = $state({
	open: false
});
