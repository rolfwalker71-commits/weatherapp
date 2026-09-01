import { BERN, fetchWeather, reverseGeocode } from './api';
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
	section: 'aktuell' as SectionId
});

export const clockState = $state({
	now: Date.now()
});

export const AUTO_REFRESH_MS = 15 * 60 * 1000;
const CLOCK_TICK_MS = 30_000;

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
	weatherState.favorites = loadFavorites();
	const last = loadLastPlace();
	const cached = loadLastBundle();
	if (last) weatherState.place = last;
	if (cached) {
		weatherState.bundle = {
			...cached,
			allHours: cached.allHours ?? cached.hours
		};
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
