export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const toRad = (value: number) => (value * Math.PI) / 180;
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
	return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isSwitzerland(place: { country_code?: string; latitude: number; longitude: number }): boolean {
	if (place.country_code?.toUpperCase() === 'CH') return true;
	return place.latitude >= 45.8 && place.latitude <= 47.85 && place.longitude >= 5.9 && place.longitude <= 10.55;
}

export function inMittelland(lat: number, lon: number): boolean {
	return lat >= 46.7 && lat <= 47.65 && lon >= 6.4 && lon <= 9.7;
}

export function southOfAlps(lat: number): boolean {
	return lat < 46.35;
}
