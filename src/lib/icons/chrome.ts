import type { Component } from 'svelte';
import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right';
import Bell from '@lucide/svelte/icons/bell';
import CalendarRange from '@lucide/svelte/icons/calendar-range';
import Clock from '@lucide/svelte/icons/clock';
import CloudSun from '@lucide/svelte/icons/cloud-sun';
import Palette from '@lucide/svelte/icons/palette';
import Flower2 from '@lucide/svelte/icons/flower-2';
import LocateFixed from '@lucide/svelte/icons/locate-fixed';
import MapPin from '@lucide/svelte/icons/map-pin';
import Menu from '@lucide/svelte/icons/menu';
import Monitor from '@lucide/svelte/icons/monitor';
import Moon from '@lucide/svelte/icons/moon';
import MoreHorizontal from '@lucide/svelte/icons/more-horizontal';
import Mountain from '@lucide/svelte/icons/mountain';
import Pause from '@lucide/svelte/icons/pause';
import Play from '@lucide/svelte/icons/play';
import Radar from '@lucide/svelte/icons/radar';
import RefreshCw from '@lucide/svelte/icons/refresh-cw';
import Search from '@lucide/svelte/icons/search';
import Shirt from '@lucide/svelte/icons/shirt';
import Star from '@lucide/svelte/icons/star';
import Sun from '@lucide/svelte/icons/sun';
import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
import Waves from '@lucide/svelte/icons/waves';
import Wind from '@lucide/svelte/icons/wind';
import X from '@lucide/svelte/icons/x';

export type AppIconName =
	| 'jetzt'
	| 'stunden'
	| 'radar'
	| 'woche'
	| 'mehr'
	| 'menu'
	| 'locate'
	| 'refresh'
	| 'search'
	| 'pin'
	| 'bell'
	| 'close'
	| 'star'
	| 'play'
	| 'pause'
	| 'themeLight'
	| 'themeDark'
	| 'themeSystem'
	| 'wind'
	| 'berge'
	| 'seen'
	| 'draussen'
	| 'luft'
	| 'pendeln'
	| 'darstellung'
	| 'warning';

export type ChromeIcon = Component<{
	class?: string;
	size?: number | string;
	fill?: string;
	'aria-hidden'?: boolean | 'true' | 'false';
}>;

export const ICONS: Record<AppIconName, ChromeIcon> = {
	jetzt: CloudSun,
	stunden: Clock,
	radar: Radar,
	woche: CalendarRange,
	mehr: MoreHorizontal,
	menu: Menu,
	locate: LocateFixed,
	refresh: RefreshCw,
	search: Search,
	pin: MapPin,
	bell: Bell,
	close: X,
	star: Star,
	play: Play,
	pause: Pause,
	themeLight: Sun,
	themeDark: Moon,
	themeSystem: Monitor,
	wind: Wind,
	berge: Mountain,
	seen: Waves,
	draussen: Shirt,
	luft: Flower2,
	pendeln: ArrowLeftRight,
	darstellung: Palette,
	warning: TriangleAlert
};
