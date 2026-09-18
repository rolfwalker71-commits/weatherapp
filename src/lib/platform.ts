import { Capacitor } from '@capacitor/core';

export type Chrome = 'android' | 'desktop' | 'ios';
export type ChromePreference = Chrome | 'auto';

export const LG_BREAKPOINT = 1024;

/** True inside the Capacitor shell (iOS app), false in the browser/PWA. */
export function isNativeApp(): boolean {
	return Capacitor.isNativePlatform();
}

/** Production host; the iOS app loads from the bundle, so server routes need an absolute URL. */
export const APP_ORIGIN = 'https://myweather.rolfwalker.ch';

/** Resolves a same-origin server path (e.g. `/api/push`) for the current runtime. */
export function serverUrl(path: string): string {
	return isNativeApp() ? `${APP_ORIGIN}${path}` : path;
}

/** iPhone/iPod. iPad stays on the width-based choice: its wide layout is the desktop one. */
export function isAppleMobile(): boolean {
	if (typeof navigator === 'undefined') return false;
	return /iPhone|iPod/.test(navigator.userAgent);
}

export function resolveChrome(preference: ChromePreference, width: number): Chrome {
	if (preference !== 'auto') return preference;
	if (Capacitor.getPlatform() === 'ios' || isAppleMobile()) return 'ios';
	return width >= LG_BREAKPOINT ? 'desktop' : 'android';
}

export function panelClass(chrome: Chrome): string {
	if (chrome === 'desktop') {
		return 'w-full min-w-0 max-w-full rounded-md bg-card ring-1 ring-border';
	}
	if (chrome === 'ios') return 'w-full min-w-0 max-w-full rounded-[1.375rem] bg-card';
	return 'w-full min-w-0 max-w-full rounded-3xl bg-card';
}

export function listTileClass(chrome: Chrome, selected = false): string {
	if (chrome === 'desktop') {
		return selected
			? 'rounded-md bg-primary/10 ring-1 ring-border'
			: 'rounded-md bg-card ring-1 ring-border';
	}
	if (chrome === 'ios') {
		return selected ? 'rounded-xl bg-primary text-on-primary' : 'rounded-xl bg-muted';
	}
	return selected ? 'rounded-3xl bg-secondary text-primary' : 'rounded-3xl bg-card';
}

export function dockBarClass(): string {
	return 'lg:hidden border-t border-border bg-card';
}

export function fabClass(chrome: Chrome): string {
	if (chrome === 'desktop') {
		return 'size-12 shrink-0 rounded-md bg-primary text-on-primary';
	}
	return 'size-16 min-h-16 min-w-16 shrink-0 rounded-[1.75rem] bg-primary text-on-primary';
}

export function fabClearance(chrome: Chrome): string {
	if (chrome === 'desktop') return 'bottom-6 right-6';
	return 'bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] right-[max(1rem,env(safe-area-inset-right,0px))]';
}

export function sectionId(id: string): string {
	return id;
}
