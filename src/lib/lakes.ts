import { haversineKm } from './geo';
import type { LakeSnapshot, Place } from './types';

export interface LakeRef {
	id: string;
	name: string;
	latitude: number;
	longitude: number;
	/** BAFU station that measures water temperature at/near the outlet. */
	tempStationId: string | null;
	tempStationLabel: string | null;
}

export const CH_LAKES: LakeRef[] = [
	{
		id: 'zuerich',
		name: 'Zürichsee',
		latitude: 47.31,
		longitude: 8.58,
		tempStationId: '2243',
		tempStationLabel: 'Limmat, Baden (Auslauf)'
	},
	{
		id: 'vierwald',
		name: 'Vierwaldstättersee',
		latitude: 47.0,
		longitude: 8.4,
		tempStationId: '2152',
		tempStationLabel: 'Reuss, Luzern (Auslauf)'
	},
	{
		id: 'genf',
		name: 'Genfersee',
		latitude: 46.45,
		longitude: 6.52,
		tempStationId: '2606',
		tempStationLabel: 'Rhône, Genf (Auslauf)'
	},
	{
		id: 'boden',
		name: 'Bodensee',
		latitude: 47.58,
		longitude: 9.42,
		tempStationId: '2288',
		tempStationLabel: 'Rhein, Neuhausen (Auslauf)'
	},
	{
		id: 'neuenburg',
		name: 'Neuenburgersee',
		latitude: 46.9,
		longitude: 6.84,
		tempStationId: '2029',
		tempStationLabel: 'Aare, Brügg (nach den Jurarandseen)'
	},
	{
		id: 'thun',
		name: 'Thunersee',
		latitude: 46.69,
		longitude: 7.72,
		tempStationId: '2030',
		tempStationLabel: 'Aare, Thun (Auslauf)'
	},
	{
		id: 'brienzer',
		name: 'Brienzersee',
		latitude: 46.72,
		longitude: 7.97,
		tempStationId: '2457',
		tempStationLabel: 'Aare, Ringgenberg (Auslauf)'
	},
	{
		id: 'maggiore',
		name: 'Lago Maggiore',
		latitude: 46.15,
		longitude: 8.78,
		tempStationId: '2068',
		tempStationLabel: 'Ticino, Riazzino'
	},
	{
		id: 'lugano',
		name: 'Luganersee',
		latitude: 46.0,
		longitude: 8.97,
		tempStationId: '2167',
		tempStationLabel: 'Tresa, Ponte Tresa (Auslauf)'
	},
	{
		id: 'walen',
		name: 'Walensee',
		latitude: 47.12,
		longitude: 9.2,
		tempStationId: '2104',
		tempStationLabel: 'Linth, Weesen (Auslauf)'
	},
	{
		id: 'zug',
		name: 'Zugersee',
		latitude: 47.15,
		longitude: 8.48,
		tempStationId: null,
		tempStationLabel: null
	},
	{
		id: 'biel',
		name: 'Bielersee',
		latitude: 47.08,
		longitude: 7.17,
		tempStationId: '2085',
		tempStationLabel: 'Aare, Hagneck'
	}
];

export function nearestLakes(place: Place, maxKm = 80, limit = 2): (LakeRef & { distanceKm: number })[] {
	return CH_LAKES.map((lake) => ({
		...lake,
		distanceKm: haversineKm(place.latitude, place.longitude, lake.latitude, lake.longitude)
	}))
		.filter((lake) => lake.distanceKm <= maxKm)
		.sort((a, b) => a.distanceKm - b.distanceKm)
		.slice(0, limit);
}

const LINDAS = 'https://lindas.admin.ch/query';
const EXISTENZ = 'https://api.existenz.ch/apiv1/hydro/latest';

interface SparqlBinding {
	id?: { value: string };
	temp?: { value: string };
}

async function tempsFromLindas(ids: string[], signal?: AbortSignal): Promise<Map<string, number>> {
	const list = ids.map((id) => Number(id)).filter((id) => Number.isFinite(id));
	if (!list.length) return new Map();
	const query = `
PREFIX hd: <https://environment.ld.admin.ch/foen/hydro/dimension/>
PREFIX schema: <http://schema.org/>
SELECT ?id ?temp WHERE {
  GRAPH <https://lindas.admin.ch/foen/hydro> {
    ?st schema:identifier ?id .
    ?obs hd:station ?st ; hd:waterTemperature ?temp .
    FILTER(?id IN (${list.join(', ')}))
  }
}`;
	const url = new URL(LINDAS);
	url.searchParams.set('query', query);
	const response = await fetch(url.toString(), {
		signal,
		headers: { Accept: 'application/sparql-results+json', 'User-Agent': 'weatherapp/1.0' }
	});
	if (!response.ok) throw new Error('LINDAS');
	const data = (await response.json()) as { results?: { bindings?: SparqlBinding[] } };
	const map = new Map<string, number>();
	for (const row of data.results?.bindings ?? []) {
		const id = row.id?.value;
		const temp = Number(row.temp?.value);
		if (id && Number.isFinite(temp)) map.set(id, temp);
	}
	return map;
}

async function tempsFromExistenz(ids: string[], signal?: AbortSignal): Promise<Map<string, number>> {
	const url = new URL(EXISTENZ);
	url.searchParams.set('locations', ids.join(','));
	url.searchParams.set('parameters', 'temperature');
	const response = await fetch(url.toString(), { signal, headers: { Accept: 'application/json' } });
	if (!response.ok) throw new Error('Existenz');
	const data = (await response.json()) as { payload?: { loc: string; par: string; val: number }[] };
	const map = new Map<string, number>();
	for (const row of data.payload ?? []) {
		if (row.par === 'temperature' && Number.isFinite(row.val)) map.set(String(row.loc), row.val);
	}
	return map;
}

export async function fetchBafuLakeTemps(ids: string[], signal?: AbortSignal): Promise<Map<string, number>> {
	const unique = [...new Set(ids.filter(Boolean))];
	if (!unique.length) return new Map();
	try {
		const lindas = await tempsFromLindas(unique, signal);
		if (lindas.size) return lindas;
	} catch {
		/* official SPARQL can fail; Existenz republishes the same BAFU values */
	}
	try {
		return await tempsFromExistenz(unique, signal);
	} catch {
		return new Map();
	}
}

export function toLakeSnapshot(
	lake: LakeRef & { distanceKm: number },
	marine: { waterTemp: number | null; waveHeight: number | null },
	bafuTemp: number | null
): LakeSnapshot | null {
	const waterTemp = bafuTemp ?? marine.waterTemp ?? null;
	const waveHeight = marine.waveHeight ?? null;
	if (waterTemp == null && waveHeight == null) return null;
	return {
		id: lake.id,
		name: lake.name,
		distanceKm: lake.distanceKm,
		waterTemp,
		waveHeight,
		tempSource:
			waterTemp == null
				? null
				: bafuTemp != null && lake.tempStationLabel
					? `BAFU ${lake.tempStationLabel}`
					: 'Open-Meteo Marine'
	};
}
