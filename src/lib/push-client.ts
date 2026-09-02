import { env } from '$env/dynamic/public';
import { getPushClientId, loadNotifyPrefs } from './notify-prefs';
import type { AlertItem, AvalancheBulletin, NotifyPrefs } from './types';

export function pushApiBase(): string {
	const configured = env.PUBLIC_PUSH_API_URL?.trim();
	if (configured) return configured.replace(/\/$/, '');
	return '/api/push';
}

export interface PushStatus {
	ok: boolean;
	configured: boolean;
	sendingEnabled: boolean;
	hasVapid: boolean;
	message: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`${pushApiBase()}${path}`, {
		...init,
		headers: {
			Accept: 'application/json',
			...(init?.body ? { 'Content-Type': 'application/json' } : {}),
			...init?.headers
		}
	});
	if (!response.ok) {
		throw new Error(`Push-API ${response.status}`);
	}
	return (await response.json()) as T;
}

export async function fetchPushStatus(): Promise<PushStatus> {
	try {
		const data = await request<PushStatus>('/v1/status');
		return {
			...data,
			ok: true,
			configured: true,
			message: data.sendingEnabled
				? 'Push-Server bereit, Versand ist eingeschaltet.'
				: 'Push-Server bereit. Versand ist noch aus — Kategorien werden gespeichert.'
		};
	} catch {
		return {
			ok: false,
			configured: false,
			sendingEnabled: false,
			hasVapid: false,
			message: 'Push-Server nicht konfiguriert'
		};
	}
}

export async function fetchVapidPublicKey(): Promise<string | null> {
	try {
		const data = await request<{ publicKey: string | null }>('/v1/vapid-public-key');
		return data.publicKey;
	} catch {
		return null;
	}
}

export async function syncPreferences(prefs: NotifyPrefs, place?: { latitude: number; longitude: number; name: string; timezone?: string }) {
	await request('/v1/preferences', {
		method: 'PUT',
		body: JSON.stringify({
			clientId: getPushClientId(),
			preferences: prefs,
			place
		})
	});
}

export async function registerSubscription(subscription: PushSubscription, prefs = loadNotifyPrefs()) {
	const json = subscription.toJSON();
	await request('/v1/subscriptions', {
		method: 'POST',
		body: JSON.stringify({
			endpoint: json.endpoint,
			keys: json.keys,
			clientId: getPushClientId(),
			userAgent: navigator.userAgent,
			preferences: prefs
		})
	});
}

export async function unregisterSubscription(endpoint: string) {
	await request('/v1/subscriptions', {
		method: 'DELETE',
		body: JSON.stringify({ endpoint, clientId: getPushClientId() })
	});
}

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
	const padding = '='.repeat((4 - (base64.length % 4)) % 4);
	const raw = atob(base64.replace(/-/g, '+').replace(/_/g, '/') + padding);
	const output = new Uint8Array(raw.length);
	for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
	return output.buffer;
}

export async function enablePush(prefs: NotifyPrefs): Promise<{ ok: boolean; message: string }> {
	if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
		return { ok: false, message: 'Dieser Browser unterstützt kein Web Push.' };
	}
	const key = await fetchVapidPublicKey();
	if (!key) {
		return { ok: false, message: 'Push-Server nicht konfiguriert' };
	}
	const permission = await Notification.requestPermission();
	if (permission !== 'granted') {
		return { ok: false, message: 'Benachrichtigungen wurden nicht erlaubt.' };
	}
	const registration = await navigator.serviceWorker.ready;
	const existing = await registration.pushManager.getSubscription();
	const subscription =
		existing ??
		(await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: urlBase64ToUint8Array(key)
		}));
	await registerSubscription(subscription, prefs);
	return { ok: true, message: 'Abonnement gespeichert. Versand bleibt aus, bis du ihn aktivierst.' };
}

export async function disablePush(): Promise<void> {
	if (!('serviceWorker' in navigator)) return;
	const registration = await navigator.serviceWorker.ready;
	const subscription = await registration.pushManager.getSubscription();
	if (subscription) {
		try {
			await unregisterSubscription(subscription.endpoint);
		} catch {
			/* local unsubscribe still happens */
		}
		await subscription.unsubscribe();
	}
}

export async function fetchAlerts(lat: number, lon: number): Promise<AlertItem[]> {
	try {
		const data = await request<{ alerts: AlertItem[] }>(`/v1/alerts?lat=${lat}&lon=${lon}`);
		return data.alerts ?? [];
	} catch {
		return [];
	}
}

export async function fetchAvalanche(lat: number, lon: number): Promise<AvalancheBulletin> {
	try {
		return await request<AvalancheBulletin>(`/v1/avalanche?lat=${lat}&lon=${lon}`);
	} catch {
		return {
			available: false,
			level: null,
			label: 'nicht verfügbar',
			validUntil: null,
			source: 'SLF',
			note: 'Kein öffentlicher Feed erreichbar — keine Schätzwerte.'
		};
	}
}
