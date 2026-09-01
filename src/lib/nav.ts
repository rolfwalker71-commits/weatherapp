import CalendarRange from '@lucide/svelte/icons/calendar-range';
import Clock from '@lucide/svelte/icons/clock';
import CloudSun from '@lucide/svelte/icons/cloud-sun';
import Flower2 from '@lucide/svelte/icons/flower-2';
import Radar from '@lucide/svelte/icons/radar';
import type { Component } from 'svelte';

export type SectionId = 'aktuell' | 'stunden' | 'woche' | 'radar' | 'luft';

export interface NavItem {
	id: SectionId;
	label: string;
	railLabel: string;
	icon: Component<{ class?: string }>;
	iconClass: string;
	pill: string;
}

export const NAV_ITEMS: NavItem[] = [
	{
		id: 'aktuell',
		label: 'Heute',
		railLabel: 'Heute',
		icon: CloudSun,
		iconClass: 'wx-icon-clear',
		pill: 'wx-chip-clear'
	},
	{
		id: 'stunden',
		label: '24h',
		railLabel: '24 Stunden',
		icon: Clock,
		iconClass: 'wx-icon-clock',
		pill: 'wx-chip-rain'
	},
	{
		id: 'radar',
		label: 'Radar',
		railLabel: 'Radar',
		icon: Radar,
		iconClass: 'wx-icon-rain',
		pill: 'wx-chip-rain'
	},
	{
		id: 'woche',
		label: 'Woche',
		railLabel: '7 Tage',
		icon: CalendarRange,
		iconClass: 'wx-icon-week',
		pill: 'wx-chip-storm'
	},
	{
		id: 'luft',
		label: 'Luft',
		railLabel: 'Luft & Pollen',
		icon: Flower2,
		iconClass: 'wx-icon-flower',
		pill: 'wx-chip-storm'
	}
];
