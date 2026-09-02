import { haversineKm } from './geo';
import type { LakeSnapshot, Place } from './types';

export interface LakeRef {
	id: string;
	name: string;
	latitude: number;
	longitude: number;
}

export const CH_LAKES: LakeRef[] = [
	{ id: 'zuerich', name: 'Zürichsee', latitude: 47.31, longitude: 8.58 },
	{ id: 'vierwald', name: 'Vierwaldstättersee', latitude: 47.0, longitude: 8.4 },
	{ id: 'genf', name: 'Genfersee', latitude: 46.45, longitude: 6.52 },
	{ id: 'boden', name: 'Bodensee', latitude: 47.58, longitude: 9.42 },
	{ id: 'neuenburg', name: 'Neuenburgersee', latitude: 46.9, longitude: 6.84 },
	{ id: 'thun', name: 'Thunersee', latitude: 46.69, longitude: 7.72 },
	{ id: 'brienzer', name: 'Brienzersee', latitude: 46.72, longitude: 7.97 },
	{ id: 'maggiore', name: 'Lago Maggiore', latitude: 46.15, longitude: 8.78 },
	{ id: 'lugano', name: 'Luganersee', latitude: 46.0, longitude: 8.97 },
	{ id: 'walen', name: 'Walensee', latitude: 47.12, longitude: 9.2 },
	{ id: 'zug', name: 'Zugersee', latitude: 47.15, longitude: 8.48 },
	{ id: 'biel', name: 'Bielersee', latitude: 47.08, longitude: 7.17 }
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

export function lakeFogLabel(opts: {
	humidity: number;
	wind: number;
	temp: number;
	dewPoint: number | null;
	isDay: boolean;
}): { fogRisk: boolean; fogLabel: string } {
	const spread = opts.dewPoint == null ? 99 : Math.abs(opts.temp - opts.dewPoint);
	const fogRisk = opts.humidity >= 88 && opts.wind <= 10 && spread <= 2.2;
	if (fogRisk) {
		return {
			fogRisk: true,
			fogLabel: opts.isDay ? 'Seenebel möglich, Sicht eingeschränkt' : 'Seenebel in der Nacht/am Morgen wahrscheinlich'
		};
	}
	if (opts.humidity >= 80 && opts.wind <= 14) {
		return { fogRisk: false, fogLabel: 'Dunst über dem See möglich' };
	}
	return { fogRisk: false, fogLabel: 'Keine klare Nebellage' };
}

export function toLakeSnapshot(
	lake: LakeRef & { distanceKm: number },
	marine: { waterTemp: number | null; waveHeight: number | null },
	fog: { fogRisk: boolean; fogLabel: string }
): LakeSnapshot {
	return {
		id: lake.id,
		name: lake.name,
		distanceKm: lake.distanceKm,
		waterTemp: marine.waterTemp,
		waveHeight: marine.waveHeight,
		fogRisk: fog.fogRisk,
		fogLabel: fog.fogLabel
	};
}
