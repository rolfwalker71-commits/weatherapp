const FORECAST = 'https://api.open-meteo.com/v1/forecast';
const AIR = 'https://air-quality-api.open-meteo.com/v1/air-quality';

const WMO = {
	0: 'klar',
	1: 'meist klar',
	2: 'wolkig',
	3: 'bedeckt',
	45: 'Nebel',
	48: 'Nebel',
	51: 'Niesel',
	53: 'Niesel',
	55: 'Niesel',
	61: 'leichter Regen',
	63: 'Regen',
	65: 'starker Regen',
	71: 'Schnee',
	73: 'Schnee',
	75: 'Schnee',
	80: 'Schauer',
	81: 'Schauer',
	82: 'starke Schauer',
	95: 'Gewitter',
	96: 'Gewitter mit Hagel',
	99: 'schweres Gewitter'
};

function wmoLabel(code) {
	if (!Number.isFinite(code) || WMO[code] == null) return null;
	return WMO[code];
}

async function getJson(url) {
	const response = await fetch(url, {
		headers: { Accept: 'application/json', 'User-Agent': 'weatherapp-push/1.0' }
	});
	if (!response.ok) throw new Error(`Wetter ${response.status}`);
	return response.json();
}

export async function fetchPlaceWeather(lat, lon) {
	const forecastUrl = new URL(FORECAST);
	forecastUrl.searchParams.set('latitude', String(lat));
	forecastUrl.searchParams.set('longitude', String(lon));
	forecastUrl.searchParams.set('current', 'temperature_2m,precipitation,weather_code,is_day,apparent_temperature');
	forecastUrl.searchParams.set(
		'hourly',
		'temperature_2m,precipitation,precipitation_probability,uv_index,weather_code,apparent_temperature'
	);
	forecastUrl.searchParams.set('minutely_15', 'precipitation');
	forecastUrl.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code');
	forecastUrl.searchParams.set('timezone', 'auto');
	forecastUrl.searchParams.set('forecast_days', '2');
	forecastUrl.searchParams.set('models', 'best_match');

	const airUrl = new URL(AIR);
	airUrl.searchParams.set('latitude', String(lat));
	airUrl.searchParams.set('longitude', String(lon));
	airUrl.searchParams.set('current', 'european_aqi,uv_index');
	airUrl.searchParams.set('hourly', 'alder_pollen,birch_pollen,grass_pollen');
	airUrl.searchParams.set('timezone', 'auto');
	airUrl.searchParams.set('forecast_days', '1');

	const [forecast, air] = await Promise.all([
		getJson(forecastUrl.toString()),
		getJson(airUrl.toString()).catch(() => null)
	]);

	const now = new Date(forecast.current.time).getTime();
	const hours = (forecast.hourly?.time ?? []).map((time, index) => ({
		time,
		temperature: Number.isFinite(forecast.hourly.temperature_2m?.[index])
			? forecast.hourly.temperature_2m[index]
			: null,
		precipMm: Number.isFinite(forecast.hourly.precipitation?.[index])
			? forecast.hourly.precipitation[index]
			: null,
		precipProb: Number.isFinite(forecast.hourly.precipitation_probability?.[index])
			? forecast.hourly.precipitation_probability[index]
			: null,
		uv: Number.isFinite(forecast.hourly.uv_index?.[index]) ? forecast.hourly.uv_index[index] : null,
		code: Number.isFinite(forecast.hourly.weather_code?.[index]) ? forecast.hourly.weather_code[index] : null
	}));
	let hourStart = hours.findIndex((hour) => new Date(hour.time).getTime() >= now);
	if (hourStart < 0) hourStart = 0;
	const upcoming = hours.slice(hourStart, hourStart + 8);

	const minutes = (forecast.minutely_15?.time ?? []).map((time, index) => ({
		time,
		precipMm: Number.isFinite(forecast.minutely_15.precipitation?.[index])
			? forecast.minutely_15.precipitation[index]
			: null
	}));
	let minuteStart = minutes.findIndex((item) => new Date(item.time).getTime() >= now);
	if (minuteStart < 0) minuteStart = 0;
	const nextHourSamples = minutes.slice(minuteStart, minuteStart + 4).filter((item) => item.precipMm != null);
	const nextHourPrecip = nextHourSamples.length
		? nextHourSamples.reduce((sum, item) => sum + item.precipMm, 0)
		: null;

	const pollenHourly = air?.hourly;
	let pollen = null;
	if (pollenHourly?.time?.length) {
		let idx = pollenHourly.time.findIndex((iso) => new Date(iso).getTime() >= Date.now());
		if (idx < 0) idx = 0;
		const values = [pollenHourly.alder_pollen?.[idx], pollenHourly.birch_pollen?.[idx], pollenHourly.grass_pollen?.[idx]]
			.filter((value) => Number.isFinite(value));
		if (values.length) pollen = Math.max(...values);
	}

	const localHour = Number(
		new Intl.DateTimeFormat('en-GB', {
			hour: '2-digit',
			hourCycle: 'h23',
			timeZone: forecast.timezone
		}).format(new Date())
	);

	return {
		timezone: forecast.timezone,
		localHour,
		current: forecast.current,
		upcoming,
		nextHourPrecip,
		nextHourProb: upcoming[0]?.precipProb ?? null,
		todayMax: Number.isFinite(forecast.daily?.temperature_2m_max?.[0])
			? forecast.daily.temperature_2m_max[0]
			: null,
		todayMin: Number.isFinite(forecast.daily?.temperature_2m_min?.[0])
			? forecast.daily.temperature_2m_min[0]
			: null,
		todayPrecipProb: Number.isFinite(forecast.daily?.precipitation_probability_max?.[0])
			? forecast.daily.precipitation_probability_max[0]
			: null,
		todayCode: Number.isFinite(forecast.daily?.weather_code?.[0])
			? forecast.daily.weather_code[0]
			: forecast.current.weather_code,
		aqi: air?.current?.european_aqi ?? null,
		uvNow: upcoming[0]?.uv ?? air?.current?.uv_index ?? null,
		pollen,
		wmoLabel: wmoLabel(forecast.current.weather_code)
	};
}

export function evaluateNotifications(weather, prefs, alerts) {
	const notices = [];
	const temps = [weather.current.temperature_2m, weather.current.apparent_temperature].filter((value) =>
		Number.isFinite(value)
	);
	const nearFrost = weather.upcoming
		.slice(0, 6)
		.some((hour) => Number.isFinite(hour.temperature) && hour.temperature <= 1.2);
	const frostNow = temps.some((value) => value <= 1.2);

	if (prefs.rain_soon && ((weather.nextHourPrecip != null && weather.nextHourPrecip >= 0.3) || weather.nextHourProb >= 70)) {
		notices.push({
			category: 'rainSoon',
			fingerprint: `rain-${weather.upcoming[0]?.time?.slice(0, 13) || 'now'}`,
			cooldownHours: 3,
			title: 'Regen bald',
			body: weather.nextHourPrecip >= 0.3
				? `Niederschlag in der nächsten Stunde (${weather.nextHourPrecip.toFixed(1)} mm).`
				: `Regenwahrscheinlichkeit ${Math.round(weather.nextHourProb)} % in der nächsten Stunde.`
		});
	}

	if (prefs.warnings) {
		const serious = (alerts || []).filter(
			(alert) => alert?.id && ['moderate', 'severe', 'extreme'].includes(alert.severity)
		);
		for (const alert of serious.slice(0, 2)) {
			notices.push({
				category: 'warnings',
				fingerprint: `warn-${alert.id}`,
				cooldownHours: 6,
				title: alert.event || 'Wetterwarnung',
				body: alert.headline || alert.area || alert.event
			});
		}
	}

	if (prefs.frost && Number.isFinite(weather.current.temperature_2m) && (frostNow || nearFrost)) {
		notices.push({
			category: 'frost',
			fingerprint: `frost-${new Date().toISOString().slice(0, 10)}`,
			cooldownHours: 8,
			title: 'Frost',
			body: `Temperatur ${weather.current.temperature_2m.toFixed(0)}° (Open-Meteo).`
		});
	}

	if (prefs.uv && weather.current.is_day === 1 && weather.uvNow != null && weather.uvNow >= 7) {
		notices.push({
			category: 'uv',
			fingerprint: `uv-${new Date().toISOString().slice(0, 10)}`,
			cooldownHours: 12,
			title: 'UV hoch',
			body: `UV-Index ${weather.uvNow.toFixed(0)} — Sonne meiden, Haut schützen.`
		});
	}

	if (prefs.air && ((weather.aqi != null && weather.aqi >= 60) || (weather.pollen != null && weather.pollen >= 100))) {
		const airBits = [];
		if (weather.aqi != null && weather.aqi >= 60) airBits.push(`Luftqualität ${Math.round(weather.aqi)}`);
		if (weather.pollen != null && weather.pollen >= 100) airBits.push(`Pollen ${Math.round(weather.pollen)}`);
		notices.push({
			category: 'air',
			fingerprint: `air-${new Date().toISOString().slice(0, 10)}`,
			cooldownHours: 8,
			title: 'Luft & Pollen',
			body: `${airBits.join(', ')}.`
		});
	}

	if (
		prefs.daily_brief &&
		weather.localHour >= 6 &&
		weather.localHour <= 9 &&
		Number.isFinite(weather.current.temperature_2m) &&
		weather.todayMin != null &&
		weather.todayMax != null
	) {
		const parts = [
			weather.wmoLabel,
			`${weather.current.temperature_2m.toFixed(0)}°`,
			`heute ${weather.todayMin.toFixed(0)}–${weather.todayMax.toFixed(0)}°`
		];
		if (weather.todayPrecipProb != null) parts.push(`Regen ${Math.round(weather.todayPrecipProb)} %`);
		notices.push({
			category: 'dailyBrief',
			fingerprint: `brief-${new Date().toISOString().slice(0, 10)}`,
			cooldownHours: 20,
			title: 'Morgenbriefing',
			body: `${parts.filter(Boolean).join(', ')}.`
		});
	}

	return notices;
}
