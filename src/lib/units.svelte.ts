import type { WindUnit } from './types';
import { shareWidgetWindUnit } from './widget-bridge';

const KEY = 'weather.windUnit';

function readUnit(): WindUnit {
	if (typeof localStorage === 'undefined') return 'kmh';
	const value = localStorage.getItem(KEY);
	return value === 'ms' ? 'ms' : 'kmh';
}

export const unitsState = $state({
	wind: 'kmh' as WindUnit
});

export function setWindUnit(unit: WindUnit): void {
	unitsState.wind = unit;
	shareWidgetWindUnit(unit);
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(KEY, unit);
}

export function initUnits(): void {
	unitsState.wind = readUnit();
	shareWidgetWindUnit(unitsState.wind);
}
