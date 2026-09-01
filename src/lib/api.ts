import type {
	AirQualityResponse,
	DayPoint,
	ForecastResponse,
	GeocodingResponse,
	HourPoint,
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
		precipProb: hourly.precipitation_probability[index] ?? 0,
		precipMm: hourly.precipitation[index] ?? 0,
		wind: hourly.wind_speed_10m[index],
		humidity: hourly.relative_humidity_2m[index],
		isDay: hourly.is_day[index] === 1,
		uv: hourly.uv_index[index] ?? null
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

function mapDays(forecast: ForecastResponse): DayPoint[] {
	const { daily } = forecast;
	return daily.time.slice(0, 7).map((date, i) => ({
		date,
		code: daily.weather_code[i],
		tMax: daily.temperature_2m_max[i],
		tMin: daily.temperature_2m_min[i],
		precipMm: daily.precipitation_sum[i],
		precipProb: daily.precipitation_probability_max[i] ?? 0,
		sunrise: daily.sunrise[i],
		sunset: daily.sunset[i],
		uvMax: daily.uv_index_max[i] ?? null,
		windMax: daily.wind_speed_10m_max[i]
	}));
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

export async function fetchWeather(place: Place, signal?: AbortSignal): Promise<WeatherBundle> {
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
			'is_day',
			'relative_humidity_2m',
			'apparent_temperature',
			'uv_index'
		].join(',')
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
	forecastUrl.searchParams.set('forecast_days', '7');
	forecastUrl.searchParams.set('wind_speed_unit', 'kmh');
	forecastUrl.searchParams.set('models', 'best_match');

	const airUrl = new URL(AIR_URL);
	airUrl.searchParams.set('latitude', String(place.latitude));
	airUrl.searchParams.set('longitude', String(place.longitude));
	airUrl.searchParams.set('current', 'european_aqi,pm2_5,pm10,uv_index');
	airUrl.searchParams.set('hourly', 'european_aqi,pm2_5,alder_pollen,birch_pollen,grass_pollen');
	airUrl.searchParams.set('timezone', 'auto');
	airUrl.searchParams.set('forecast_days', '1');

	const [forecast, air] = await Promise.all([
		getJson<ForecastResponse>(forecastUrl.toString(), signal),
		getJson<AirQualityResponse>(airUrl.toString(), signal).catch(() => null)
	]);

	const allHours = mapAllHours(forecast);

	return {
		place,
		timezone: forecast.timezone,
		current: forecast.current,
		hours: sliceHours(forecast, allHours),
		allHours,
		days: mapDays(forecast),
		air: air?.current ?? null,
		pollen: currentPollen(air),
		fetchedAt: new Date().toISOString()
	};
}
