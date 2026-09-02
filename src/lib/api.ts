import { fetchBafuLakeTemps, nearestLakes, toLakeSnapshot } from './lakes';
import type {
	AirQualityResponse,
	AirTrendPoint,
	DayPoint,
	ElevationSnapshot,
	ForecastResponse,
	GeocodingResponse,
	HourPoint,
	LakeSnapshot,
	MinutePoint,
	Place,
	WeatherBundle
} from './types';

export const BERN: Place = {
	id: 2661552,
	name: 'Bern',
	latitude: 46.948,
	longitude: 7.4474,
	country: 'Schweiz',
	country_code: 'CH',
	admin1: 'Bern',
	timezone: 'Europe/Zurich'
};

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const REVERSE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';
const AIR_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine';

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
	const response = await fetch(url, { signal });
	if (!response.ok) {
		throw new Error(`Anfrage fehlgeschlagen (${response.status})`);
	}
	return (await response.json()) as T;
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
	const name = query.trim();
	if (name.length < 2) return [];
	const url = new URL(GEO_URL);
	url.searchParams.set('name', name);
	url.searchParams.set('count', '8');
	url.searchParams.set('language', 'de');
	url.searchParams.set('format', 'json');
	const data = await getJson<GeocodingResponse>(url.toString(), signal);
	return data.results ?? [];
}

interface ReverseGeocodeResponse {
	city?: string;
	locality?: string;
	principalSubdivision?: string;
	countryName?: string;
	countryCode?: string;
}

export async function reverseGeocode(
	latitude: number,
	longitude: number,
	signal?: AbortSignal
): Promise<Place> {
	const url = new URL(REVERSE_URL);
	url.searchParams.set('latitude', String(latitude));
	url.searchParams.set('longitude', String(longitude));
	url.searchParams.set('localityLanguage', 'de');
	try {
		const data = await getJson<ReverseGeocodeResponse>(url.toString(), signal);
		const name = data.city || data.locality || 'Aktueller Standort';
		return {
			name,
			latitude,
			longitude,
			admin1: data.principalSubdivision,
			country: data.countryName,
			country_code: data.countryCode
		};
	} catch {
		return {
			name: 'Aktueller Standort',
			latitude,
			longitude
		};
	}
}

function mapHour(hourly: ForecastResponse['hourly'], index: number): HourPoint {
	return {
		time: hourly.time[index],
		temperature: hourly.temperature_2m[index],
		feelsLike: hourly.apparent_temperature[index],
		code: hourly.weather_code[index],
		precipProb: hourly.precipitation_probability[index] ?? null,
		precipMm: hourly.precipitation[index] ?? 0,
		wind: hourly.wind_speed_10m[index],
		humidity: hourly.relative_humidity_2m[index],
		isDay: hourly.is_day[index] === 1,
		uv: hourly.uv_index[index] ?? null,
		windDir: hourly.wind_direction_10m?.[index] ?? null,
		gusts: hourly.wind_gusts_10m?.[index] ?? null,
		cloud: hourly.cloud_cover?.[index] ?? null,
		visibility: hourly.visibility?.[index] ?? null,
		cape: hourly.cape?.[index] ?? null,
		freezingLevel: hourly.freezing_level_height?.[index] ?? null,
		snowfall: hourly.snowfall?.[index] ?? null,
		dewPoint: hourly.dew_point_2m?.[index] ?? null
	};
}

function mapAllHours(forecast: ForecastResponse): HourPoint[] {
	return forecast.hourly.time.map((_, index) => mapHour(forecast.hourly, index));
}

function sliceHours(forecast: ForecastResponse, allHours: HourPoint[]): HourPoint[] {
	const now = new Date(forecast.current.time).getTime();
	let start = allHours.findIndex((hour) => new Date(hour.time).getTime() >= now);
	if (start < 0) start = 0;
	return allHours.slice(start, start + 24);
}

function mapMinutes(forecast: ForecastResponse): MinutePoint[] {
	const minutely = forecast.minutely_15;
	if (!minutely?.time?.length) return [];
	const now = new Date(forecast.current.time).getTime();
	const points = minutely.time.map((time, index) => ({
		time,
		temperature: minutely.temperature_2m?.[index] ?? null,
		precipMm: minutely.precipitation?.[index] ?? null,
		wind: minutely.wind_speed_10m?.[index] ?? null,
		cape: minutely.cape?.[index] ?? null,
		code: minutely.weather_code?.[index] ?? null,
		snowfall: minutely.snowfall?.[index] ?? null
	}));
	let start = points.findIndex((point) => new Date(point.time).getTime() >= now);
	if (start < 0) start = 0;
	return points.slice(start, start + 8);
}

function mapDays(forecast: ForecastResponse): DayPoint[] {
	const { daily } = forecast;
	const limit = Math.min(10, daily.time?.length ?? 0);
	const days: DayPoint[] = [];
	for (let i = 0; i < limit; i++) {
		const date = daily.time[i];
		const tMax = daily.temperature_2m_max?.[i];
		const tMin = daily.temperature_2m_min?.[i];
		const code = daily.weather_code?.[i];
		if (!date || tMax == null || tMin == null || code == null) continue;
		days.push({
			date,
			code,
			tMax,
			tMin,
			precipMm: daily.precipitation_sum?.[i] ?? 0,
			precipProb: daily.precipitation_probability_max?.[i] ?? null,
			sunrise: daily.sunrise?.[i] ?? '',
			sunset: daily.sunset?.[i] ?? '',
			uvMax: daily.uv_index_max?.[i] ?? null,
			windMax: daily.wind_speed_10m_max?.[i] ?? 0
		});
	}
	return days;
}

function currentPollen(air: AirQualityResponse | null): WeatherBundle['pollen'] {
	const hourly = air?.hourly;
	if (!hourly?.time.length) {
		return { alder: null, birch: null, grass: null };
	}
	const now = Date.now();
	let idx = hourly.time.findIndex((iso) => new Date(iso).getTime() >= now);
	if (idx < 0) idx = 0;
	return {
		alder: hourly.alder_pollen?.[idx] ?? null,
		birch: hourly.birch_pollen?.[idx] ?? null,
		grass: hourly.grass_pollen?.[idx] ?? null
	};
}

function mapAirTrend(air: AirQualityResponse | null): AirTrendPoint[] {
	const hourly = air?.hourly;
	if (!hourly?.time.length) return [];
	const now = Date.now();
	let idx = hourly.time.findIndex((iso) => new Date(iso).getTime() >= now);
	if (idx < 0) idx = 0;
	return hourly.time.slice(idx, idx + 12).map((time, offset) => ({
		time,
		aqi: hourly.european_aqi?.[idx + offset] ?? null,
		pm25: hourly.pm2_5?.[idx + offset] ?? null
	}));
}

function forecastUrlFor(place: Place): URL {
	const forecastUrl = new URL(FORECAST_URL);
	forecastUrl.searchParams.set('latitude', String(place.latitude));
	forecastUrl.searchParams.set('longitude', String(place.longitude));
	forecastUrl.searchParams.set(
		'current',
		[
			'temperature_2m',
			'relative_humidity_2m',
			'apparent_temperature',
			'weather_code',
			'wind_speed_10m',
			'wind_direction_10m',
			'wind_gusts_10m',
			'is_day',
			'precipitation',
			'pressure_msl',
			'cloud_cover'
		].join(',')
	);
	forecastUrl.searchParams.set(
		'hourly',
		[
			'temperature_2m',
			'weather_code',
			'precipitation_probability',
			'precipitation',
			'wind_speed_10m',
			'wind_direction_10m',
			'wind_gusts_10m',
			'is_day',
			'relative_humidity_2m',
			'apparent_temperature',
			'uv_index',
			'cloud_cover',
			'visibility',
			'cape',
			'freezing_level_height',
			'snowfall',
			'dew_point_2m'
		].join(',')
	);
	forecastUrl.searchParams.set(
		'minutely_15',
		'temperature_2m,precipitation,weather_code,wind_speed_10m,cape,snowfall'
	);
	forecastUrl.searchParams.set(
		'daily',
		[
			'weather_code',
			'temperature_2m_max',
			'temperature_2m_min',
			'precipitation_sum',
			'precipitation_probability_max',
			'sunrise',
			'sunset',
			'uv_index_max',
			'wind_speed_10m_max'
		].join(',')
	);
	forecastUrl.searchParams.set('timezone', 'auto');
	forecastUrl.searchParams.set('forecast_days', '10');
	forecastUrl.searchParams.set('wind_speed_unit', 'kmh');
	forecastUrl.searchParams.set('models', 'best_match');
	return forecastUrl;
}

interface ElevationCurrent {
	elevation?: number;
	current?: {
		temperature_2m: number;
		wind_speed_10m: number;
		wind_direction_10m: number;
		relative_humidity_2m: number;
	};
}

async function fetchElevations(place: Place, signal?: AbortSignal): Promise<ElevationSnapshot[]> {
	const elevations = [800, 1500, 2500];
	const url = new URL(FORECAST_URL);
	url.searchParams.set('latitude', elevations.map(() => place.latitude).join(','));
	url.searchParams.set('longitude', elevations.map(() => place.longitude).join(','));
	url.searchParams.set('elevation', elevations.join(','));
	url.searchParams.set('current', 'temperature_2m,wind_speed_10m,wind_direction_10m,relative_humidity_2m');
	url.searchParams.set('wind_speed_unit', 'kmh');
	url.searchParams.set('models', 'best_match');
	try {
		const data = await getJson<ElevationCurrent | ElevationCurrent[]>(url.toString(), signal);
		const points = Array.isArray(data) ? data : [data];
		return elevations.map((elevation, index) => {
			const point = points[index];
			return {
				elevation,
				temperature: point?.current?.temperature_2m ?? null,
				wind: point?.current?.wind_speed_10m ?? null,
				windDir: point?.current?.wind_direction_10m ?? null,
				humidity: point?.current?.relative_humidity_2m ?? null
			};
		});
	} catch {
		return elevations.map((elevation) => ({
			elevation,
			temperature: null,
			wind: null,
			windDir: null,
			humidity: null
		}));
	}
}

interface MarineCurrent {
	latitude?: number;
	longitude?: number;
	current?: {
		wave_height?: number | null;
		sea_surface_temperature?: number | null;
	};
}

async function fetchLakes(place: Place, signal?: AbortSignal): Promise<LakeSnapshot[]> {
	const lakes = nearestLakes(place);
	if (!lakes.length) return [];
	const url = new URL(MARINE_URL);
	url.searchParams.set('latitude', lakes.map((lake) => lake.latitude).join(','));
	url.searchParams.set('longitude', lakes.map((lake) => lake.longitude).join(','));
	url.searchParams.set('current', 'wave_height,sea_surface_temperature');
	url.searchParams.set('timezone', 'auto');
	const [marineResult, bafuTemps] = await Promise.all([
		getJson<MarineCurrent | MarineCurrent[]>(url.toString(), signal)
			.then((data) => (Array.isArray(data) ? data : [data]))
			.catch(() => [] as MarineCurrent[]),
		fetchBafuLakeTemps(
			lakes.map((lake) => lake.tempStationId).filter((id): id is string => Boolean(id)),
			signal
		)
	]);
	return lakes
		.map((lake, index) =>
			toLakeSnapshot(
				lake,
				{
					waterTemp: marineResult[index]?.current?.sea_surface_temperature ?? null,
					waveHeight: marineResult[index]?.current?.wave_height ?? null
				},
				lake.tempStationId ? (bafuTemps.get(lake.tempStationId) ?? null) : null
			)
		)
		.filter((lake): lake is LakeSnapshot => lake != null);
}

function buildBundle(
	place: Place,
	forecast: ForecastResponse,
	air: AirQualityResponse | null,
	elevations: ElevationSnapshot[],
	lakes: LakeSnapshot[]
): WeatherBundle {
	const allHours = mapAllHours(forecast);
	return {
		place,
		timezone: forecast.timezone,
		current: forecast.current,
		hours: sliceHours(forecast, allHours),
		allHours,
		minutes: mapMinutes(forecast),
		days: mapDays(forecast),
		air: air?.current ?? null,
		pollen: currentPollen(air),
		airTrend: mapAirTrend(air),
		elevations,
		lakes,
		fetchedAt: new Date().toISOString()
	};
}

export async function fetchWeather(place: Place, signal?: AbortSignal): Promise<WeatherBundle> {
	const airUrl = new URL(AIR_URL);
	airUrl.searchParams.set('latitude', String(place.latitude));
	airUrl.searchParams.set('longitude', String(place.longitude));
	airUrl.searchParams.set('current', 'european_aqi,pm2_5,pm10,uv_index');
	airUrl.searchParams.set('hourly', 'european_aqi,pm2_5,alder_pollen,birch_pollen,grass_pollen');
	airUrl.searchParams.set('timezone', 'auto');
	airUrl.searchParams.set('forecast_days', '2');

	const [forecast, air] = await Promise.all([
		getJson<ForecastResponse>(forecastUrlFor(place).toString(), signal).catch(async () => {
			const fallback = forecastUrlFor(place);
			fallback.searchParams.delete('minutely_15');
			return getJson<ForecastResponse>(fallback.toString(), signal);
		}),
		getJson<AirQualityResponse>(airUrl.toString(), signal).catch(() => null)
	]);

	const [elevations, lakes] = await Promise.all([
		fetchElevations(place, signal),
		fetchLakes(place, signal)
	]);

	return buildBundle(place, forecast, air, elevations, lakes);
}

export async function fetchWeatherLite(place: Place, signal?: AbortSignal): Promise<WeatherBundle> {
	const [forecast, air] = await Promise.all([
		getJson<ForecastResponse>(forecastUrlFor(place).toString(), signal),
		Promise.resolve(null)
	]);
	return buildBundle(place, forecast, air, [], []);
}

function fillHour(hour: HourPoint): HourPoint {
	return {
		...hour,
		windDir: hour.windDir ?? null,
		gusts: hour.gusts ?? null,
		cloud: hour.cloud ?? null,
		visibility: hour.visibility ?? null,
		cape: hour.cape ?? null,
		freezingLevel: hour.freezingLevel ?? null,
		snowfall: hour.snowfall ?? null,
		dewPoint: hour.dewPoint ?? null
	};
}

export function emptyExtras(bundle: WeatherBundle): WeatherBundle {
	return {
		...bundle,
		hours: (bundle.hours ?? []).map(fillHour),
		minutes: bundle.minutes ?? [],
		airTrend: bundle.airTrend ?? [],
		elevations: bundle.elevations ?? [],
		lakes: (bundle.lakes ?? [])
			.filter((lake) => lake.waterTemp != null || lake.waveHeight != null)
			.map((lake) => ({
				...lake,
				tempSource: lake.tempSource ?? null
			})),
		allHours: (bundle.allHours ?? bundle.hours ?? []).map(fillHour)
	};
}
