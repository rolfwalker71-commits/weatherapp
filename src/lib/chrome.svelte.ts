import { resolveChrome, type Chrome, type ChromePreference } from './platform';
import { applyTheme, themeState } from './theme.svelte';

function readPreference(): ChromePreference {
	if (typeof localStorage === 'undefined') return 'auto';
	const value = localStorage.getItem('chrome-pref');
	if (value === 'android' || value === 'desktop' || value === 'ios' || value === 'auto') {
		return value;
	}
	return 'auto';
}

export const chromeState = $state({
	preference: 'auto' as ChromePreference,
	chrome: 'ios' as Chrome,
	width: 0
});

/** iPad-class width in the iOS design (iPad mini portrait is 744 pt); Split View below that stays phone-like. */
export const TABLET_MIN_WIDTH = 744;

export function isTabletLayout(): boolean {
	return chromeState.chrome === 'ios' && chromeState.width >= TABLET_MIN_WIDTH;
}

function applyChrome(): void {
	chromeState.width = window.innerWidth;
	const next = resolveChrome(chromeState.preference);
	chromeState.chrome = next;
	document.documentElement.dataset.chrome = next;
	if (typeof document !== 'undefined') {
		applyTheme(themeState.preference);
	}
}

export function initChrome(): () => void {
	chromeState.preference = readPreference();
	applyChrome();
	const media = window.matchMedia('(min-width: 1024px)');
	media.addEventListener('change', applyChrome);
	window.addEventListener('resize', applyChrome);
	return () => {
		media.removeEventListener('change', applyChrome);
		window.removeEventListener('resize', applyChrome);
	};
}
