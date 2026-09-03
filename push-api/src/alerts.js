const COUNTRY_SLUGS = {
	AD: 'andorra',
	AL: 'albania',
	AT: 'austria',
	BA: 'bosnia-herzegovina',
	BE: 'belgium',
	BG: 'bulgaria',
	CH: 'switzerland',
	CY: 'cyprus',
	CZ: 'czech-republic',
	DE: 'germany',
	DK: 'denmark',
	EE: 'estonia',
	ES: 'spain',
	FI: 'finland',
	FR: 'france',
	GB: 'united-kingdom',
	GR: 'greece',
	HR: 'croatia',
	HU: 'hungary',
	IE: 'ireland',
	IL: 'israel',
	IS: 'iceland',
	IT: 'italy',
	LI: 'liechtenstein',
	LT: 'lithuania',
	LU: 'luxembourg',
	LV: 'latvia',
	MD: 'moldova',
	ME: 'montenegro',
	MK: 'north-macedonia',
	MT: 'malta',
	NL: 'netherlands',
	NO: 'norway',
	PL: 'poland',
	PT: 'portugal',
	RO: 'romania',
	RS: 'serbia',
	SE: 'sweden',
	SI: 'slovenia',
	SK: 'slovakia',
	UA: 'ukraine',
	UK: 'united-kingdom'
};

/** Last-resort boxes when reverse geocode is unavailable. Smallest containing box wins. */
const COUNTRY_BOXES = [
	{ code: 'LI', box: [47.04, 9.47, 47.28, 9.64] },
	{ code: 'CH', box: [45.8, 5.9, 47.85, 10.55] },
	{ code: 'AT', box: [46.4, 9.5, 49.02, 17.2] },
	{ code: 'DE', box: [47.27, 5.87, 55.1, 15.04] },
	{ code: 'ES', box: [35.95, -9.4, 43.8, 3.35] },
	{ code: 'FR', box: [42.33, -5.15, 51.09, 8.23] },
	{ code: 'IT', box: [36.6, 6.62, 47.1, 18.52] },
	{ code: 'PT', box: [36.96, -9.5, 42.15, -6.19] },
	{ code: 'BE', box: [49.5, 2.54, 51.51, 6.4] },
	{ code: 'NL', box: [50.75, 3.36, 53.55, 7.23] },
	{ code: 'LU', box: [49.44, 5.73, 50.18, 6.53] }
];

const ADMIN4_COUNTRIES = new Set(['CH', 'LI', 'AT', 'DE']);
const STOP_WORDS = new Set([
	'de',
	'del',
	'la',
	'el',
	'les',
	'des',
	'du',
	'the',
	'of',
	'san',
	'santa',
	'sur',
	'nord',
	'este',
	'oeste',
	'provinz',
	'provincia',
	'kanton',
	'canton',
	'departement',
	'departamento',
	'region',
	'comunidad',
	'autonomous',
	'community',
	'litoral',
	'prelitoral',
	'costa',
	'interior',
	'central',
	'depresion',
	'pirineo',
	'prepirineo',
	'staat',
	'land',
	'ost',
	'west'
]);
const GENERIC_PLACE = new Set([
	'spanien',
	'spain',
	'espana',
	'frankreich',
	'france',
	'schweiz',
	'switzerland',
	'deutschland',
	'germany',
	'oesterreich',
	'austria',
	'italien',
	'italy',
	'europa',
	'europe'
]);
const SEVERITY_DE = {
	minor: 'gering',
	moderate: 'mässig',
	severe: 'erheblich',
	extreme: 'extrem'
};
const SEVERITY_RANK = { extreme: 4, severe: 3, moderate: 2, minor: 1, unknown: 0 };
const MAX_ALERTS = 5;
const FEED_TTL_MS = 8 * 60 * 1000;
const GEO_TTL_MS = 24 * 60 * 60 * 1000;

const feedCache = new Map();
const geoCache = new Map();

function countrySlug(code) {
	return COUNTRY_SLUGS[String(code || '').toUpperCase()] || null;
}

function countryFromBoxes(lat, lon) {
	const hits = [];
	for (const item of COUNTRY_BOXES) {
		const [south, west, north, east] = item.box;
		if (lat >= south && lat <= north && lon >= west && lon <= east) {
			const area = (north - south) * (east - west);
			hits.push({ code: item.code, area });
		}
	}
	if (!hits.length) return null;
	hits.sort((a, b) => a.area - b.area);
	return hits[0].code;
}

function decode(value) {
	return value
		.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.trim();
}

function tag(xml, name) {
	const match = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
	return match ? decode(match[1]) : null;
}

function allTags(xml, name) {
	return [...xml.matchAll(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'gi'))].map((match) =>
		decode(match[1])
	);
}

function fold(value) {
	return String(value || '')
		.toLowerCase()
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.replace(/ß/g, 'ss');
}

function words(value) {
	return fold(value)
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()
		.split(/\s+/)
		.filter((word) => word.length >= 3 && !STOP_WORDS.has(word) && !GENERIC_PLACE.has(word));
}

function hasWord(haystack, needle) {
	if (!needle || needle.length < 3) return false;
	return new RegExp(`(^|[^a-z0-9])${needle}([^a-z0-9]|$)`).test(fold(haystack));
}

function parseTime(value) {
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function eventLabel(text) {
	const value = fold(text);
	if (value.includes('thunder') || value.includes('gewitter') || value.includes('tormenta')) return 'Gewitter';
	if (value.includes('rain-flood') || value.includes('hochwasser') || value.includes('flood')) return 'Hochwasser';
	if (value.includes('rain') || value.includes('regen') || value.includes('lluvia')) return 'Starkregen';
	if (value.includes('avalanche') || value.includes('lawine') || value.includes('alud')) return 'Lawine';
	if (value.includes('snow') || value.includes('schnee') || value.includes('nieve')) return 'Schnee';
	if (value.includes('ice') || value.includes('glatt') || value.includes('frost')) return 'Glatteis';
	if (
		value.includes('high-temperature') ||
		value.includes('temperaturas max') ||
		value.includes('heat') ||
		value.includes('hitze')
	) {
		return 'Hitze';
	}
	if (value.includes('low-temperature') || value.includes('kalt') || value.includes('fria')) return 'Kälte';
	if (value.includes('wind') || value.includes('sturm') || value.includes('vent')) return 'Wind';
	if (value.includes('fog') || value.includes('nebel') || value.includes('niebla')) return 'Nebel';
	if (value.includes('forest-fire') || value.includes('waldbrand') || value.includes('incendio')) return 'Waldbrand';
	if (value.includes('coastal') || value.includes('kueste') || value.includes('costa')) return 'Küste';
	const raw = String(text || '').trim();
	return raw ? raw.slice(0, 48) : 'Wetterwarnung';
}

function severityFrom(info, fallbackText = '') {
	const params = Array.isArray(info?.parameter) ? info.parameter : [];
	const level = params.find((item) => fold(item.valueName) === 'awareness_level')?.value || '';
	const blob = `${level} ${info?.severity || ''} ${fallbackText}`;
	const folded = fold(blob);
	if (folded.includes('extreme') || folded.includes('; 4') || /\bred\b/.test(folded)) return 'extreme';
	if (folded.includes('severe') || folded.includes('; 3') || folded.includes('orange')) return 'severe';
	if (folded.includes('moderate') || folded.includes('; 2') || folded.includes('yellow') || folded.includes('gelb')) {
		return 'moderate';
	}
	if (
		folded.includes('minor') ||
		folded.includes('; 1') ||
		folded.includes('green') ||
		folded.includes('grun') ||
		folded.includes('verde')
	) {
		return 'minor';
	}
	return 'unknown';
}

function isGreen(info, severity, text) {
	const params = Array.isArray(info?.parameter) ? info.parameter : [];
	const level = fold(params.find((item) => fold(item.valueName) === 'awareness_level')?.value || '');
	const blob = fold(`${level} ${text}`);
	if (level.includes('1;') || level.includes('green') || level.includes('verde')) return true;
	if (blob.includes('nivel verde') || blob.includes('green warning')) return true;
	return severity === 'minor';
}

function parsePolygon(text) {
	if (!text) return null;
	const nums = String(text)
		.trim()
		.split(/[\s,]+/)
		.map(Number)
		.filter((value) => Number.isFinite(value));
	if (nums.length < 6) return null;
	const ring = [];
	for (let i = 0; i < nums.length - 1; i += 2) {
		ring.push([nums[i], nums[i + 1]]);
	}
	return ring.length >= 3 ? ring : null;
}

function pointInRing(lat, lon, ring) {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
		const yi = ring[i][0];
		const xi = ring[i][1];
		const yj = ring[j][0];
		const xj = ring[j][1];
		const intersect = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
		if (intersect) inside = !inside;
	}
	return inside;
}

function geocodesOf(area) {
	const list = area?.geocode;
	if (!list) return [];
	if (Array.isArray(list)) {
		return list.map((item) => ({
			name: item.valueName || item.name || '',
			value: item.value || ''
		}));
	}
	if (list.valueName || list.value) {
		return [{ name: list.valueName || '', value: list.value || '' }];
	}
	return [];
}

function areasFromInfo(info, chunkXml = '') {
	if (Array.isArray(info?.area) && info.area.length) {
		return info.area.map((area) => ({
			desc: area.areaDesc || null,
			codes: geocodesOf(area),
			polygon: parsePolygon(area.polygon)
		}));
	}
	const desc = info?.areaDesc || tag(chunkXml, 'cap:areaDesc') || tag(chunkXml, 'georss:name');
	const codeName = tag(chunkXml, 'valueName');
	const codeValue = tag(chunkXml, 'value');
	const polygon = parsePolygon(tag(chunkXml, 'cap:polygon') || tag(chunkXml, 'georss:polygon'));
	return [
		{
			desc: desc || null,
			codes: codeName && codeValue ? [{ name: codeName, value: codeValue }] : [],
			polygon
		}
	];
}

async function reverseGeocode(lat, lon) {
	const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
	const cached = geoCache.get(key);
	if (cached && Date.now() - cached.at < GEO_TTL_MS) return cached.value;
	const url = new URL('https://api.bigdatacloud.net/data/reverse-geocode-client');
	url.searchParams.set('latitude', String(lat));
	url.searchParams.set('longitude', String(lon));
	url.searchParams.set('localityLanguage', 'de');
	const response = await fetch(url, {
		headers: { Accept: 'application/json', 'User-Agent': 'weatherapp-push/1.0' }
	});
	if (!response.ok) throw new Error(`reverse-geocode ${response.status}`);
	const data = await response.json();
	const admins = (data.localityInfo?.administrative || [])
		.filter((item) => Number(item.adminLevel) > 2 && Number(item.adminLevel) <= 8)
		.map((item) => ({
			level: Number(item.adminLevel),
			name: item.name || '',
			iso: item.isoCode || item.isoName || ''
		}));
	const value = {
		countryCode: data.countryCode || null,
		countryName: data.countryName || '',
		city: data.city || data.locality || '',
		admin1: data.principalSubdivision || '',
		admins
	};
	geoCache.set(key, { at: Date.now(), value });
	return value;
}

function buildPlace(lat, lon, hints, geo) {
	const countryCode = String(hints.country || geo?.countryCode || countryFromBoxes(lat, lon) || '')
		.trim()
		.toUpperCase();
	const city = String(hints.name || geo?.city || '').trim();
	const admin1 = String(hints.admin1 || geo?.admin1 || '').trim();
	const admins = [...(geo?.admins || [])];
	if (city && !admins.some((item) => fold(item.name) === fold(city))) {
		admins.push({ level: 8, name: city, iso: '' });
	}
	if (admin1 && !admins.some((item) => fold(item.name) === fold(admin1))) {
		admins.push({ level: ADMIN4_COUNTRIES.has(countryCode) ? 4 : 6, name: admin1, iso: '' });
	}

	const cityNorms = new Set(words(city));
	const provinceNorms = new Set();
	const regionNorms = new Set();
	for (const admin of admins) {
		const tokens = words(`${admin.name} ${admin.iso}`);
		if (admin.level >= 6) tokens.forEach((token) => provinceNorms.add(token));
		else if (admin.level === 4) {
			if (ADMIN4_COUNTRIES.has(countryCode)) tokens.forEach((token) => provinceNorms.add(token));
			else tokens.forEach((token) => regionNorms.add(token));
		}
	}
	cityNorms.forEach((token) => provinceNorms.delete(token));

	return {
		lat,
		lon,
		countryCode,
		city,
		admin1,
		cityNorms,
		provinceNorms,
		regionNorms,
		mountainPlace: admins.some((item) => /alpen|alp|pirineo|pyren/i.test(item.name))
	};
}

function scoreArea(areaDesc, place) {
	if (!areaDesc) return 0;
	let score = 0;
	let cityHit = false;
	for (const token of place.cityNorms) {
		if (hasWord(areaDesc, token)) {
			score += 50;
			cityHit = true;
			break;
		}
	}
	for (const token of place.provinceNorms) {
		if (hasWord(areaDesc, token)) {
			score += 40;
			break;
		}
	}
	if (score < 40) {
		for (const token of place.regionNorms) {
			if (hasWord(areaDesc, token)) {
				score += 15;
				break;
			}
		}
	}
	if (score < 40) return 0;

	const folded = fold(areaDesc);
	if (cityHit && /\blitoral\b/.test(folded) && !folded.includes('prelitoral')) score += 15;
	if (/\b(prepirineo|pirineo|alpin|alpes)\b/.test(folded) && !place.mountainPlace) score -= 25;
	return score;
}

function areaMatchesPlace(area, place, bestNames) {
	if (area.polygon) return pointInRing(place.lat, place.lon, area.polygon);
	return bestNames.has(fold(area.desc || ''));
}

function bestAreaNames(areas, place) {
	const scored = [];
	const seen = new Set();
	for (const area of areas) {
		const key = fold(area.desc || '');
		if (!key || seen.has(key)) continue;
		seen.add(key);
		const score = scoreArea(area.desc, place);
		if (score > 0) scored.push({ key, score });
	}
	if (!scored.length) return new Set();
	const max = Math.max(...scored.map((item) => item.score));
	return new Set(scored.filter((item) => item.score >= max - 2).map((item) => item.key));
}

function titleFor(event, severity) {
	const label = SEVERITY_DE[severity];
	if (label && !event.includes(',')) return `${event}, ${label}`;
	return event;
}

function collapseAlerts(matched, place) {
	const groups = new Map();
	for (const alert of matched) {
		const key = `${alert.kind}|${alert.severity}`;
		const current = groups.get(key);
		if (!current) {
			groups.set(key, { ...alert, areas: alert.area ? [alert.area] : [] });
			continue;
		}
		if (alert.area) current.areas.push(alert.area);
		if ((SEVERITY_RANK[alert.severity] || 0) > (SEVERITY_RANK[current.severity] || 0)) {
			current.id = alert.id;
			current.severity = alert.severity;
			current.source = alert.source;
		}
		const onsetMs = parseTime(alert.onset)?.getTime();
		const currentOnsetMs = parseTime(current.onset)?.getTime();
		if (onsetMs != null && (currentOnsetMs == null || onsetMs < currentOnsetMs)) current.onset = alert.onset;
		const expiresMs = parseTime(alert.expires)?.getTime();
		const currentExpiresMs = parseTime(current.expires)?.getTime();
		if (expiresMs != null && (currentExpiresMs == null || expiresMs > currentExpiresMs)) {
			current.expires = alert.expires;
		}
	}
	return [...groups.values()].map((group) => {
		const unique = [...new Set(group.areas.filter(Boolean))];
		const area = unique.length === 1 ? unique[0] : place.city || place.admin1 || unique[0] || null;
		return {
			id: group.id,
			event: titleFor(group.kind, group.severity),
			headline: '',
			severity: group.severity,
			onset: group.onset,
			expires: group.expires,
			area,
			source: group.source
		};
	});
}

function filterCurrent(alerts, now) {
	return alerts.filter((alert) => {
		const expires = parseTime(alert.expires);
		if (expires && expires.getTime() < now) return false;
		return true;
	});
}

function parseJsonFeed(payload, country) {
	const alerts = [];
	for (const item of payload.warnings || []) {
		const alert = item.alert || {};
		const infos = alert.info || [];
		const preferred =
			infos.find((info) => /^de/i.test(info.language || '')) ||
			infos.find((info) => /^en/i.test(info.language || '')) ||
			infos[0];
		if (!preferred) continue;
		const text = `${preferred.event || ''} ${preferred.headline || ''}`;
		const severity = severityFrom(preferred, text);
		const onset = preferred.onset || preferred.effective || alert.sent || null;
		const expires = preferred.expires || null;
		alerts.push({
			id: item.uuid || alert.identifier || `${country.code}-${alerts.length}`,
			kind: eventLabel(preferred.event || preferred.headline || text),
			severity,
			onset,
			expires,
			areas: areasFromInfo(preferred),
			source: `Meteoalarm ${country.code}`,
			green: isGreen(preferred, severity, text)
		});
	}
	return alerts;
}

function parseAtomFeed(xml, country) {
	return xml
		.split(/<entry[\s>]/i)
		.slice(1)
		.map((chunk, index) => {
			const title = tag(chunk, 'title') || '';
			const event = tag(chunk, 'cap:event') || title;
			const summary = tag(chunk, 'summary') || event;
			const severity = severityFrom(
				{ severity: tag(chunk, 'cap:severity'), parameter: [] },
				`${title} ${summary} ${allTags(chunk, 'category').join(' ')}`
			);
			return {
				id: tag(chunk, 'id') || `${country.code}-${index}`,
				kind: eventLabel(event),
				severity,
				onset: tag(chunk, 'cap:onset') || tag(chunk, 'cap:effective') || tag(chunk, 'cap:sent'),
				expires: tag(chunk, 'cap:expires'),
				areas: areasFromInfo({ areaDesc: tag(chunk, 'cap:areaDesc') }, chunk),
				source: `Meteoalarm ${country.code}`,
				green: isGreen(null, severity, `${title} ${summary}`)
			};
		});
}

async function loadCountryFeed(country) {
	const cached = feedCache.get(country.code);
	if (cached && Date.now() - cached.at < FEED_TTL_MS) return cached.value;

	const headers = { Accept: '*/*', 'User-Agent': 'weatherapp-push/1.0' };
	const jsonUrl = `https://feeds.meteoalarm.org/api/v1/warnings/feeds-${country.slug}`;
	const jsonRes = await fetch(jsonUrl, { headers: { ...headers, Accept: 'application/json' } });
	let parsed = [];
	if (jsonRes.ok) {
		parsed = parseJsonFeed(await jsonRes.json(), country);
	}
	if (!parsed.length) {
		const atomUrl = `https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-${country.slug}`;
		const atomRes = await fetch(atomUrl, { headers });
		if (!atomRes.ok) throw new Error(`Meteoalarm ${atomRes.status}`);
		parsed = parseAtomFeed(await atomRes.text(), country);
	}

	const value = parsed;
	feedCache.set(country.code, { at: Date.now(), value });
	return value;
}

function localizeForPlace(rawAlerts, place) {
	const now = Date.now();
	const allAreas = rawAlerts.flatMap((alert) => alert.areas || []);
	const bestNames = bestAreaNames(allAreas, place);
	const current = filterCurrent(
		rawAlerts.filter((alert) => !alert.green),
		now
	);
	const matched = [];
	for (const alert of current) {
		const localAreas = (alert.areas || []).filter((area) => areaMatchesPlace(area, place, bestNames));
		if (!localAreas.length) continue;
		matched.push({
			id: alert.id,
			kind: alert.kind,
			severity: alert.severity,
			onset: alert.onset,
			expires: alert.expires,
			area: localAreas[0].desc || place.city || null,
			source: alert.source
		});
	}
	const collapsed = collapseAlerts(matched, place);
	collapsed.sort((a, b) => {
		const rank = (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0);
		if (rank) return rank;
		return String(a.onset || '').localeCompare(String(b.onset || ''));
	});
	return collapsed.slice(0, MAX_ALERTS);
}

export async function fetchMeteoalarm(lat, lon, hints = {}) {
	let geo = null;
	try {
		geo = await reverseGeocode(lat, lon);
	} catch {
		geo = null;
	}

	const place = buildPlace(lat, lon, hints, geo);
	const slug = countrySlug(place.countryCode);
	if (!slug) {
		return { coverage: false, alerts: [] };
	}

	const country = { code: place.countryCode, slug };
	const raw = await loadCountryFeed(country);
	return { coverage: true, alerts: localizeForPlace(raw, place) };
}
