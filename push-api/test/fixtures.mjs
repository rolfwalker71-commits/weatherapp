/** A synthetic Open-Meteo reading in the shape fetchPlaceWeather() returns (Zürich, rain coming at 14:30). */
export function sampleWeather({ rain = true, frost = false, nowLocal = '2026-10-02T14:15' } = {}) {
	const hour = (index) => {
		const h = 14 + index;
		return {
			time: `2026-10-02T${String(h).padStart(2, '0')}:00`,
			temperature: frost ? 1.2 - index * 0.5 : 18 - index * 0.5,
			precipMm: rain && index >= 1 && index <= 3 ? 1.1 : 0,
			precipProb: rain && index >= 1 && index <= 3 ? 80 : 5,
			uv: index < 3 ? 7.4 - index : 2,
			code: rain && index >= 1 ? 63 : 2,
			cloud: 70,
			snowfall: 0,
			isDay: true,
			wind: 12,
			gusts: 25,
			humidity: 60,
			feelsLike: 16
		};
	};
	const slot = (index) => {
		const minutes = 15 * (index % 4);
		const h = 14 + Math.floor(index / 4);
		return {
			time: `2026-10-02T${String(h).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
			precipMm: rain && index >= 3 && index <= 6 ? [0.2, 0.6, 1.2, 0.4][index - 3] : 0
		};
	};
	const minutesAll = Array.from({ length: 16 }, (_, index) => slot(index));
	const current = {
		time: nowLocal,
		temperature_2m: frost ? 1.2 : 18,
		apparent_temperature: frost ? -2 : 17,
		weather_code: rain ? 3 : 2,
		is_day: 1,
		wind_speed_10m: 12,
		relative_humidity_2m: 60,
		cloud_cover: 70,
		precipitation: 0
	};
	return {
		timezone: 'Europe/Zurich',
		// Morning: the daily brief is only sent between 06:00 and 09:00 local time.
		localHour: 7,
		current,
		upcoming: Array.from({ length: 8 }, (_, index) => hour(index)),
		minutes: minutesAll.slice(1, 9),
		minutesAll,
		nowLocal,
		nextHourPrecip: rain ? 2.4 : 0,
		nextHourProb: rain ? 80 : 5,
		todayMax: 19,
		todayMin: 12,
		todayPrecipProb: 80,
		todaySunrise: '2026-10-02T07:30',
		todaySunset: '2026-10-02T19:08',
		todayCode: 3,
		aqi: 65,
		uvNow: 7.4,
		pollen: 120,
		wmoLabel: 'bedeckt'
	};
}

export const prefsAll = {
	client_id: 'c1',
	rain_soon: 1,
	warnings: 1,
	frost: 1,
	uv: 1,
	air: 1,
	daily_brief: 1,
	forecast_change: 0,
	latitude: 47.3769,
	longitude: 8.5417,
	place_name: 'Zürich',
	timezone: 'Europe/Zurich'
};

export const severeAlert = {
	id: 'alert-1',
	event: 'Gewitterwarnung',
	headline: 'Hagel und Sturmböen möglich',
	severity: 'severe',
	onset: '2026-10-02T13:00:00+02:00',
	expires: '2026-10-02T21:00:00+02:00',
	area: 'Kanton Zürich',
	source: 'MeteoSchweiz'
};
