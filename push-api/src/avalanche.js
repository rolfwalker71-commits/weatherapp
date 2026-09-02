const SLF_JSON = 'https://aws.slf.ch/api/bulletin/caaml/de/json';
const SLF_GEO = 'https://aws.slf.ch/api/bulletin/caaml/de/geojson';

const LEVELS = {
	low: 1,
	moderate: 2,
	considerable: 3,
	high: 4,
	'very_high': 5,
	'very-high': 5
};

const LABELS = {
	1: 'Stufe 1 · gering',
	2: 'Stufe 2 · mässig',
	3: 'Stufe 3 · erheblich',
	4: 'Stufe 4 · gross',
	5: 'Stufe 5 · sehr gross'
};

function inSwitzerland(lat, lon) {
	return lat >= 45.8 && lat <= 47.85 && lon >= 5.9 && lon <= 10.55;
}

function ratingNumber(value) {
	if (typeof value === 'number' && value >= 1 && value <= 5) return value;
	if (typeof value === 'string' && LEVELS[value.toLowerCase()]) return LEVELS[value.toLowerCase()];
	const asNum = Number(value);
	return asNum >= 1 && asNum <= 5 ? asNum : null;
}

function maxRating(bulletin) {
	const ratings = bulletin?.dangerRatings ?? [];
	let max = null;
	for (const rating of ratings) {
		const level = ratingNumber(rating.mainValue);
		if (level != null) max = max == null ? level : Math.max(max, level);
	}
	return max;
}

function pointInRing(lat, lon, ring) {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
		const xi = ring[i][0];
		const yi = ring[i][1];
		const xj = ring[j][0];
		const yj = ring[j][1];
		const intersect = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
		if (intersect) inside = !inside;
	}
	return inside;
}

function pointInGeometry(lat, lon, geometry) {
	if (!geometry) return false;
	if (geometry.type === 'Polygon') {
		const [outer, ...holes] = geometry.coordinates;
		if (!outer || !pointInRing(lat, lon, outer)) return false;
		return !holes.some((hole) => pointInRing(lat, lon, hole));
	}
	if (geometry.type === 'MultiPolygon') {
		return geometry.coordinates.some((polygon) => pointInGeometry(lat, lon, { type: 'Polygon', coordinates: polygon }));
	}
	return false;
}

export async function fetchAvalanche(lat, lon) {
	const unavailable = {
		available: false,
		level: null,
		label: 'nicht verfügbar',
		validUntil: null,
		source: 'SLF',
		note: 'Kein öffentlicher SLF-Feed erreichbar — keine Schätzwerte.'
	};
	if (!inSwitzerland(lat, lon)) {
		return {
			...unavailable,
			note: 'Lawinenbulletin SLF nur für die Schweiz. Ausserhalb nicht verfügbar.'
		};
	}

	try {
		const [jsonRes, geoRes] = await Promise.all([
			fetch(SLF_JSON, { headers: { Accept: 'application/json', 'User-Agent': 'weatherapp-push/1.0' } }),
			fetch(SLF_GEO, { headers: { Accept: 'application/json', 'User-Agent': 'weatherapp-push/1.0' } })
		]);
		if (!jsonRes.ok) return unavailable;
		const payload = await jsonRes.json();
		const bulletins = payload.bulletins ?? [];
		if (!bulletins.length) {
			return {
				available: false,
				level: null,
				label: 'kein aktuelles Bulletin',
				validUntil: null,
				source: 'SLF',
				note: 'Im Sommer oft kein Bulletin — keine Schätzwerte. Quelle: aws.slf.ch, CC BY 4.0.'
			};
		}

		let match = null;
		if (geoRes.ok) {
			const geo = await geoRes.json();
			match = (geo.features ?? []).find((feature) => pointInGeometry(lat, lon, feature.geometry));
		}

		const bulletin =
			(match && bulletins.find((item) => item.bulletinID === match.properties?.bulletinID)) || bulletins[0];
		const level = maxRating(match?.properties ?? bulletin);
		const validUntil = bulletin?.validTime?.endTime ?? match?.properties?.validTime?.endTime ?? null;
		const region = match?.properties?.regions?.[0]?.name || bulletin?.regions?.[0]?.name || null;

		if (level == null) {
			return {
				available: false,
				level: null,
				label: 'nicht verfügbar',
				validUntil,
				source: 'SLF',
				note: 'Bulletin ohne Stufe — keine Schätzwerte.'
			};
		}

		return {
			available: true,
			level,
			label: `${LABELS[level] || `Stufe ${level}`}${region ? ` · ${region}` : ''}`,
			validUntil,
			source: 'SLF Bulletin API',
			note: 'Offizielle SLF-Daten (CC BY 4.0). Kein Ersatz für das vollständige Bulletin.'
		};
	} catch {
		return unavailable;
	}
}
