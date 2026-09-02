import type { AppIconName } from '$lib/icons/chrome';

export type SectionId = 'jetzt' | 'radar' | 'woche' | 'luft' | 'mehr';
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
		railLabel: 'Woche',
		icon: 'woche',
		iconClass: 'wx-icon-week',
		pill: 'wx-chip-storm'
	},
	{
		id: 'luft',
		label: 'Luft',
		railLabel: 'Luft',
		icon: 'luft',
		iconClass: 'wx-icon-flower',
		pill: 'wx-chip-cloud'
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
	{ id: 'pendeln', label: 'Pendeln', icon: 'pendeln', iconClass: 'wx-icon-week' }
];

export const MEHR_GROUPS: { title: string; items: TopicItem[] }[] = [
	{
		title: 'Wetter',
		items: [
			{ id: 'pendeln', label: 'Pendeln', icon: 'pendeln', iconClass: 'wx-icon-week' },
			{ id: 'draussen', label: 'Draußen', icon: 'draussen', iconClass: 'wx-icon-thermo' },
			{ id: 'wind', label: 'Wind', icon: 'wind', iconClass: 'wx-icon-wind' }
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
	radar: 'radar',
	woche: 'woche',
	luft: 'luft',
	mehr: 'mehr'
};

const SECTION_ALIASES: Record<string, SectionId> = {
	'': 'jetzt',
	jetzt: 'jetzt',
	aktuell: 'jetzt',
	heute: 'jetzt',
	stunden: 'jetzt',
	'24h': 'jetzt',
	radar: 'radar',
	woche: 'woche',
	luft: 'luft',
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

const TOPIC_SECTION: Record<TopicId, SectionId> = {
	wind: 'jetzt',
	berge: 'woche',
	seen: 'woche',
	draussen: 'mehr',
	luft: 'luft',
	pendeln: 'mehr',
	meldungen: 'mehr',
	darstellung: 'mehr'
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

export function topicSection(id: TopicId): SectionId {
	return TOPIC_SECTION[id];
}

export function parseRouteHash(hash: string): { section: SectionId; topic: TopicId | null } {
	const key = decodeURIComponent(hash.replace(/^#/, '')).trim().toLowerCase();
	if (key in TOPIC_ALIASES) {
		const topic = TOPIC_ALIASES[key];
		return { section: TOPIC_SECTION[topic], topic: null };
	}
	if (key in SECTION_ALIASES) {
		return { section: SECTION_ALIASES[key], topic: null };
	}
	return { section: 'jetzt', topic: null };
}
