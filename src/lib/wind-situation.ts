import { inMittelland, isSwitzerland, southOfAlps } from './geo';
import type { Place, WeatherBundle } from './types';

export interface NamedWind {
	name: string;
	detail: string;
	confidence: 'hoch' | 'mittel' | 'niedrig';
	uncertain: boolean;
}

function dirBetween(degrees: number, from: number, to: number): boolean {
	const d = ((degrees % 360) + 360) % 360;
	if (from <= to) return d >= from && d <= to;
	return d >= from || d <= to;
}

export function namedWind(place: Place, bundle: WeatherBundle): NamedWind {
	const current = bundle.current;
	const dir = current.wind_direction_10m;
	const speed = current.wind_speed_10m;
	const gusts = current.wind_gusts_10m;
	const hour = bundle.hours[0];
	const humidity = current.relative_humidity_2m;
	const swiss = isSwitzerland(place);

	if (!swiss) {
		return {
			name: 'kein regionaler Name',
			detail: 'Föhn, Bise und Talwind sind Heuristiken für die Schweiz.',
			confidence: 'niedrig',
			uncertain: true
		};
	}

	const mittelland = inMittelland(place.latitude, place.longitude);
	const south = southOfAlps(place.latitude);

	if (mittelland && speed >= 14 && dirBetween(dir, 30, 90)) {
		return {
			name: 'Bise',
			detail: 'Nordostwind über dem Mittelland — oft kühl und trocken. Heuristik aus Richtung und Stärke.',
			confidence: speed >= 22 ? 'hoch' : 'mittel',
			uncertain: speed < 22
		};
	}

	if (!south && speed >= 18 && dirBetween(dir, 150, 210) && (gusts >= 28 || humidity <= 55)) {
		return {
			name: 'Südföhn',
			detail: 'Südströmung, böig und oft milder. Keine offizielle Föhndiagnose.',
			confidence: gusts >= 40 && humidity <= 45 ? 'hoch' : 'mittel',
			uncertain: true
		};
	}

	if (south && speed >= 16 && dirBetween(dir, 330, 30) && humidity <= 60) {
		return {
			name: 'Nordföhn',
			detail: 'Nordströmung südlich der Alpen — meist klarer und trockener. Heuristik.',
			confidence: 'mittel',
			uncertain: true
		};
	}

	const hourOfDay = new Date(current.time).getHours();
	const alpine = !mittelland && place.latitude >= 45.85 && place.latitude <= 47.1;
	if (alpine && speed >= 6 && speed <= 22 && gusts < 35) {
		if (hourOfDay >= 10 && hourOfDay <= 17 && dirBetween(dir, 160, 220)) {
			return {
				name: 'Talwind',
				detail: 'Tageswind talaufwärts möglich — unsicher ohne lokale Talachse.',
				confidence: 'niedrig',
				uncertain: true
			};
		}
		if ((hourOfDay >= 20 || hourOfDay <= 7) && dirBetween(dir, 330, 30)) {
			return {
				name: 'Bergwind',
				detail: 'Nächtlicher Abfluss talabwärts möglich. Heuristik.',
				confidence: 'niedrig',
				uncertain: true
			};
		}
	}

	if (hour && hour.windDir != null && Math.abs(hour.windDir - dir) > 50 && speed >= 10) {
		return {
			name: 'drehender Wind',
			detail: 'Richtung ändert sich — noch keine klare Lage.',
			confidence: 'niedrig',
			uncertain: true
		};
	}

	return {
		name: 'kein markanter Lagewind',
		detail: 'Keine Bise-, Föhn- oder Talwindlage aus Richtung und Stärke ableitbar.',
		confidence: 'mittel',
		uncertain: true
	};
}
