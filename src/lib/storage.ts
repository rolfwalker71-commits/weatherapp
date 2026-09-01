import type { Place, WeatherBundle } from './types';

const FAVORITES_KEY = 'weather.favorites';
const LAST_PLACE_KEY = 'weather.lastPlace';
const LAST_BUNDLE_KEY = 'weather.lastBundle';
const RECENT_KEY = 'weather.recent';

function readJson<T>(key: string, fallback: T): T {
	if (typeof localStorage === 'undefined') return fallback;
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return fallback;
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}

function writeJson(key: string, value: unknown): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(key, JSON.stringify(value));
}

export function loadFavorites(): Place[] {
	return readJson<Place[]>(FAVORITES_KEY, []);
}

export function saveFavorites(places: Place[]): void {
	writeJson(FAVORITES_KEY, places.slice(0, 8));
}

export function samePlace(a: Place, b: Place): boolean {
	return Math.abs(a.latitude - b.latitude) < 0.01 && Math.abs(a.longitude - b.longitude) < 0.01;
}

export function toggleFavorite(place: Place, favorites: Place[]): Place[] {
	const exists = favorites.some((item) => samePlace(item, place));
	const next = exists
		? favorites.filter((item) => !samePlace(item, place))
		: [{ ...place }, ...favorites].slice(0, 8);
	saveFavorites(next);
	return next;
}

export function loadLastPlace(): Place | null {
	return readJson<Place | null>(LAST_PLACE_KEY, null);
}

export function saveLastPlace(place: Place): void {
	writeJson(LAST_PLACE_KEY, place);
}

export function loadLastBundle(): WeatherBundle | null {
	return readJson<WeatherBundle | null>(LAST_BUNDLE_KEY, null);
}

export function saveLastBundle(bundle: WeatherBundle): void {
	writeJson(LAST_BUNDLE_KEY, bundle);
}

export function loadRecent(): Place[] {
	return readJson<Place[]>(RECENT_KEY, []);
}

export function pushRecent(place: Place): Place[] {
	const current = loadRecent().filter((item) => !samePlace(item, place));
	const next = [{ ...place }, ...current].slice(0, 6);
	writeJson(RECENT_KEY, next);
	return next;
}
