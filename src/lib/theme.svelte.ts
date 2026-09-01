import type { ThemePreference } from './types';

function readTheme(): ThemePreference {
	if (typeof localStorage === 'undefined') return 'system';
	const value = localStorage.getItem('theme');
	if (value === 'light' || value === 'dark' || value === 'system') return value;
	return 'system';
}

export const themeState = $state({
	preference: 'system' as ThemePreference,
	dark: false
});

export function applyTheme(preference = themeState.preference): void {
	const dark =
		preference === 'dark' ||
		(preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
	themeState.preference = preference;
	themeState.dark = dark;
	document.documentElement.classList.toggle('dark', dark);
	document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
	const themeColor = document.querySelector('meta[name="theme-color"]');
	if (themeColor) {
		const chrome = document.documentElement.dataset.chrome;
		if (chrome === 'desktop') {
			themeColor.setAttribute('content', dark ? '#202020' : '#f3f3f3');
		} else {
			themeColor.setAttribute('content', dark ? '#0f1415' : '#006874');
		}
	}
}

export function setTheme(preference: ThemePreference): void {
	localStorage.setItem('theme', preference);
	applyTheme(preference);
}

export function cycleTheme(): void {
	const order: ThemePreference[] = ['system', 'light', 'dark'];
	const index = order.indexOf(themeState.preference);
	setTheme(order[(index + 1) % order.length]);
}

export function initTheme(): () => void {
	themeState.preference = readTheme();
	applyTheme(themeState.preference);
	const media = window.matchMedia('(prefers-color-scheme: dark)');
	const onChange = () => {
		if (themeState.preference === 'system') applyTheme('system');
	};
	media.addEventListener('change', onChange);
	return () => media.removeEventListener('change', onChange);
}
