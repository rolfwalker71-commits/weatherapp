import { resolveChrome, type Chrome, type ChromePreference } from './platform';

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
	chrome: 'android' as Chrome
});

function applyChrome(): void {
	const next = resolveChrome(chromeState.preference, window.innerWidth);
	chromeState.chrome = next;
	document.documentElement.dataset.chrome = next;
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
