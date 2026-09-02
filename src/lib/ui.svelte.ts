import { settingsUi } from './commute.svelte';
import {
	parseRouteHash,
	sectionHash,
	topicHash,
	type SectionId,
	type TopicId
} from './nav';
import { weatherState } from './weather.svelte';

export const uiState = $state({
	topic: null as TopicId | null,
	topicReturn: 'jetzt' as SectionId,
	drawer: false
});

function writeHash(hash: string): void {
	const next = `#${hash}`;
	if (typeof location === 'undefined') return;
	if (location.hash !== next) {
		history.pushState(null, '', next);
	}
}

export function goSection(id: SectionId, persist = true): void {
	uiState.topic = null;
	uiState.drawer = false;
	uiState.topicReturn = id;
	weatherState.section = id;
	settingsUi.open = false;
	if (persist) writeHash(sectionHash(id));
	if (typeof window !== 'undefined') {
		window.scrollTo({ top: 0 });
	}
}

export function openTopic(id: TopicId, persist = true): void {
	uiState.drawer = false;
	uiState.topicReturn = weatherState.section;
	uiState.topic = id;
	settingsUi.open = false;
	if (persist) writeHash(topicHash(id));
}

export function closeTopic(persist = true): void {
	uiState.topic = null;
	settingsUi.open = false;
	if (persist) writeHash(sectionHash(uiState.topicReturn));
}

export function setDrawer(open: boolean): void {
	uiState.drawer = open;
}

export function applyHash(hash = typeof location === 'undefined' ? '' : location.hash): void {
	const route = parseRouteHash(hash);
	weatherState.section = route.section;
	uiState.topic = route.topic;
	uiState.topicReturn = route.section;
	uiState.drawer = false;
	settingsUi.open = false;
}

export function initRoutes(): () => void {
	if (!location.hash) {
		history.replaceState(null, '', `#${sectionHash(weatherState.section)}`);
	}
	applyHash(location.hash);
	const onHash = () => applyHash(location.hash);
	window.addEventListener('hashchange', onHash);
	window.addEventListener('popstate', onHash);
	return () => {
		window.removeEventListener('hashchange', onHash);
		window.removeEventListener('popstate', onHash);
	};
}
