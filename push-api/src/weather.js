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
	forecastUrl.searchParams.set(
		'current',
		'temperature_2m,precipitation,weather_code,is_day,apparent_temperature,wind_speed_10m,relative_humidity_2m,cloud_cover'
	);
	forecastUrl.searchParams.set(
		'hourly',
		'temperature_2m,precipitation,precipitation_probability,uv_index,weather_code,apparent_temperature,cloud_cover,snowfall,is_day,wind_speed_10m,relative_humidity_2m'
	);
	forecastUrl.searchParams.set('minutely_15', 'precipitation');
	forecastUrl.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code');
	forecastUrl.searchParams.set('timezone', 'auto');
	forecastUrl.searchParams.set('forecast_days', '2');
	forecastUrl.searchParams.set('wind_speed_unit', 'kmh');
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
		code: Number.isFinite(forecast.hourly.weather_code?.[index]) ? forecast.hourly.weather_code[index] : null,
		cloud: Number.isFinite(forecast.hourly.cloud_cover?.[index]) ? forecast.hourly.cloud_cover[index] : null,
		snowfall: Number.isFinite(forecast.hourly.snowfall?.[index]) ? forecast.hourly.snowfall[index] : null,
		isDay: forecast.hourly.is_day?.[index] === 1,
		wind: Number.isFinite(forecast.hourly.wind_speed_10m?.[index]) ? forecast.hourly.wind_speed_10m[index] : null,
		humidity: Number.isFinite(forecast.hourly.relative_humidity_2m?.[index])
			? forecast.hourly.relative_humidity_2m[index]
			: null,
		feelsLike: Number.isFinite(forecast.hourly.apparent_temperature?.[index])
			? forecast.hourly.apparent_temperature[index]
			: null
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
		minutes: minutes.slice(minuteStart, minuteStart + 8),
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

function formatHourLabel(iso) {
	try {
		return new Intl.DateTimeFormat('de-CH', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
	} catch {
		return '';
	}
}

/** Same insight line as the Jetzt hero — only from fetched fields. */
export function insightLine(weather) {
	const now = weather.upcoming[0];
	const later = weather.upcoming[2] ?? weather.upcoming[1];
	if (!now) return weather.wmoLabel || null;

	const phrases = [];
	const laterPrecip = later?.precipMm ?? null;
	const laterProb = later?.precipProb ?? null;

	if (now.precipMm != null && now.precipMm >= 0.3 && laterPrecip != null && laterPrecip < now.precipMm * 0.45) {
		phrases.push('Regen lässt nach');
	} else if (
		(now.precipMm == null || now.precipMm < 0.15) &&
		laterPrecip != null &&
		laterPrecip >= 0.5 &&
		(laterProb == null || laterProb >= 45)
	) {
		const when = later.time ? formatHourLabel(later.time) : '';
		phrases.push(when ? `ab ${when} Regen` : 'bald Regen');
	} else if (now.snowfall != null && now.snowfall >= 0.2) {
		phrases.push('Schnee im Gang');
	}

	const cloudNow = now.cloud ?? weather.current.cloud_cover;
	const clearHour = weather.upcoming.find(
		(hour) => hour.cloud != null && hour.cloud <= 25 && hour.code != null && hour.code <= 1
	);
	if (clearHour && cloudNow != null && cloudNow >= 55) {
		const when = formatHourLabel(clearHour.time);
		if (when) phrases.push(`ab ${when} klar`);
	} else if (cloudNow != null && cloudNow <= 25 && now.code != null && now.code <= 1) {
		phrases.push('weiterhin klar');
	}

	if (now.code != null && now.code >= 95) {
		phrases.push(wmoLabel(now.code) || 'Gewitter');
	}

	if (later && now.temperature != null && later.temperature != null) {
		if (later.temperature - now.temperature >= 3) phrases.push('es wird milder');
		else if (now.temperature - later.temperature >= 3) phrases.push('es kühlt ab');
	}

	const unique = [...new Set(phrases)].slice(0, 2);
	if (unique.length) return unique.join(' · ');
	if (now.code != null && wmoLabel(now.code)) {
		return `${wmoLabel(now.code)} bleibt vorerst ähnlich`;
	}
	return weather.wmoLabel || null;
}

function clothingLine(weather) {
	const current = weather.current;
	const hour = weather.upcoming[0];
	const temp = current.temperature_2m;
	const apparent = current.apparent_temperature;
	if (!Number.isFinite(temp) || !Number.isFinite(apparent)) return null;

	const wind = Number.isFinite(current.wind_speed_10m) ? current.wind_speed_10m : hour?.wind ?? 0;
	const rh = Number.isFinite(current.relative_humidity_2m) ? current.relative_humidity_2m : hour?.humidity ?? 0;
	const uv = hour?.uv ?? null;
	const nowMm = hour?.precipMm ?? 0;
	const precipSoon = weather.upcoming.slice(0, 3).reduce((sum, item) => sum + (item.precipMm ?? 0), 0);
	const precipProb = weather.upcoming
		.slice(0, 3)
		.map((item) => item.precipProb)
		.find((value) => value != null);

	let recommendation = 'leichte Kleidung reicht';
	if (nowMm >= 0.4 || (precipSoon >= 0.8 && precipProb != null && precipProb >= 50)) {
		recommendation = 'Schirm einpacken';
	} else if (uv != null && uv >= 6 && current.is_day === 1) {
		recommendation = 'Sonnencreme';
	} else if (apparent <= 8 || temp <= 10) {
		recommendation = 'Jacke';
	} else if (apparent <= 14 || wind >= 28) {
		recommendation = 'leichte Jacke';
	}

	const rainingNow = nowMm >= 0.4;
	if (!rainingNow && nowMm < 0.25) {
		const onset = weather.upcoming.find((item) => item.precipMm != null && item.precipMm >= 0.4);
		return onset
			? `${recommendation}, trocken bis ${formatHourLabel(onset.time)}`
			: `${recommendation}, trocken`;
	}
	if (rainingNow) return `${recommendation}, jetzt nass`;
	return recommendation;
}

export function briefingBody(weather) {
	const insight = insightLine(weather);
	const clothing = clothingLine(weather);
	const parts = [insight, clothing].filter(Boolean);
	return parts.length ? parts.join(' · ') : null;
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

	if (prefs.daily_brief && weather.localHour >= 6 && weather.localHour <= 9) {
		const body = briefingBody(weather);
		if (body) {
			notices.push({
				category: 'dailyBrief',
				fingerprint: `brief-${new Date().toISOString().slice(0, 10)}`,
				cooldownHours: 20,
				title: 'Morgenbriefing',
				body
			});
		}
	}

	return notices;
}
