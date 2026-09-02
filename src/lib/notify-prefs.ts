import type { NotifyPrefs } from './types';

const PREFS_KEY = 'weather.notifyPrefs';
const CLIENT_KEY = 'weather.pushClientId';

export const DEFAULT_PREFS: NotifyPrefs = {
	rainSoon: false,
	warnings: false,
	frost: false,
	uv: false,
	air: false,
	dailyBrief: false
};

export const PREF_META: { id: keyof NotifyPrefs; label: string; hint: string }[] = [
	{ id: 'rainSoon', label: 'Regen bald', hint: 'Niederschlag in der nächsten Stunde' },
	{ id: 'warnings', label: 'Warnungen', hint: 'Meteoalarm / Unwetter am gespeicherten Ort' },
	{ id: 'frost', label: 'Frost', hint: 'Glatteis und Temperaturen um den Gefrierpunkt' },
	{ id: 'uv', label: 'UV hoch', hint: 'Starke Sonne am Tag' },
	{ id: 'air', label: 'Luft & Pollen', hint: 'Schlechte Luft oder starker Pollenflug' },
	{ id: 'dailyBrief', label: 'Morgenbriefing', hint: 'Kurzer Überblick am Morgen' }
];

function readJson<T>(key: string, fallback: T): T {
	if (typeof localStorage === 'undefined') return fallback;
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return fallback;
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}

export function loadNotifyPrefs(): NotifyPrefs {
	const stored = readJson<Partial<NotifyPrefs>>(PREFS_KEY, {});
	return { ...DEFAULT_PREFS, ...stored };
}

export function saveNotifyPrefs(prefs: NotifyPrefs): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function getPushClientId(): string {
	if (typeof localStorage === 'undefined') return 'anonymous';
	const existing = localStorage.getItem(CLIENT_KEY);
	if (existing) return existing;
	const id =
		typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? crypto.randomUUID()
			: `wx-${Date.now()}-${Math.random().toString(16).slice(2)}`;
	localStorage.setItem(CLIENT_KEY, id);
	return id;
}
