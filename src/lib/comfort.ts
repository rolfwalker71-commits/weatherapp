import type { WeatherBundle } from './types';

export interface ComfortAdvice {
	apparent: number;
	indexName: string;
	indexValue: number;
	recommendation: string;
	detail: string;
}

function windChill(tempC: number, windKmh: number): number {
	const v = Math.max(windKmh, 4.8);
	return 13.12 + 0.6215 * tempC - 11.37 * v ** 0.16 + 0.3965 * tempC * v ** 0.16;
}

function heatIndex(tempC: number, rh: number): number {
	const t = (tempC * 9) / 5 + 32;
	const hi =
		-42.379 +
		2.04901523 * t +
		10.14333127 * rh -
		0.22475541 * t * rh -
		6.83783e-3 * t ** 2 -
		5.481717e-2 * rh ** 2 +
		1.22874e-3 * t ** 2 * rh +
		8.5282e-4 * t * rh ** 2 -
		1.99e-6 * t ** 2 * rh ** 2;
	return ((hi - 32) * 5) / 9;
}

export function comfortAdvice(bundle: WeatherBundle): ComfortAdvice {
	const current = bundle.current;
	const hour = bundle.hours[0];
	const temp = current.temperature_2m;
	const apparent = current.apparent_temperature;
	const wind = current.wind_speed_10m;
	const rh = current.relative_humidity_2m;
	const uv = hour?.uv ?? bundle.days[0]?.uvMax ?? 0;
	const precipNow = current.precipitation + (hour?.precipMm ?? 0);
	const precipSoon = bundle.hours.slice(0, 3).reduce((sum, item) => sum + item.precipMm, 0);
	const precipProb = Math.max(...bundle.hours.slice(0, 3).map((item) => item.precipProb), 0);

	let indexName = 'gefühlte Temperatur';
	let indexValue = apparent;
	if (temp <= 10 && wind >= 8) {
		indexName = 'Windchill';
		indexValue = windChill(temp, wind);
	} else if (temp >= 27 && rh >= 40) {
		indexName = 'Hitzeindex';
		indexValue = heatIndex(temp, rh);
	}

	let recommendation = 'leichte Kleidung reicht';
	if (precipNow >= 0.4 || (precipSoon >= 0.8 && precipProb >= 50)) {
		recommendation = 'Schirm';
	} else if (uv != null && uv >= 6 && current.is_day === 1) {
		recommendation = 'Sonnencreme';
	} else if (indexValue <= 8 || temp <= 10) {
		recommendation = 'Jacke';
	} else if (indexValue <= 14 || wind >= 28) {
		recommendation = 'leichte Jacke';
	}

	const rounded = Math.round(indexValue);
	return {
		apparent,
		indexName,
		indexValue,
		recommendation,
		detail: `${indexName} ${rounded}° · ${recommendation}`
	};
}
