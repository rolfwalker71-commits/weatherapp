export interface RadarFrame {
	time: number;
	path: string;
	kind: 'past' | 'nowcast';
}

export interface RadarCatalog {
	host: string;
	frames: RadarFrame[];
}

export interface WindPoint {
	latitude: number;
	longitude: number;
	speed: number;
	gusts: number;
	direction: number;
}

interface RainViewerMaps {
	host: string;
	radar?: {
		past?: { time: number; path: string }[];
		nowcast?: { time: number; path: string }[];
	};
	satellite?: {
		infrared?: { time: number; path: string }[];
	};
}

interface OpenMeteoPoint {
	latitude: number;
	longitude: number;
	current?: {
		wind_speed_10m: number;
		wind_direction_10m: number;
		wind_gusts_10m: number;
	};
}

const RAINVIEWER = 'https://api.rainviewer.com/public/weather-maps.json';

export async function fetchRadarCatalog(signal?: AbortSignal): Promise<RadarCatalog> {
	const response = await fetch(RAINVIEWER, { signal });
	if (!response.ok) throw new Error('Radar-Katalog nicht verfügbar');
	const data = (await response.json()) as RainViewerMaps;
	const past = (data.radar?.past ?? []).map((frame) => ({ ...frame, kind: 'past' as const }));
	const nowcast = (data.radar?.nowcast ?? []).map((frame) => ({ ...frame, kind: 'nowcast' as const }));
	return {
		host: data.host,
		frames: [...past, ...nowcast]
	};
}

/** Colorful Titan scheme, smoothed, snow separate. Max radar zoom is 7. */
export function radarTileUrl(host: string, path: string): string {
	return `${host}${path}/256/{z}/{x}/{y}/4/1_1.png`;
}

export function buildWindGrid(lat: number, lon: number, size = 5, step = 0.32): { lats: number[]; lons: number[] } {
	const lats: number[] = [];
	const lons: number[] = [];
	const half = Math.floor(size / 2);
	for (let row = -half; row <= half; row += 1) {
		for (let col = -half; col <= half; col += 1) {
			lats.push(Number((lat + row * step).toFixed(3)));
			lons.push(Number((lon + col * step).toFixed(3)));
		}
	}
	return { lats, lons };
}

export async function fetchWindGrid(
	latitude: number,
	longitude: number,
	signal?: AbortSignal
): Promise<WindPoint[]> {
	const { lats, lons } = buildWindGrid(latitude, longitude);
	const url = new URL('https://api.open-meteo.com/v1/forecast');
	url.searchParams.set('latitude', lats.join(','));
	url.searchParams.set('longitude', lons.join(','));
	url.searchParams.set('current', 'wind_speed_10m,wind_direction_10m,wind_gusts_10m');
	url.searchParams.set('wind_speed_unit', 'kmh');
	url.searchParams.set('models', 'best_match');

	const response = await fetch(url.toString(), { signal });
	if (!response.ok) throw new Error('Winddaten nicht verfügbar');
	const data = (await response.json()) as OpenMeteoPoint | OpenMeteoPoint[];
	const points = Array.isArray(data) ? data : [data];
	return points
		.filter((point) => point.current)
		.map((point) => ({
			latitude: point.latitude,
			longitude: point.longitude,
			speed: point.current!.wind_speed_10m,
			gusts: point.current!.wind_gusts_10m,
			direction: point.current!.wind_direction_10m
		}));
}

export function windTone(speed: number): 'calm' | 'fresh' | 'strong' {
	if (speed >= 40) return 'strong';
	if (speed >= 18) return 'fresh';
	return 'calm';
}
