// Pollen notifications from MeteoSwiss' open data (https://opendatadocs.meteoswiss.ch/a-data-groundbased/a7-pollen-stations,
// Quelle: MeteoSchweiz): the nearest of the national stations, hourly values of today, load classes of
// "Belastungsklassen der allergenen Pollenarten" (valid for the mean daily concentration, grains per m³).

const BASE = 'https://data.geo.admin.ch/ch.meteoschweiz.ogd-pollen';
const MAX_DISTANCE_KM = 100;
const CACHE_MS = 30 * 60 * 1000;
/** Hours of the local day in which a pollen notice may be sent. */
const FIRST_HOUR = 7;
const LAST_HOUR = 20;
const MODERATE = 2;

/** `moderate`, `strong`, `veryStrong`: lower bounds of the classes; "schwach" starts at 1. */
export const SPECIES = [
	{ id: 'hazel', name: 'Hasel', hourly: 'kacoryh0', moderate: 11, strong: 70, veryStrong: 250 },
	{ id: 'alder', name: 'Erle', hourly: 'kaalnuh0', moderate: 11, strong: 70, veryStrong: 250 },
	{ id: 'ash', name: 'Esche', hourly: 'kafraxh0', moderate: 11, strong: 100, veryStrong: 350 },
	{ id: 'birch', name: 'Birke', hourly: 'kabetuh0', moderate: 11, strong: 70, veryStrong: 300 },
	{ id: 'beech', name: 'Buche', hourly: 'kafaguh0', moderate: 50, strong: 130, veryStrong: 400 },
	{ id: 'oak', name: 'Eiche', hourly: 'kaquerh0', moderate: 50, strong: 130, veryStrong: 400 },
	{ id: 'grass', name: 'Gräser', hourly: 'khpoach0', moderate: 20, strong: 50, veryStrong: 150 }
];

export const STATIONS = [
	{ abbr: 'pbe', name: 'Bern', lat: 46.950342, lon: 7.424661 },
	{ abbr: 'pbs', name: 'Basel', lat: 47.5618, lon: 7.583931 },
	{ abbr: 'pbu', name: 'Buchs SG', lat: 47.173267, lon: 9.472614 },
	{ abbr: 'pcf', name: 'La Chaux-de-Fonds', lat: 47.113514, lon: 6.832 },
	{ abbr: 'pds', name: 'Davos', lat: 46.829092, lon: 9.855489 },
	{ abbr: 'pge', name: 'Genf', lat: 46.191969, lon: 6.147544 },
	{ abbr: 'plo', name: 'Locarno', lat: 46.172547, lon: 8.787389 },
	{ abbr: 'pls', name: 'Lausanne', lat: 46.524103, lon: 6.644825 },
	{ abbr: 'plu', name: 'Lugano', lat: 46.004231, lon: 8.960631 },
	{ abbr: 'plz', name: 'Luzern', lat: 47.057678, lon: 8.296803 },
	{ abbr: 'pmu', name: 'Münsterlingen', lat: 47.630206, lon: 9.236878 },
	{ abbr: 'pne', name: 'Neuenburg', lat: 47.000269, lon: 6.949828 },
	{ abbr: 'ppy', name: 'Payerne', lat: 46.813403, lon: 6.942939 },
	{ abbr: 'psn', name: 'Sitten', lat: 46.235403, lon: 7.384606 },
	{ abbr: 'pzh', name: 'Zürich', lat: 47.378225, lon: 8.565644 }
];

const CLASS_NAME = ['kein', 'schwach', 'mässig', 'stark', 'sehr stark'];

export function distanceKm(lat1, lon1, lat2, lon2) {
	const rad = Math.PI / 180;
	const a =
		Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
		Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
	return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** The nearest station within 100 km, else null (outside Switzerland there is nothing to report). */
export function nearestStation(lat, lon) {
	if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
	let best = null;
	for (const station of STATIONS) {
		const km = distanceKm(lat, lon, station.lat, station.lon);
		if (!best || km < best.km) best = { station, km };
	}
	return best && best.km <= MAX_DISTANCE_KM ? best : null;
}

/** 0 kein … 4 sehr stark, for a concentration of one species. */
export function classify(species, value) {
	if (!Number.isFinite(value) || value < 1) return 0;
	if (value >= species.veryStrong) return 4;
	if (value >= species.strong) return 3;
	if (value >= species.moderate) return 2;
	return 1;
}

/** Rows of the semicolon separated hourly file as objects; the time column is "dd.MM.yyyy HH:mm" (UTC). */
export function parseCsv(text) {
	const lines = String(text || '').split(/\r?\n/).filter(Boolean);
	if (!lines.length) return [];
	const header = lines[0].split(';');
	return lines.slice(1).map((line) => {
		const cells = line.split(';');
		return Object.fromEntries(header.map((name, index) => [name, cells[index]]));
	});
}

/**
 * Current load per species from the hourly file: the mean of the last three hours that have a value, so a single
 * spike does not trigger a notice. `updated` is the timestamp of the newest row.
 */
export function readings(rows) {
	const result = SPECIES.map((species) => {
		const values = rows.map((row) => Number.parseFloat(row[species.hourly])).filter(Number.isFinite).slice(-3);
		const value = values.length ? values.reduce((sum, item) => sum + item, 0) / values.length : null;
		return { id: species.id, name: species.name, value, level: classify(species, value) };
	});
	return { readings: result, updated: rows.length ? rows[rows.length - 1].reference_timestamp : null };
}

const cache = new Map();

/** Pollen report of the station nearest to a place, cached for 30 minutes per station. */
export async function fetchSwissPollen(lat, lon, { fetchImpl = fetch } = {}) {
	const near = nearestStation(lat, lon);
	if (!near) return null;
	const hit = cache.get(near.station.abbr);
	if (hit && Date.now() - hit.at < CACHE_MS) return { ...hit.report, km: near.km };
	const response = await fetchImpl(`${BASE}/${near.station.abbr}/ogd-pollen_${near.station.abbr}_h_now.csv`);
	if (!response.ok) throw new Error(`pollen ${near.station.abbr} ${response.status}`);
	const report = { station: near.station.name, ...readings(parseCsv(await response.text())) };
	cache.set(near.station.abbr, { at: Date.now(), report });
	return { ...report, km: near.km };
}

function localHour(timeZone, now = new Date()) {
	try {
		return Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: timeZone || 'Europe/Zurich' }).format(now));
	} catch {
		return now.getUTCHours();
	}
}

function isoDay(timeZone, now = new Date()) {
	try {
		return new Intl.DateTimeFormat('en-CA', { timeZone: timeZone || 'Europe/Zurich' }).format(now);
	} catch {
		return now.toISOString().slice(0, 10);
	}
}

/**
 * The pollen notice for one client, or null: only by day, only from "mässig" on. Escalating to a stronger class of
 * the leading species makes a new notice (own fingerprint); otherwise one per day.
 */
export function pollenNotice(report, row, now = new Date()) {
	if (!report) return null;
	const hour = localHour(row?.timezone, now);
	if (hour < FIRST_HOUR || hour > LAST_HOUR) return null;
	const active = report.readings.filter((item) => item.level >= 1 && item.value != null).sort((a, b) => b.level - a.level || b.value - a.value);
	const top = active[0];
	if (!top || top.level < MODERATE) return null;

	const place = row?.place_name ? ` · ${row.place_name}` : '';
	const list = active
		.slice(0, 3)
		.map((item) => `${item.name} ${Math.round(item.value)} /m³ (${CLASS_NAME[item.level]})`)
		.join(' · ');
	return {
		ios: {
			interruption: 'passive',
			relevance: top.level >= 3 ? 0.6 : 0.5,
			place: {
				name: row?.place_name || undefined,
				lat: Number.isFinite(row?.latitude) ? row.latitude : undefined,
				lon: Number.isFinite(row?.longitude) ? row.longitude : undefined,
				tz: row?.timezone || 'Europe/Zurich'
			},
			wx: {
				station: report.station,
				species: active.slice(0, 3).map((item) => ({ name: item.name, value: Math.round(item.value), level: item.level }))
			}
		},
		category: 'pollen',
		fingerprint: `pollen-${isoDay(row?.timezone, now)}-${top.id}-${top.level}`,
		cooldownHours: 12,
		title: `🌿 Pollenflug: ${top.name} ${CLASS_NAME[top.level]}${place}`,
		body: `${list}.\n🪟 Fenster tagsüber geschlossen halten, abends Haare waschen.\nStation ${report.station} (MeteoSchweiz).`,
		url: '/#luft',
		ttl: 6 * 3600,
		actions: [{ action: 'luft', title: 'Luft & Pollen', url: '/#luft' }]
	};
}
