const COUNTRY_FEEDS = [
	{ code: 'CH', name: 'switzerland', box: [45.8, 5.9, 47.85, 10.55] },
	{ code: 'DE', name: 'germany', box: [47.2, 5.8, 55.2, 15.1] },
	{ code: 'AT', name: 'austria', box: [46.3, 9.4, 49.1, 17.2] },
	{ code: 'FR', name: 'france', box: [41.3, -5.2, 51.2, 9.7] },
	{ code: 'IT', name: 'italy', box: [36.6, 6.6, 47.1, 18.6] },
	{ code: 'LI', name: 'liechtenstein', box: [47.04, 9.47, 47.28, 9.64] }
];

function countryFor(lat, lon) {
	for (const item of COUNTRY_FEEDS) {
		const [south, west, north, east] = item.box;
		if (lat >= south && lat <= north && lon >= west && lon <= east) return item;
	}
	return null;
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
	return [...xml.matchAll(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'gi'))].map((match) => decode(match[1]));
}

function severityOf(text) {
	const value = (text || '').toLowerCase();
	if (value.includes('extreme') || value.includes('rot') || value.includes('red')) return 'extreme';
	if (value.includes('severe') || value.includes('orange')) return 'severe';
	if (value.includes('moderate') || value.includes('gelb') || value.includes('yellow')) return 'moderate';
	if (value.includes('minor') || value.includes('grün') || value.includes('green')) return 'minor';
	return 'unknown';
}

function eventLabel(text) {
	const value = (text || '').toLowerCase();
	if (value.includes('thunder') || value.includes('gewitter')) return 'Gewitter';
	if (value.includes('rain') || value.includes('regen')) return 'Starkregen';
	if (value.includes('ice') || value.includes('glatt') || value.includes('frost')) return 'Glatteis';
	if (value.includes('avalanche') || value.includes('lawine')) return 'Lawine';
	if (value.includes('snow') || value.includes('schnee')) return 'Schnee';
	if (value.includes('wind') || value.includes('sturm')) return 'Wind';
	if (value.includes('flood') || value.includes('hochwasser')) return 'Hochwasser';
	if (value.includes('fog') || value.includes('nebel')) return 'Nebel';
	if (value.includes('heat') || value.includes('hitze')) return 'Hitze';
	return text?.slice(0, 48) || 'Wetterwarnung';
}

export async function fetchMeteoalarm(lat, lon) {
	const country = countryFor(lat, lon);
	if (!country) {
		return { coverage: false, alerts: [] };
	}
	const url = `https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-${country.name}`;
	const response = await fetch(url, {
		headers: { Accept: '*/*', 'User-Agent': 'weatherapp-push/1.0' }
	});
	if (!response.ok) {
		throw new Error(`Meteoalarm ${response.status}`);
	}
	const xml = await response.text();
	const entries = xml.split(/<entry[\s>]/i).slice(1);
	const alerts = entries
		.map((chunk, index) => {
			const title = tag(chunk, 'title') || 'Warnung';
			const summary = tag(chunk, 'summary') || tag(chunk, 'cap:event') || title;
			const area = tag(chunk, 'cap:areaDesc') || tag(chunk, 'georss:name');
			return {
				id: tag(chunk, 'id') || `${country.code}-${index}`,
				event: eventLabel(tag(chunk, 'cap:event') || title),
				headline: summary.slice(0, 220),
				severity: severityOf(`${title} ${summary} ${allTags(chunk, 'category').join(' ')}`),
				onset: tag(chunk, 'cap:onset') || tag(chunk, 'cap:effective'),
				expires: tag(chunk, 'cap:expires'),
				area,
				source: `Meteoalarm ${country.code}`
			};
		})
		.slice(0, 8);
	return { coverage: true, alerts };
}
