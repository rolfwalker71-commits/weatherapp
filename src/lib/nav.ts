import type { AppIconName } from '$lib/icons/chrome';

export type SectionId = 'jetzt' | 'stunden' | 'radar' | 'woche' | 'mehr';
export type TopicId =
	| 'wind'
	| 'berge'
	| 'seen'
	| 'draussen'
	| 'luft'
	| 'pendeln'
	| 'meldungen'
	| 'darstellung';

export interface NavItem {
	id: SectionId;
	label: string;
	railLabel: string;
	icon: AppIconName;
	iconClass: string;
	pill: string;
}

export interface TopicItem {
	id: TopicId;
	label: string;
	icon: AppIconName;
	iconClass: string;
}

export const NAV_ITEMS: NavItem[] = [
	{
		id: 'jetzt',
		label: 'Jetzt',
		railLabel: 'Jetzt',
		icon: 'jetzt',
		iconClass: 'wx-icon-clear',
		pill: 'wx-chip-clear'
	},
	{
		id: 'stunden',
		label: '24h',
		railLabel: '24 Stunden',
		icon: 'stunden',
		iconClass: 'wx-icon-clock',
		pill: 'wx-chip-rain'
	},
	{
		id: 'radar',
		label: 'Radar',
		railLabel: 'Radar',
		icon: 'radar',
		iconClass: 'wx-icon-rain',
		pill: 'wx-chip-rain'
	},
	{
		id: 'woche',
		label: 'Woche',
		railLabel: '7 Tage',
		icon: 'woche',
		iconClass: 'wx-icon-week',
		pill: 'wx-chip-storm'
	},
	{
		id: 'mehr',
		label: 'Mehr',
		railLabel: 'Mehr',
		icon: 'mehr',
		iconClass: 'wx-icon-cloud',
		pill: 'wx-chip-cloud'
	}
];

export const TOPIC_CHIPS: TopicItem[] = [
	{ id: 'wind', label: 'Wind', icon: 'wind', iconClass: 'wx-icon-wind' },
	{ id: 'berge', label: 'Berge', icon: 'berge', iconClass: 'wx-icon-snow' },
	{ id: 'seen', label: 'Seen', icon: 'seen', iconClass: 'wx-icon-rain' },
	{ id: 'draussen', label: 'Draußen', icon: 'draussen', iconClass: 'wx-icon-thermo' },
	{ id: 'luft', label: 'Luft', icon: 'luft', iconClass: 'wx-icon-flower' },
	{ id: 'pendeln', label: 'Pendeln', icon: 'pendeln', iconClass: 'wx-icon-week' }
];

export const MEHR_GROUPS: { title: string; items: TopicItem[] }[] = [
	{
		title: 'Wetter',
		items: [
			{ id: 'luft', label: 'Luft', icon: 'luft', iconClass: 'wx-icon-flower' },
			{ id: 'seen', label: 'Seen', icon: 'seen', iconClass: 'wx-icon-rain' },
			{ id: 'berge', label: 'Berge', icon: 'berge', iconClass: 'wx-icon-snow' },
			{ id: 'draussen', label: 'Draußen', icon: 'draussen', iconClass: 'wx-icon-thermo' },
			{ id: 'pendeln', label: 'Pendeln', icon: 'pendeln', iconClass: 'wx-icon-week' }
		]
	},
	{
		title: 'App',
		items: [
			{ id: 'meldungen', label: 'Meldungen', icon: 'bell', iconClass: 'wx-icon-week' },
			{ id: 'darstellung', label: 'Darstellung', icon: 'darstellung', iconClass: 'wx-icon-night' }
		]
	}
];

const SECTION_HASH: Record<SectionId, string> = {
	jetzt: 'jetzt',
	stunden: '24h',
	radar: 'radar',
	woche: 'woche',
	mehr: 'mehr'
};

const SECTION_ALIASES: Record<string, SectionId> = {
	'': 'jetzt',
	jetzt: 'jetzt',
	aktuell: 'jetzt',
	heute: 'jetzt',
	stunden: 'stunden',
	'24h': 'stunden',
	radar: 'radar',
	woche: 'woche',
	mehr: 'mehr'
};

const TOPIC_ALIASES: Record<string, TopicId> = {
	wind: 'wind',
	berge: 'berge',
	seen: 'seen',
	draussen: 'draussen',
	'draußen': 'draussen',
	luft: 'luft',
	pendeln: 'pendeln',
	meldungen: 'meldungen',
	darstellung: 'darstellung'
};

export function isSectionId(value: string): value is SectionId {
	return value in SECTION_HASH;
}

export function isTopicId(value: string): value is TopicId {
	return value in TOPIC_ALIASES && TOPIC_ALIASES[value] === value;
}

export function sectionHash(id: SectionId): string {
	return SECTION_HASH[id];
}

export function topicHash(id: TopicId): string {
	return id;
}

export function parseRouteHash(hash: string): { section: SectionId; topic: TopicId | null } {
	const key = decodeURIComponent(hash.replace(/^#/, '')).trim().toLowerCase();
	if (key in TOPIC_ALIASES) {
		return { section: 'jetzt', topic: TOPIC_ALIASES[key] };
	}
	if (key in SECTION_ALIASES) {
		return { section: SECTION_ALIASES[key], topic: null };
	}
	return { section: 'jetzt', topic: null };
}
