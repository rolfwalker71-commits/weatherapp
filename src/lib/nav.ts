import type { AppIconName } from '$lib/icons/chrome';

export type SectionId = 'jetzt' | 'radar' | 'woche' | 'luft' | 'mehr' | 'favoriten' | 'einstellungen';
export type TopicId =
	| 'wind'
	| 'berge'
	| 'seen'
	| 'draussen'
	| 'luft'
	| 'pendeln'
	| 'meldungen'
	| 'darstellung';
export type MehrId = TopicId | 'favoriten' | 'einstellungen';

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

export interface MehrItem {
	id: MehrId;
	label: string;
	icon: AppIconName;
	iconClass: string;
}

const JETZT: NavItem = {
	id: 'jetzt',
	label: 'Jetzt',
	railLabel: 'Jetzt',
	icon: 'jetzt',
	iconClass: 'wx-icon-clear',
	pill: 'wx-chip-clear'
};

const RADAR: NavItem = {
	id: 'radar',
	label: 'Radar',
	railLabel: 'Radar',
	icon: 'radar',
	iconClass: 'wx-icon-rain',
	pill: 'wx-chip-rain'
};

const WOCHE: NavItem = {
	id: 'woche',
	label: 'Woche',
	railLabel: 'Woche',
	icon: 'woche',
	iconClass: 'wx-icon-week',
	pill: 'wx-chip-storm'
};

const LUFT: NavItem = {
	id: 'luft',
	label: 'Luft',
	railLabel: 'Luft',
	icon: 'luft',
	iconClass: 'wx-icon-flower',
	pill: 'wx-chip-cloud'
};

const FAVORITEN: NavItem = {
	id: 'favoriten',
	label: 'Favoriten',
	railLabel: 'Favoriten',
	icon: 'star',
	iconClass: 'wx-icon-star',
	pill: 'wx-chip-clear'
};

const MEHR: NavItem = {
	id: 'mehr',
	label: 'Mehr',
	railLabel: 'Mehr',
	icon: 'mehr',
	iconClass: 'wx-icon-cloud',
	pill: 'wx-chip-cloud'
};

/** Mobile bottom nav — MY3E max 5. Favoriten and Einstellungen live in Mehr. */
export const NAV_ITEMS: NavItem[] = [JETZT, RADAR, WOCHE, LUFT, MEHR];

/** Desktop Fluent rail may exceed 5. Favoriten is a first-class point. */
export const RAIL_ITEMS: NavItem[] = [JETZT, RADAR, WOCHE, LUFT, FAVORITEN, MEHR];

export const TOPIC_CHIPS: TopicItem[] = [
	{ id: 'wind', label: 'Wind', icon: 'wind', iconClass: 'wx-icon-wind' },
	{ id: 'berge', label: 'Berge', icon: 'berge', iconClass: 'wx-icon-snow' },
	{ id: 'seen', label: 'Seen', icon: 'seen', iconClass: 'wx-icon-rain' },
	{ id: 'draussen', label: 'Draußen', icon: 'draussen', iconClass: 'wx-icon-thermo' },
	{ id: 'pendeln', label: 'Pendeln', icon: 'pendeln', iconClass: 'wx-icon-week' }
];

export const MEHR_GROUPS: { title: string; items: MehrItem[] }[] = [
	{
		title: 'Orte',
		items: [{ id: 'favoriten', label: 'Favoriten', icon: 'star', iconClass: 'wx-icon-star' }]
	},
	{
		title: 'Wetter',
		items: [
			{ id: 'pendeln', label: 'Pendeln', icon: 'pendeln', iconClass: 'wx-icon-week' },
			{ id: 'draussen', label: 'Draußen', icon: 'draussen', iconClass: 'wx-icon-thermo' },
			{ id: 'wind', label: 'Wind', icon: 'wind', iconClass: 'wx-icon-wind' },
			{ id: 'berge', label: 'Berge', icon: 'berge', iconClass: 'wx-icon-snow' },
			{ id: 'seen', label: 'Seen', icon: 'seen', iconClass: 'wx-icon-rain' }
		]
	},
	{
		title: 'App',
		items: [
			{ id: 'einstellungen', label: 'Einstellungen', icon: 'settings', iconClass: 'wx-icon-week' }
		]
	}
];

const SECTION_HASH: Record<SectionId, string> = {
	jetzt: 'jetzt',
	radar: 'radar',
	woche: 'woche',
	luft: 'luft',
	mehr: 'mehr',
	favoriten: 'favoriten',
	einstellungen: 'einstellungen'
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
	mehr: 'mehr',
	favoriten: 'favoriten',
	einstellungen: 'einstellungen',
	settings: 'einstellungen'
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
	meldungen: 'einstellungen',
	darstellung: 'einstellungen'
};

export function isMehrSection(id: MehrId): id is 'favoriten' | 'einstellungen' {
	return id === 'favoriten' || id === 'einstellungen';
}

export function navItemCurrent(
	itemId: SectionId,
	section: SectionId,
	surface: 'dock' | 'rail'
): boolean {
	if (itemId === section) return true;
	if (itemId !== 'mehr') return false;
	if (section === 'einstellungen') return true;
	return section === 'favoriten' && surface === 'dock';
}

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
