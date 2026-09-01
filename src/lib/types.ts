export interface Place {
	id?: number;
	name: string;
	latitude: number;
	longitude: number;
	country?: string;
	country_code?: string;
	admin1?: string;
	timezone?: string;
}

export interface ForecastCurrent {
	time: string;
	temperature_2m: number;
	relative_humidity_2m: number;
	apparent_temperature: number;
	weather_code: number;
	wind_speed_10m: number;
	wind_direction_10m: number;
	wind_gusts_10m: number;
	is_day: number;
	precipitation: number;
	pressure_msl: number;
	cloud_cover: number;
}

export interface ForecastHourly {
	time: string[];
	temperature_2m: number[];
	weather_code: number[];
	precipitation_probability: (number | null)[];
	precipitation: number[];
	wind_speed_10m: number[];
	is_day: number[];
	relative_humidity_2m: number[];
	apparent_temperature: number[];
	uv_index: (number | null)[];
}

export interface ForecastDaily {
	time: string[];
	weather_code: number[];
	temperature_2m_max: number[];
	temperature_2m_min: number[];
	precipitation_sum: number[];
	precipitation_probability_max: (number | null)[];
	sunrise: string[];
	sunset: string[];
	uv_index_max: (number | null)[];
	wind_speed_10m_max: number[];
}

export interface ForecastResponse {
	latitude: number;
	longitude: number;
	timezone: string;
	current: ForecastCurrent;
	hourly: ForecastHourly;
	daily: ForecastDaily;
}

export interface AirQualityCurrent {
	time: string;
	european_aqi: number | null;
	pm2_5: number | null;
	pm10: number | null;
	uv_index: number | null;
}

export interface AirQualityHourly {
	time: string[];
	european_aqi: (number | null)[];
	pm2_5: (number | null)[];
	alder_pollen: (number | null)[];
	birch_pollen: (number | null)[];
	grass_pollen: (number | null)[];
}

export interface AirQualityResponse {
	current?: AirQualityCurrent;
	hourly?: AirQualityHourly;
}

export interface GeocodingResponse {
	results?: Place[];
}

export interface HourPoint {
	time: string;
	temperature: number;
	feelsLike: number;
	code: number;
	precipProb: number;
	precipMm: number;
	wind: number;
	humidity: number;
	isDay: boolean;
	uv: number | null;
}

export interface DayPoint {
	date: string;
	code: number;
	tMax: number;
	tMin: number;
	precipMm: number;
	precipProb: number;
	sunrise: string;
	sunset: string;
	uvMax: number | null;
	windMax: number;
}

export interface WeatherBundle {
	place: Place;
	timezone: string;
	current: ForecastCurrent;
	hours: HourPoint[];
	allHours?: HourPoint[];
	days: DayPoint[];
	air: AirQualityCurrent | null;
	pollen: {
		alder: number | null;
		birch: number | null;
		grass: number | null;
	};
	fetchedAt: string;
}

export type ThemePreference = 'light' | 'dark' | 'system';
