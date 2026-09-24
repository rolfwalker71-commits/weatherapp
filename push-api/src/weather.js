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
		'temperature_2m,precipitation,precipitation_probability,uv_index,weather_code,apparent_temperature,cloud_cover,snowfall,is_day,wind_speed_10m,wind_gusts_10m,relative_humidity_2m'
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
		gusts: Number.isFinite(forecast.hourly.wind_gusts_10m?.[index])
			? forecast.hourly.wind_gusts_10m[index]
			: null,
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

const BLOCKS = '▁▂▃▄▅▆▇█';

/** Unicode mini chart — renders in every notification centre, including iOS home-screen apps. */
export function sparkline(values, { floor = null, ceil = null } = {}) {
	const finite = values.filter((value) => Number.isFinite(value));
	// A flat line says nothing; the caller then leaves the chart row out.
	if (finite.length < 2 || Math.max(...finite) === Math.min(...finite)) return '';
	const low = floor ?? Math.min(...finite);
	const high = Math.max(ceil ?? -Infinity, ...finite);
	const span = high - low || 1;
	return values
		.map((value) => {
			if (!Number.isFinite(value)) return ' ';
			const step = Math.round(((value - low) / span) * (BLOCKS.length - 1));
			return BLOCKS[Math.max(0, Math.min(BLOCKS.length - 1, step))];
		})
		.join('');
}

/** Open-Meteo returns local wall-clock ISO strings (timezone=auto): "2026-09-24T14:45" → "14:45". */
function hhmm(iso) {
	return typeof iso === 'string' && iso.length >= 16 ? iso.slice(11, 16) : '';
}

function degrees(value) {
	return Number.isFinite(value) ? `${Math.round(value)}°`.replace('-', '−') : '–';
}

function placeSuffix(row) {
	return row?.place_name ? ` · ${row.place_name}` : '';
}

function weatherEmoji(code, isDay = true) {
	if (!Number.isFinite(code)) return '🌡️';
	if (code >= 95) return '⛈️';
	if (code >= 71 && code <= 77) return '🌨️';
	if (code === 85 || code === 86) return '🌨️';
	if (code >= 51) return '🌧️';
	if (code === 45 || code === 48) return '🌫️';
	if (code === 3) return '☁️';
	if (code === 2) return isDay ? '⛅' : '☁️';
	if (code === 1) return isDay ? '🌤️' : '🌙';
	return isDay ? '☀️' : '🌙';
}

function formatInZone(iso, timeZone) {
	const date = iso ? new Date(iso) : null;
	if (!date || Number.isNaN(date.getTime())) return '';
	try {
		return new Intl.DateTimeFormat('de-CH', {
			weekday: 'short',
			hour: '2-digit',
			minute: '2-digit',
			timeZone: timeZone || undefined
		}).format(date);
	} catch {
		return '';
	}
}

function rainNotice(weather, row) {
	const slots = weather.minutes || [];
	const onsetIndex = slots.findIndex((slot) => slot.precipMm != null && slot.precipMm >= 0.1);
	const onset = onsetIndex >= 0 ? slots[onsetIndex] : null;
	const hour = weather.upcoming[0];
	const snow = weather.upcoming.slice(0, 2).some((item) => (item.snowfall ?? 0) >= 0.1);
	const thunder = weather.upcoming.slice(0, 2).some((item) => (item.code ?? 0) >= 95);
	const noun = thunder ? 'Gewitter' : snow ? 'Schnee' : 'Regen';
	const emoji = thunder ? '⛈️' : snow ? '🌨️' : '🌧️';

	const when = onsetIndex <= 0 ? 'in Kürze' : `ab ${hhmm(onset.time)}`;
	const title = `${emoji} ${noun} ${onsetIndex < 0 ? 'wahrscheinlich' : when}${placeSuffix(row)}`;

	const amount = weather.nextHourPrecip;
	const intensity = amount == null ? '' : amount < 1 ? 'Leichter' : amount < 4 ? 'Mässiger' : 'Kräftiger';
	const lines = [];
	const facts = [];
	if (amount != null && amount >= 0.1) facts.push(`${intensity} ${noun}, etwa ${amount.toFixed(1)} mm in der nächsten Stunde`);
	if (weather.nextHourProb != null) facts.push(`Wahrscheinlichkeit ${Math.round(weather.nextHourProb)} %`);
	if (facts.length) lines.push(`${facts.join(' · ')}.`);

	const chart = sparkline(
		slots.map((slot) => slot.precipMm),
		{ floor: 0, ceil: 1 }
	);
	if (chart.trim() && slots.length >= 2) {
		lines.push(`${hhmm(slots[0].time)} ${chart} ${hhmm(slots[slots.length - 1].time)}`);
	}

	let dryAgain = null;
	if (onsetIndex >= 0) {
		dryAgain = slots.slice(onsetIndex + 1).find((slot) => slot.precipMm != null && slot.precipMm < 0.05);
		if (!dryAgain) {
			dryAgain = weather.upcoming
				.slice(1)
				.find((item) => item.precipMm != null && item.precipMm < 0.1 && (item.precipProb ?? 0) < 40);
		}
	}
	const advice = thunder ? '⚡ Drinnen bleiben, bis es durch ist' : snow ? '🧤 Warm anziehen, Strassen können glatt werden' : '☂️ Schirm mitnehmen';
	lines.push(dryAgain ? `${advice} — trocken ab ca. ${hhmm(dryAgain.time)}.` : `${advice}.`);
	if (hour?.temperature != null) lines.push(`🌡️ ${degrees(hour.temperature)}, Wind ${Math.round(hour.wind ?? 0)} km/h`);

	return {
		category: 'rainSoon',
		fingerprint: `rain-${weather.upcoming[0]?.time?.slice(0, 13) || 'now'}`,
		cooldownHours: 3,
		title,
		body: lines.join('\n'),
		url: '/#radar',
		urgency: 'high',
		ttl: 45 * 60,
		actions: [
			{ action: 'radar', title: '🛰️ Radar', url: '/#radar' },
			{ action: 'verlauf', title: '🕐 Stunden', url: '/#verlauf' }
		]
	};
}

const SEVERITY_BADGE = {
	moderate: { emoji: '🟡', label: 'Gefahr mässig' },
	severe: { emoji: '🟠', label: 'Gefahr erheblich' },
	extreme: { emoji: '🔴', label: 'Gefahr gross' }
};

function warningNotice(alert, weather, row) {
	const badge = SEVERITY_BADGE[alert.severity] || { emoji: '⚠️', label: 'Warnung' };
	const lines = [];
	if (alert.headline && alert.headline !== alert.event) lines.push(alert.headline);
	const from = formatInZone(alert.onset, weather.timezone);
	const until = formatInZone(alert.expires, weather.timezone);
	if (from || until) lines.push(`🕐 ${from && until ? `${from} bis ${until}` : until ? `bis ${until}` : `ab ${from}`}`);
	lines.push(`${badge.emoji} ${badge.label}${alert.area ? ` · ${alert.area}` : ''}`);
	if (alert.source) lines.push(`Quelle: ${alert.source}`);
	const expiresMs = alert.expires ? new Date(alert.expires).getTime() - Date.now() : NaN;
	return {
		category: 'warnings',
		fingerprint: `warn-${alert.id}`,
		cooldownHours: 6,
		title: `⚠️ ${alert.event || 'Wetterwarnung'}${placeSuffix(row)}`,
		body: lines.join('\n'),
		url: '/#jetzt',
		urgency: 'high',
		ttl: Number.isFinite(expiresMs) && expiresMs > 0 ? Math.min(12 * 3600, Math.round(expiresMs / 1000)) : 6 * 3600,
		requireInteraction: alert.severity === 'severe' || alert.severity === 'extreme',
		actions: [
			{ action: 'jetzt', title: 'Details', url: '/#jetzt' },
			{ action: 'radar', title: '🛰️ Radar', url: '/#radar' }
		]
	};
}

function frostNotice(weather, row) {
	const current = weather.current;
	const next = weather.upcoming.slice(0, 8);
	const lowest = next.reduce(
		(min, hour) => (Number.isFinite(hour.temperature) && (!min || hour.temperature < min.temperature) ? hour : min),
		null
	);
	const wetSoon = next.slice(0, 4).some((hour) => (hour.precipMm ?? 0) >= 0.1);
	const title = `${wetSoon ? '🧊 Glättegefahr' : '🥶 Frost'}${placeSuffix(row)}`;
	const lines = [];
	const feels = Number.isFinite(current.apparent_temperature) ? `, gefühlt ${degrees(current.apparent_temperature)}` : '';
	lines.push(
		`Jetzt ${degrees(current.temperature_2m)}${feels}.` +
			(lowest ? ` Tiefstwert ${degrees(lowest.temperature)} um ${hhmm(lowest.time)}.` : '')
	);
	const chart = sparkline(next.map((hour) => hour.temperature));
	if (chart.trim() && next.length >= 2) lines.push(`${hhmm(next[0].time)} ${chart} ${hhmm(next[next.length - 1].time)}`);
	lines.push(wetSoon ? '🚗 Nässe gefriert — Brücken und Nebenstrassen meiden.' : '🚗 Scheiben kratzen, empfindliche Pflanzen abdecken.');
	return {
		category: 'frost',
		fingerprint: `frost-${new Date().toISOString().slice(0, 10)}`,
		cooldownHours: 8,
		title,
		body: lines.join('\n'),
		url: '/#verlauf',
		ttl: 3 * 3600,
		actions: [{ action: 'verlauf', title: '🕐 Stunden', url: '/#verlauf' }]
	};
}

function uvLabel(uv) {
	if (uv >= 11) return 'extrem';
	if (uv >= 8) return 'sehr hoch';
	if (uv >= 6) return 'hoch';
	return 'mässig';
}

function uvNotice(weather, row) {
	const next = weather.upcoming.slice(0, 8);
	const peak = next.reduce((best, hour) => ((hour.uv ?? -1) > (best?.uv ?? -1) ? hour : best), null);
	const lastHigh = [...next].reverse().find((hour) => (hour.uv ?? 0) >= 6);
	const uv = Math.round(weather.uvNow);
	const lines = [];
	const bits = [];
	if (lastHigh) bits.push(`Hoch bis ca. ${hhmm(lastHigh.time)}`);
	if (peak?.uv != null && Math.round(peak.uv) > uv) bits.push(`Spitze ${Math.round(peak.uv)} um ${hhmm(peak.time)}`);
	if (bits.length) lines.push(`${bits.join(' · ')}.`);
	const chart = sparkline(
		next.map((hour) => hour.uv),
		{ floor: 0, ceil: 10 }
	);
	if (chart.trim()) lines.push(`${hhmm(next[0].time)} ${chart} ${hhmm(next[next.length - 1].time)}`);
	lines.push('🧴 Sonnencreme LSF 30+, Hut und Schatten über Mittag.');
	return {
		category: 'uv',
		fingerprint: `uv-${new Date().toISOString().slice(0, 10)}`,
		cooldownHours: 12,
		title: `😎 UV ${uv} – ${uvLabel(uv)}${placeSuffix(row)}`,
		body: lines.join('\n'),
		url: '/#luft',
		ttl: 3 * 3600,
		actions: [{ action: 'luft', title: 'Luft & UV', url: '/#luft' }]
	};
}

function aqiLabel(aqi) {
	if (aqi >= 100) return 'extrem schlecht';
	if (aqi >= 80) return 'sehr schlecht';
	if (aqi >= 60) return 'schlecht';
	if (aqi >= 40) return 'mässig';
	return 'ordentlich';
}

function airNotice(weather, row) {
	const bits = [];
	const badAir = weather.aqi != null && weather.aqi >= 60;
	const highPollen = weather.pollen != null && weather.pollen >= 100;
	if (badAir) bits.push(`Luftqualität ${Math.round(weather.aqi)} (${aqiLabel(weather.aqi)})`);
	if (highPollen) bits.push(`Pollen ${Math.round(weather.pollen)} Körner/m³ (stark)`);
	const lines = [`${bits.join(' · ')}.`];
	if (badAir) lines.push('🏃 Anstrengenden Sport draussen heute verschieben.');
	if (highPollen) lines.push('🪟 Früh morgens lüften, abends Haare waschen.');
	return {
		category: 'air',
		fingerprint: `air-${new Date().toISOString().slice(0, 10)}`,
		cooldownHours: 8,
		title: `${badAir ? '😷' : '🌳'} ${badAir && highPollen ? 'Luft & Pollen' : badAir ? 'Schlechte Luft' : 'Starker Pollenflug'}${placeSuffix(row)}`,
		body: lines.join('\n'),
		url: '/#luft',
		ttl: 4 * 3600,
		actions: [{ action: 'luft', title: 'Luft & Pollen', url: '/#luft' }]
	};
}

function briefNotice(weather, row, body) {
	const lines = [];
	const range =
		weather.todayMin != null && weather.todayMax != null
			? `Heute ${degrees(weather.todayMin)} bis ${degrees(weather.todayMax)}`
			: 'Heute';
	const sky = wmoLabel(weather.todayCode);
	const rain = weather.todayPrecipProb != null ? `Regenrisiko ${Math.round(weather.todayPrecipProb)} %` : '';
	lines.push(`${[range, sky, rain].filter(Boolean).join(', ')}.`);
	lines.push(body);
	const next = weather.upcoming;
	const chart = sparkline(next.map((hour) => hour.temperature));
	if (chart.trim() && next.length >= 2) {
		lines.push(`🌡️ ${hhmm(next[0].time)} ${chart} ${hhmm(next[next.length - 1].time)}`);
	}
	if (next.some((hour) => (hour.precipMm ?? 0) >= 0.1)) {
		lines.push(`💧 ${hhmm(next[0].time)} ${sparkline(next.map((hour) => hour.precipMm), { floor: 0, ceil: 2 })} ${hhmm(next[next.length - 1].time)}`);
	}
	const greeting = row?.place_name ? `Guten Morgen, ${row.place_name}` : 'Guten Morgen';
	return {
		category: 'dailyBrief',
		fingerprint: `brief-${new Date().toISOString().slice(0, 10)}`,
		cooldownHours: 20,
		title: `${weatherEmoji(weather.todayCode, true)} ${greeting}`,
		body: lines.join('\n'),
		url: '/#jetzt',
		urgency: 'low',
		ttl: 3 * 3600,
		actions: [
			{ action: 'verlauf', title: '🕐 Stunden', url: '/#verlauf' },
			{ action: 'woche', title: '📅 Woche', url: '/#woche' }
		]
	};
}

/** Sample for «Testmitteilung» — real current weather, same layout as the brief. */
export function testNotice(weather, row) {
	const current = weather.current;
	const lines = [
		`Jetzt ${degrees(current.temperature_2m)}, ${weather.wmoLabel || 'aktuelles Wetter'}` +
			(weather.todayMin != null && weather.todayMax != null
				? ` · heute ${degrees(weather.todayMin)} bis ${degrees(weather.todayMax)}.`
				: '.')
	];
	const next = weather.upcoming;
	const chart = sparkline(next.map((hour) => hour.temperature));
	if (chart.trim() && next.length >= 2) lines.push(`🌡️ ${hhmm(next[0].time)} ${chart} ${hhmm(next[next.length - 1].time)}`);
	const insight = insightLine(weather);
	if (insight) lines.push(insight);
	lines.push('✅ So sehen deine Meldungen aus.');
	return {
		category: 'test',
		title: `${weatherEmoji(current.weather_code, current.is_day === 1)} Mitteilungen aktiv${placeSuffix(row)}`,
		body: lines.join('\n'),
		url: '/#jetzt',
		ttl: 10 * 60,
		actions: [{ action: 'verlauf', title: '🕐 Stunden', url: '/#verlauf' }]
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
		notices.push(rainNotice(weather, prefs));
	}

	if (prefs.warnings) {
		const serious = (alerts || []).filter(
			(alert) => alert?.id && ['moderate', 'severe', 'extreme'].includes(alert.severity)
		);
		for (const alert of serious.slice(0, 2)) {
			notices.push(warningNotice(alert, weather, prefs));
		}
	}

	if (prefs.frost && Number.isFinite(weather.current.temperature_2m) && (frostNow || nearFrost)) {
		notices.push(frostNotice(weather, prefs));
	}

	if (prefs.uv && weather.current.is_day === 1 && weather.uvNow != null && weather.uvNow >= 7) {
		notices.push(uvNotice(weather, prefs));
	}

	if (prefs.air && ((weather.aqi != null && weather.aqi >= 60) || (weather.pollen != null && weather.pollen >= 100))) {
		notices.push(airNotice(weather, prefs));
	}

	if (prefs.daily_brief && weather.localHour >= 6 && weather.localHour <= 9) {
		const body = briefingBody(weather);
		if (body) notices.push(briefNotice(weather, prefs, body));
	}

	return notices;
}

const CHANGE_URL = {
	rainCancel: '/#verlauf',
	rainNew: '/#radar',
	rainEarlier: '/#radar',
	warning: '/#jetzt',
	windJump: '/#verlauf',
	tempSwing: '/#woche'
};

const CHANGE_EMOJI = {
	rainCancel: '🌤️',
	rainNew: '🌧️',
	rainEarlier: '🌧️',
	warning: '⚠️',
	windJump: '💨',
	tempSwing: '🌡️'
};

/** Append forecast-change notice when prefs.forecast_change and a plan delta exists. */
export function appendForecastChangeNotice(notices, change, weather, row) {
	if (!change) return notices;
	const lines = [change.body];
	if (weather?.current) {
		lines.push(`Jetzt ${degrees(weather.current.temperature_2m)}, ${weather.wmoLabel || 'aktuell'}.`);
		const next = weather.upcoming || [];
		const rainy = change.kind?.startsWith('rain');
		const chart = rainy
			? sparkline(next.map((hour) => hour.precipMm), { floor: 0, ceil: 2 })
			: change.kind === 'windJump'
				? sparkline(next.map((hour) => hour.gusts ?? hour.wind), { floor: 0 })
				: sparkline(next.map((hour) => hour.temperature));
		if (chart.trim() && next.length >= 2) {
			lines.push(`${rainy ? '💧' : change.kind === 'windJump' ? '💨' : '🌡️'} ${hhmm(next[0].time)} ${chart} ${hhmm(next[next.length - 1].time)}`);
		}
	}
	const url = CHANGE_URL[change.kind] || '/#jetzt';
	notices.push({
		category: 'forecastChange',
		fingerprint: change.fingerprint,
		cooldownHours: 4,
		title: `${CHANGE_EMOJI[change.kind] || '🔄'} Prognose geändert${placeSuffix(row)}`,
		body: lines.join('\n'),
		url,
		ttl: 2 * 3600,
		actions: [
			{ action: 'open', title: 'Ansehen', url },
			{ action: 'woche', title: '📅 Woche', url: '/#woche' }
		]
	});
	return notices;
}
