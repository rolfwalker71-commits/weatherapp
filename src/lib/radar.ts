export interface RadarFrame {
	time: number;
	path: string;
	kind: 'past' | 'nowcast';
}

export interface SatelliteFrame {
	time: number;
	path: string;
}

export interface RadarCatalog {
	host: string;
	frames: RadarFrame[];
	infrared: SatelliteFrame[];
}

export interface WindPoint {
	latitude: number;
	longitude: number;
	speed: number;
	gusts: number;
	direction: number;
	cape: number | null;
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
		cape?: number | null;
	};
}

const RAINVIEWER = 'https://api.rainviewer.com/public/weather-maps.json';

function takeFrames(
	list: { time: number; path: string }[] | undefined,
	kind: RadarFrame['kind']
): RadarFrame[] {
	const frames: RadarFrame[] = [];
	const seen = new Set<number>();
	for (const frame of list ?? []) {
		if (!frame?.time || !frame.path || seen.has(frame.time)) continue;
		seen.add(frame.time);
		frames.push({ time: frame.time, path: frame.path, kind });
	}
	return frames;
}

export async function fetchRadarCatalog(signal?: AbortSignal): Promise<RadarCatalog> {
	const response = await fetch(RAINVIEWER, { signal });
	if (!response.ok) throw new Error('Radar-Katalog nicht verfügbar');
	const data = (await response.json()) as RainViewerMaps;
	const past = takeFrames(data.radar?.past, 'past');
	const nowcast = takeFrames(data.radar?.nowcast, 'nowcast');
	const frames = [...past, ...nowcast].sort((a, b) => a.time - b.time);
	return {
		host: data.host,
		frames,
		infrared: (data.satellite?.infrared ?? []).filter((frame) => frame?.time && frame.path)
	};
}

export function lastObservedIndex(frames: RadarFrame[]): number {
	let last = -1;
	for (let i = 0; i < frames.length; i++) {
		if (frames[i].kind === 'past') last = i;
	}
	if (last >= 0) return last;
	return Math.max(0, frames.length - 1);
}

export function radarTicks(frames: RadarFrame[], maxTicks = 5): { index: number; time: number }[] {
	if (!frames.length) return [];
	const count = Math.min(maxTicks, frames.length);
	if (count === 1) return [{ index: 0, time: frames[0].time }];
	const ticks: { index: number; time: number }[] = [];
	const seen = new Set<number>();
	for (let i = 0; i < count; i++) {
		const index = Math.round((i * (frames.length - 1)) / (count - 1));
		if (seen.has(index)) continue;
		seen.add(index);
		ticks.push({ index, time: frames[index].time });
	}
	return ticks;
}

export function formatRadarTime(unix: number): string {
	return new Intl.DateTimeFormat('de-CH', { hour: '2-digit', minute: '2-digit' }).format(
		new Date(unix * 1000)
	);
}

/** Colorful Titan scheme, smoothed, snow separate. Max radar zoom is 7. */
export function radarTileUrl(host: string, path: string): string {
	return `${host}${path}/256/{z}/{x}/{y}/4/1_1.png`;
}

/** RainViewer infrared, greyscale. */
export function infraredTileUrl(host: string, path: string): string {
	return `${host}${path}/256/{z}/{x}/{y}/0/0_0.png`;
}

export interface MapBounds {
	south: number;
	north: number;
	west: number;
	east: number;
}

const MAX_WIND_POINTS = 70;

/** Fill the visible map with a regular grid, denser when zoomed in. */
export function buildWindGridFromBounds(bounds: MapBounds): { lats: number[]; lons: number[] } {
	let west = bounds.west;
	let east = bounds.east;
	if (east < west) {
		east += 360;
	}
	const latSpan = Math.max(0.08, bounds.north - bounds.south);
	const lonSpan = Math.max(0.08, east - west);
	let rows = Math.min(8, Math.max(4, Math.round(latSpan / 0.28)));
	let cols = Math.min(10, Math.max(5, Math.round(lonSpan / 0.28)));
	while (rows * cols > MAX_WIND_POINTS) {
		if (cols >= rows) cols -= 1;
		else rows -= 1;
	}

	const lats: number[] = [];
	const lons: number[] = [];
	for (let row = 0; row < rows; row += 1) {
		const lat = bounds.south + ((row + 0.5) / rows) * latSpan;
		for (let col = 0; col < cols; col += 1) {
			let lon = west + ((col + 0.5) / cols) * lonSpan;
			if (lon > 180) lon -= 360;
			lats.push(Number(lat.toFixed(3)));
			lons.push(Number(lon.toFixed(3)));
		}
	}
	return { lats, lons };
}

export async function fetchWindGrid(bounds: MapBounds, signal?: AbortSignal): Promise<WindPoint[]> {
	const { lats, lons } = buildWindGridFromBounds(bounds);
	const url = new URL('https://api.open-meteo.com/v1/forecast');
	url.searchParams.set('latitude', lats.join(','));
	url.searchParams.set('longitude', lons.join(','));
	url.searchParams.set('current', 'wind_speed_10m,wind_direction_10m,wind_gusts_10m,cape');
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
			direction: point.current!.wind_direction_10m,
			cape: point.current!.cape ?? null
		}));
}

export function windTone(speed: number): 'calm' | 'fresh' | 'strong' {
	if (speed >= 40) return 'strong';
	if (speed >= 18) return 'fresh';
	return 'calm';
}

export function capeTone(cape: number | null): 'none' | 'fair' | 'strong' {
	if (cape == null || cape < 500) return 'none';
	if (cape >= 1500) return 'strong';
	return 'fair';
}

/** EUMETSAT MTG Lightning Imager, accumulated flash area. Public WMS, CORS open. */
export const LIGHTNING_WMS = {
	url: 'https://view.eumetsat.int/geoserver/wms',
	layers: 'mtg_fd:li_afa',
	styles: 'mtg_li_afa',
	attribution: 'Blitz <a href="https://user.eumetsat.int/">EUMETSAT MTG LI</a>'
};

export function lightningWmsOptions(): Record<string, string | boolean | number> {
	return {
		layers: LIGHTNING_WMS.layers,
		styles: LIGHTNING_WMS.styles,
		format: 'image/png',
		transparent: true,
		opacity: 0.62,
		version: '1.1.1',
		attribution: LIGHTNING_WMS.attribution
	};
}
