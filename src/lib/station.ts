import { haversineKm, isSwitzerland } from './geo';
import type { Place, StationObservation } from './types';

const SMN_META_URL = 'https://data.geo.admin.ch/ch.meteoschweiz.ogd-smn/ogd-smn_meta_stations.csv';
const SMN_VQHA80_URL = 'https://data.geo.admin.ch/ch.meteoschweiz.messwerte-aktuell/VQHA80.csv';
const METAR_URL = 'https://aviationweather.gov/api/data/metar';
const METAR_PROXY = '/api/metar';
const META_CACHE_KEY = 'weather.smnStations';
const META_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_DISTANCE_KM = 80;
const MAX_AGE_MS = 3 * 60 * 60 * 1000;
const METAR_BBOX_DEG = 0.9;

interface SmnStation {
	id: string;
	name: string;
	latitude: number;
	longitude: number;
}

interface Candidate {
	id: string;
	name: string;
	latitude: number;
	longitude: number;
	temperature: number;
	observedAt: string | null;
	source: StationObservation['source'];
}

let memoryMeta: { at: number; stations: SmnStation[] } | null = null;

function splitCsvLine(line: string): string[] {
	return line.replace(/\r$/, '').split(';');
}

function parseNumber(raw: string | undefined): number | null {
	if (raw == null) return null;
	const value = raw.trim();
	if (!value || value === '-') return null;
	const parsed = Number(value.replace(',', '.'));
	return Number.isFinite(parsed) ? parsed : null;
}

function parseVqhaDate(raw: string): string | null {
	if (!/^\d{12}$/.test(raw)) return null;
	return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(8, 10)}:${raw.slice(10, 12)}:00Z`;
}

function isFresh(iso: string | null): boolean {
	if (!iso) return true;
	const then = new Date(iso).getTime();
	if (Number.isNaN(then)) return false;
	return Date.now() - then <= MAX_AGE_MS;
}

function pickNearest(place: Place, rows: Candidate[]): StationObservation | null {
	let best: StationObservation | null = null;
	for (const row of rows) {
		if (!isFresh(row.observedAt)) continue;
		const distanceKm = haversineKm(place.latitude, place.longitude, row.latitude, row.longitude);
		if (distanceKm > MAX_DISTANCE_KM) continue;
		if (!best || distanceKm < best.distanceKm) {
			best = {
				id: row.id,
				name: row.name,
				temperature: row.temperature,
				observedAt: row.observedAt,
				distanceKm,
				source: row.source
			};
		}
	}
	return best;
}

async function fetchBytes(url: string, signal?: AbortSignal): Promise<ArrayBuffer> {
	const response = await fetch(url, {
		signal,
		headers: { Accept: 'text/csv,text/plain,application/json,*/*' }
	});
	if (!response.ok) throw new Error(`Anfrage fehlgeschlagen (${response.status})`);
	return response.arrayBuffer();
}

function parseSmnStations(text: string): SmnStation[] {
	const lines = text.split('\n').filter((line) => line.trim());
	if (lines.length < 2) return [];
	const header = splitCsvLine(lines[0]).map((cell) => cell.trim());
	const idIdx = header.indexOf('station_abbr');
	const nameIdx = header.indexOf('station_name');
	const latIdx = header.indexOf('station_coordinates_wgs84_lat');
	const lonIdx = header.indexOf('station_coordinates_wgs84_lon');
	if (idIdx < 0 || nameIdx < 0 || latIdx < 0 || lonIdx < 0) return [];

	const stations: SmnStation[] = [];
	for (const line of lines.slice(1)) {
		const cells = splitCsvLine(line);
		const id = cells[idIdx]?.trim();
		const name = cells[nameIdx]?.trim();
		const latitude = parseNumber(cells[latIdx]);
		const longitude = parseNumber(cells[lonIdx]);
		if (!id || !name || latitude == null || longitude == null) continue;
		stations.push({ id, name, latitude, longitude });
	}
	return stations;
}

function readCachedMeta(): SmnStation[] | null {
	if (memoryMeta && Date.now() - memoryMeta.at < META_TTL_MS && memoryMeta.stations.length) {
		return memoryMeta.stations;
	}
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(META_CACHE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as { at?: number; stations?: SmnStation[] };
		if (!parsed.at || Date.now() - parsed.at >= META_TTL_MS) return null;
		if (!Array.isArray(parsed.stations) || !parsed.stations.length) return null;
		memoryMeta = { at: parsed.at, stations: parsed.stations };
		return parsed.stations;
	} catch {
		return null;
	}
}

function writeCachedMeta(stations: SmnStation[]): void {
	memoryMeta = { at: Date.now(), stations };
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(META_CACHE_KEY, JSON.stringify(memoryMeta));
	} catch {
		/* quota */
	}
}

async function loadSmnStations(signal?: AbortSignal): Promise<SmnStation[]> {
	const cached = readCachedMeta();
	if (cached) return cached;
	const bytes = await fetchBytes(SMN_META_URL, signal);
	const text = new TextDecoder('iso-8859-1').decode(bytes);
	const stations = parseSmnStations(text);
	if (stations.length) writeCachedMeta(stations);
	return stations;
}

function parseVqha80(text: string): Map<string, { temperature: number; observedAt: string | null }> {
	const lines = text.split('\n').filter((line) => line.trim());
	const map = new Map<string, { temperature: number; observedAt: string | null }>();
	if (lines.length < 2) return map;
	const header = splitCsvLine(lines[0]).map((cell) => cell.trim());
	const idIdx = header.indexOf('Station/Location');
	const dateIdx = header.indexOf('Date');
	const tempIdx = header.indexOf('tre200s0');
	if (idIdx < 0 || dateIdx < 0 || tempIdx < 0) return map;

	for (const line of lines.slice(1)) {
		const cells = splitCsvLine(line);
		const id = cells[idIdx]?.trim();
		const temperature = parseNumber(cells[tempIdx]);
		if (!id || temperature == null) continue;
		map.set(id, {
			temperature,
			observedAt: parseVqhaDate(cells[dateIdx]?.trim() ?? '')
		});
	}
	return map;
}

async function fetchSwissMetNet(place: Place, signal?: AbortSignal): Promise<StationObservation | null> {
	const [stations, vqhaBytes] = await Promise.all([
		loadSmnStations(signal),
		fetchBytes(SMN_VQHA80_URL, signal)
	]);
	if (!stations.length) return null;
	const observations = parseVqha80(new TextDecoder('utf-8').decode(vqhaBytes));
	const rows: Candidate[] = [];
	for (const station of stations) {
		const obs = observations.get(station.id);
		if (!obs) continue;
		rows.push({
			id: station.id,
			name: station.name,
			latitude: station.latitude,
			longitude: station.longitude,
			temperature: obs.temperature,
			observedAt: obs.observedAt,
			source: 'meteoswiss'
		});
	}
	return pickNearest(place, rows);
}

interface MetarRow {
	icaoId?: string;
	name?: string;
	temp?: number | null;
	lat?: number;
	lon?: number;
	reportTime?: string;
	obsTime?: number;
}

async function fetchMetarJson(url: string, signal?: AbortSignal): Promise<MetarRow[]> {
	const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
	if (!response.ok) throw new Error(`Anfrage fehlgeschlagen (${response.status})`);
	const data = (await response.json()) as MetarRow[] | { features?: unknown };
	return Array.isArray(data) ? data : [];
}

function metarObservedAt(row: MetarRow): string | null {
	if (row.reportTime) {
		const parsed = Date.parse(row.reportTime);
		if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
	}
	if (typeof row.obsTime === 'number' && Number.isFinite(row.obsTime) && row.obsTime > 1e9) {
		return new Date(row.obsTime * 1000).toISOString();
	}
	return null;
}

async function fetchMetar(place: Place, signal?: AbortSignal): Promise<StationObservation | null> {
	const minLat = place.latitude - METAR_BBOX_DEG;
	const minLon = place.longitude - METAR_BBOX_DEG;
	const maxLat = place.latitude + METAR_BBOX_DEG;
	const maxLon = place.longitude + METAR_BBOX_DEG;
	const bbox = `${minLat},${minLon},${maxLat},${maxLon}`;
	const query = `bbox=${encodeURIComponent(bbox)}&format=json`;
	const rows = await fetchMetarJson(`${METAR_URL}?${query}`, signal).catch(() =>
		fetchMetarJson(`${METAR_PROXY}?${query}`, signal)
	);

	const candidates: Candidate[] = [];
	for (const row of rows) {
		const temperature = typeof row.temp === 'number' && Number.isFinite(row.temp) ? row.temp : null;
		const latitude = typeof row.lat === 'number' ? row.lat : null;
		const longitude = typeof row.lon === 'number' ? row.lon : null;
		const id = row.icaoId?.trim();
		const name = row.name?.trim() || id;
		if (temperature == null || latitude == null || longitude == null || !id || !name) continue;
		candidates.push({
			id,
			name,
			latitude,
			longitude,
			temperature,
			observedAt: metarObservedAt(row),
			source: 'metar'
		});
	}
	return pickNearest(place, candidates);
}

export async function fetchNearestStation(
	place: Place,
	signal?: AbortSignal
): Promise<StationObservation | null> {
	try {
		if (isSwitzerland(place)) {
			const swiss = await fetchSwissMetNet(place, signal);
			if (swiss) return swiss;
			return null;
		}
	} catch {
		/* official SMN unavailable — do not invent or silently switch source in CH */
		if (isSwitzerland(place)) return null;
	}

	try {
		return await fetchMetar(place, signal);
	} catch {
		return null;
	}
}
