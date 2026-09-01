export type Chrome = 'android' | 'desktop' | 'ios';
export type ChromePreference = Chrome | 'auto';

export const LG_BREAKPOINT = 1024;

export function resolveChrome(preference: ChromePreference, width: number): Chrome {
	if (preference !== 'auto') return preference;
	return width >= LG_BREAKPOINT ? 'desktop' : 'android';
}

export function panelClass(chrome: Chrome): string {
	if (chrome === 'desktop') {
		return 'rounded-md bg-card ring-1 ring-border';
	}
	return 'rounded-3xl bg-card';
}

export function listTileClass(chrome: Chrome, selected = false): string {
	if (chrome === 'desktop') {
		return selected
			? 'rounded-md bg-primary/10 ring-1 ring-border'
			: 'rounded-md bg-card ring-1 ring-border';
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
	return 'bottom-[calc(6.75rem+env(safe-area-inset-bottom,0px))] right-[max(1rem,env(safe-area-inset-right,0px))]';
}

export function sectionId(id: string): string {
	return id;
}
