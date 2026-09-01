const numberDe = new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 });
const numberOne = new Intl.NumberFormat('de-CH', { maximumFractionDigits: 1 });
const weekday = new Intl.DateTimeFormat('de-CH', { weekday: 'short' });
const weekdayLong = new Intl.DateTimeFormat('de-CH', { weekday: 'long' });
const dayMonth = new Intl.DateTimeFormat('de-CH', { day: 'numeric', month: 'short' });
const timeFmt = new Intl.DateTimeFormat('de-CH', { hour: '2-digit', minute: '2-digit' });

export function formatTemp(value: number): string {
	return `${numberDe.format(Math.round(value))}°`;
}

export function formatTempExact(value: number): string {
	return `${numberOne.format(value)}°`;
}

export function formatKmH(value: number): string {
	return `${numberDe.format(Math.round(value))} km/h`;
}

export function formatMm(value: number): string {
	return `${numberOne.format(value)} mm`;
}

export function formatPercent(value: number): string {
	return `${numberDe.format(Math.round(value))} %`;
}

export function formatHpa(value: number): string {
	return `${numberDe.format(Math.round(value))} hPa`;
}

export function formatWeekday(iso: string): string {
	return weekday.format(new Date(iso));
}

export function formatWeekdayLong(iso: string): string {
	return weekdayLong.format(new Date(iso));
}

export function formatDayMonth(iso: string): string {
	return dayMonth.format(new Date(iso));
}

export function formatTime(iso: string): string {
	return timeFmt.format(new Date(iso));
}

export function formatHour(iso: string): string {
	return new Intl.DateTimeFormat('de-CH', { hour: '2-digit' }).format(new Date(iso));
}

export function placeLabel(place: { name: string; admin1?: string; country?: string }): string {
	const parts = [place.name];
	if (place.admin1 && place.admin1 !== place.name) parts.push(place.admin1);
	if (place.country) parts.push(place.country);
	return parts.join(', ');
}

export function placeShort(place: { name: string; admin1?: string; country_code?: string }): string {
	if (place.country_code && place.admin1 && place.admin1 !== place.name) {
		return `${place.name}, ${place.admin1}`;
	}
	if (place.country_code) return `${place.name}, ${place.country_code}`;
	return place.name;
}

const COMPASS = [
	'N',
	'NNO',
	'NO',
	'ONO',
	'O',
	'OSO',
	'SO',
	'SSO',
	'S',
	'SSW',
	'SW',
	'WSW',
	'W',
	'WNW',
	'NW',
	'NNW'
] as const;

export function windDirection(degrees: number): string {
	const index = Math.round(degrees / 22.5) % 16;
	return COMPASS[index] ?? 'N';
}

export function isSameCalendarDay(a: string, b: string): boolean {
	return a.slice(0, 10) === b.slice(0, 10);
}

export function hoursOnDay<T extends { time: string }>(hours: T[], date: string): T[] {
	return hours.filter((hour) => isSameCalendarDay(hour.time, date));
}
