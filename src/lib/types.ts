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
	wind_direction_10m?: (number | null)[];
	wind_gusts_10m?: (number | null)[];
	is_day: number[];
	relative_humidity_2m: number[];
	apparent_temperature: number[];
	uv_index: (number | null)[];
	cloud_cover?: (number | null)[];
	visibility?: (number | null)[];
	cape?: (number | null)[];
	freezing_level_height?: (number | null)[];
	snowfall?: (number | null)[];
	dew_point_2m?: (number | null)[];
}

export interface ForecastMinutely {
	time: string[];
	temperature_2m?: (number | null)[];
	precipitation?: (number | null)[];
	weather_code?: (number | null)[];
	wind_speed_10m?: (number | null)[];
	cape?: (number | null)[];
	snowfall?: (number | null)[];
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
	elevation?: number;
	current: ForecastCurrent;
	hourly: ForecastHourly;
	minutely_15?: ForecastMinutely;
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
	windDir: number | null;
	gusts: number | null;
	cloud: number | null;
	visibility: number | null;
	cape: number | null;
	freezingLevel: number | null;
	snowfall: number | null;
	dewPoint: number | null;
}

export interface MinutePoint {
	time: string;
	temperature: number | null;
	precipMm: number;
	wind: number | null;
	cape: number | null;
	code: number | null;
	snowfall: number | null;
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

export interface ElevationSnapshot {
	elevation: number;
	temperature: number | null;
	wind: number | null;
	windDir: number | null;
	humidity: number | null;
}

export interface LakeSnapshot {
	id: string;
	name: string;
	distanceKm: number;
	waterTemp: number | null;
	waveHeight: number | null;
	fogRisk: boolean;
	fogLabel: string;
}

export interface AirTrendPoint {
	time: string;
	aqi: number | null;
	pm25: number | null;
}

export interface WeatherBundle {
	place: Place;
	timezone: string;
	current: ForecastCurrent;
	hours: HourPoint[];
	allHours?: HourPoint[];
	minutes: MinutePoint[];
	days: DayPoint[];
	air: AirQualityCurrent | null;
	pollen: {
		alder: number | null;
		birch: number | null;
		grass: number | null;
	};
	airTrend: AirTrendPoint[];
	elevations: ElevationSnapshot[];
	lakes: LakeSnapshot[];
	fetchedAt: string;
}

export type ThemePreference = 'light' | 'dark' | 'system';

export interface NotifyPrefs {
	rainSoon: boolean;
	warnings: boolean;
	frost: boolean;
	uv: boolean;
	air: boolean;
	dailyBrief: boolean;
}

export interface AlertItem {
	id: string;
	event: string;
	headline: string;
	severity: 'minor' | 'moderate' | 'severe' | 'extreme' | 'unknown';
	onset: string | null;
	expires: string | null;
	area: string | null;
	source: string;
}

export interface AvalancheBulletin {
	available: boolean;
	level: number | null;
	label: string;
	validUntil: string | null;
	source: string;
	note: string;
}
