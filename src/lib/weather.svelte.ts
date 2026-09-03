import { BERN, emptyExtras, fetchWeather, fetchWeatherHero, reverseGeocode } from './api';
import { loadNotifyPrefs } from './notify-prefs';
import { syncPreferences } from './push-client';
import {
	loadFavorites,
	loadLastBundle,
	loadLastPlace,
	pushRecent,
	saveLastBundle,
	saveLastPlace,
	samePlace,
	toggleFavorite
} from './storage';
import type { SectionId } from './nav';
import type { Place, WeatherBundle } from './types';

export const weatherState = $state({
	place: BERN as Place,
	bundle: null as WeatherBundle | null,
	favorites: [] as Place[],
	loading: false,
	locating: false,
	error: null as string | null,
	stale: false,
	section: 'jetzt' as SectionId
});

export const clockState = $state({
	now: Date.now()
});

export const favoriteWeather = $state({
	bundles: {} as Record<string, WeatherBundle>,
	errors: {} as Record<string, string>,
	loading: false
});

export const AUTO_REFRESH_MS = 15 * 60 * 1000;
const CLOCK_TICK_MS = 30_000;
const FAVORITE_FETCH_MS = 12_000;
const favoriteFlights = new Map<string, AbortController>();

export function favoriteKey(place: Place): string {
	const lat = Number(place?.latitude);
	const lon = Number(place?.longitude);
	if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
		return `invalid:${place?.name ?? '?'}`;
	}
	return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

function isUsablePlace(place: Place | null | undefined): place is Place {
	return (
		!!place &&
		typeof place.name === 'string' &&
		Number.isFinite(place.latitude) &&
		Number.isFinite(place.longitude)
	);
}

function dropFavoriteKey(key: string): void {
	if (key in favoriteWeather.bundles) {
		const { [key]: _bundle, ...bundles } = favoriteWeather.bundles;
		favoriteWeather.bundles = bundles;
	}
	if (key in favoriteWeather.errors) {
		const { [key]: _error, ...errors } = favoriteWeather.errors;
		favoriteWeather.errors = errors;
	}
}

function seedFavoriteFromCurrent(places: Place[]): void {
	const current = weatherState.bundle;
	if (!current) return;
	const match = places.find(
		(item) => samePlace(item, current.place) || samePlace(item, weatherState.place)
	);
	if (!match) return;
	const key = favoriteKey(match);
	favoriteWeather.bundles = { ...favoriteWeather.bundles, [key]: current };
	if (key in favoriteWeather.errors) {
		const { [key]: _removed, ...rest } = favoriteWeather.errors;
		favoriteWeather.errors = rest;
	}
}

async function loadOneFavoriteHero(place: Place): Promise<void> {
	const key = favoriteKey(place);
	if (key.startsWith('invalid:')) {
		favoriteWeather.errors = {
			...favoriteWeather.errors,
			[key]: 'Wetterdaten konnten nicht geladen werden.'
		};
		return;
	}
	if (favoriteFlights.has(key)) return;

	const cached = favoriteWeather.bundles[key];
	if (cached) {
		const age = Date.now() - new Date(cached.fetchedAt).getTime();
		if (Number.isFinite(age) && age < AUTO_REFRESH_MS) return;
	}

	const controller = new AbortController();
	favoriteFlights.set(key, controller);
	let timedOut = false;
	const timer = setTimeout(() => {
		timedOut = true;
		controller.abort();
	}, FAVORITE_FETCH_MS);

	try {
		const bundle = await fetchWeatherHero(place, controller.signal);
		if (favoriteFlights.get(key) !== controller) return;
		favoriteWeather.bundles = { ...favoriteWeather.bundles, [key]: bundle };
		if (key in favoriteWeather.errors) {
			const { [key]: _removed, ...rest } = favoriteWeather.errors;
			favoriteWeather.errors = rest;
		}
	} catch (error) {
		if (favoriteFlights.get(key) !== controller) return;
		if ((error as Error).name === 'AbortError' && !timedOut) return;
		if (favoriteWeather.bundles[key]) return;
		favoriteWeather.errors = {
			...favoriteWeather.errors,
			[key]: 'Wetterdaten konnten nicht geladen werden.'
		};
	} finally {
		clearTimeout(timer);
		if (favoriteFlights.get(key) === controller) {
			favoriteFlights.delete(key);
		}
	}
}

export async function loadFavoriteHeroes(): Promise<void> {
	const places = weatherState.favorites.filter(isUsablePlace);
	const wanted = new Set(places.map(favoriteKey));

	for (const key of Object.keys(favoriteWeather.bundles)) {
		if (!wanted.has(key)) dropFavoriteKey(key);
	}
	for (const key of Object.keys(favoriteWeather.errors)) {
		if (!wanted.has(key)) dropFavoriteKey(key);
	}
	for (const [key, controller] of favoriteFlights) {
		if (!wanted.has(key)) {
			controller.abort();
			favoriteFlights.delete(key);
		}
	}

	if (!places.length) {
		favoriteWeather.loading = false;
		return;
	}

	seedFavoriteFromCurrent(places);
	favoriteWeather.loading = true;
	await Promise.all(places.map((place) => loadOneFavoriteHero(place)));
	favoriteWeather.loading = favoriteFlights.size > 0;
}

let inFlight: AbortController | null = null;

export async function loadPlace(place: Place, options?: { recent?: boolean }): Promise<void> {
	inFlight?.abort();
	const controller = new AbortController();
	inFlight = controller;
	weatherState.loading = true;
	weatherState.error = null;
	weatherState.place = place;
	saveLastPlace(place);
	if (options?.recent !== false) {
		pushRecent(place);
	}

	try {
		const bundle = await fetchWeather(place, controller.signal);
		if (inFlight !== controller) return;
		weatherState.bundle = bundle;
		weatherState.stale = false;
		saveLastBundle(bundle);
		void syncPreferences(loadNotifyPrefs(), {
			latitude: place.latitude,
			longitude: place.longitude,
			name: place.name,
			timezone: bundle.timezone
		}).catch(() => {
			/* push server optional */
		});
	} catch (error) {
		if ((error as Error).name === 'AbortError') return;
		const cached = loadLastBundle();
		if (cached && samePlace(cached.place, place)) {
			weatherState.bundle = cached;
			weatherState.stale = true;
			weatherState.error = 'Offline — zuletzt gespeicherte Daten.';
		} else {
			weatherState.error = 'Wetterdaten konnten nicht geladen werden.';
		}
	} finally {
		if (inFlight === controller) {
			weatherState.loading = false;
		}
	}
}

export function hydrateFromCache(): void {
	const stored = loadFavorites();
	weatherState.favorites = Array.isArray(stored) ? stored.filter(isUsablePlace) : [];
	const last = loadLastPlace();
	const cached = loadLastBundle();
	if (last) weatherState.place = last;
	if (cached) {
		weatherState.bundle = emptyExtras({
			...cached,
			allHours: cached.allHours ?? cached.hours
		});
		weatherState.place = cached.place;
		weatherState.stale = true;
	}
}

export async function locateUser(): Promise<void> {
	weatherState.locating = true;
	try {
		if (!('geolocation' in navigator)) {
			await loadPlace(BERN, { recent: false });
			return;
		}

		const position = await new Promise<GeolocationPosition>((resolve, reject) => {
			navigator.geolocation.getCurrentPosition(resolve, reject, {
				enableHighAccuracy: false,
				timeout: 8000,
				maximumAge: 5 * 60 * 1000
			});
		});

		const place = await reverseGeocode(position.coords.latitude, position.coords.longitude);
		await loadPlace(place, { recent: false });
	} catch {
		const hadLast = Boolean(loadLastPlace());
		const fallback = loadLastPlace() ?? BERN;
		await loadPlace(fallback, { recent: false });
		if (!hadLast) {
			weatherState.error = 'Standort nicht verfügbar — Fallback Bern.';
		}
	} finally {
		weatherState.locating = false;
	}
}

export function starPlace(place: Place): void {
	weatherState.favorites = toggleFavorite(place, weatherState.favorites);
}

export function isFavorite(place: Place): boolean {
	return weatherState.favorites.some((item) => samePlace(item, place));
}

function refreshIfDue(): void {
	if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
	if (weatherState.loading || weatherState.locating) return;
	const fetchedAt = weatherState.bundle?.fetchedAt;
	if (!fetchedAt) return;
	const age = Date.now() - new Date(fetchedAt).getTime();
	if (Number.isNaN(age) || age < AUTO_REFRESH_MS) return;
	void loadPlace(weatherState.place, { recent: false });
}

export function startAutoRefresh(): () => void {
	clockState.now = Date.now();

	const tick = () => {
		clockState.now = Date.now();
		refreshIfDue();
	};

	const timer = setInterval(tick, CLOCK_TICK_MS);
	const onVisibility = () => {
		if (document.visibilityState === 'visible') tick();
	};
	document.addEventListener('visibilitychange', onVisibility);

	return () => {
		clearInterval(timer);
		document.removeEventListener('visibilitychange', onVisibility);
	};
}
