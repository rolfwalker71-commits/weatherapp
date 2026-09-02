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
	blockedReason?: string;
}

function isLocalHost(hostname = typeof location === 'undefined' ? '' : location.hostname): boolean {
	return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

export function pushBlockedReason(): string | null {
	if (typeof window === 'undefined') return null;
	if (!window.isSecureContext && !isLocalHost()) {
		return 'Benachrichtigungen brauchen HTTPS. Über HTTP blockiert der Browser Push (außer localhost).';
	}
	if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
		return 'Dieser Browser unterstützt kein Web Push.';
	}
	if (Notification.permission === 'denied') {
		return 'Benachrichtigungen sind blockiert. In den Browser-Einstellungen für diese Seite erlauben.';
	}
	return null;
}

async function readError(response: Response): Promise<string> {
	try {
		const body = (await response.json()) as { error?: string; hint?: string };
		if (body?.error) return body.hint ? `${body.error}. ${body.hint}` : body.error;
	} catch {
		/* ignore non-JSON */
	}
	return `Push-API ${response.status}`;
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
		throw new Error(await readError(response));
	}
	return (await response.json()) as T;
}

export async function fetchPushStatus(): Promise<PushStatus> {
	const blocked = pushBlockedReason();
	try {
		const data = await request<PushStatus>('/v1/status');
		return {
			...data,
			ok: true,
			configured: true,
			blockedReason: blocked ?? undefined,
			message: blocked
				? blocked
				: data.sendingEnabled
					? 'Push ist bereit. Kategorie einschalten oder Gerät anmelden.'
					: 'Push-Server bereit. Versand ist noch aus — Kategorien werden gespeichert.'
		};
	} catch {
		return {
			ok: false,
			configured: false,
			sendingEnabled: false,
			hasVapid: false,
			blockedReason: blocked ?? undefined,
			message: blocked ?? 'Push-API nicht erreichbar. Container neu laden (docker compose pull && up -d).'
		};
	}
}

export async function fetchVapidPublicKey(): Promise<string | null> {
	const data = await request<{ publicKey: string | null }>('/v1/vapid-public-key');
	return data.publicKey;
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

export type PushPlace = { latitude: number; longitude: number; name: string; timezone?: string };

export async function registerSubscription(
	subscription: PushSubscription,
	prefs = loadNotifyPrefs(),
	place?: PushPlace
) {
	const json = subscription.toJSON();
	await request('/v1/subscriptions', {
		method: 'POST',
		body: JSON.stringify({
			endpoint: json.endpoint,
			keys: json.keys,
			clientId: getPushClientId(),
			userAgent: navigator.userAgent,
			preferences: prefs,
			place
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

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(message)), ms);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(error) => {
				clearTimeout(timer);
				reject(error);
			}
		);
	});
}

async function ensureServiceWorker(): Promise<ServiceWorkerRegistration> {
	const existing = await navigator.serviceWorker.getRegistration('/');
	if (existing?.active) return existing;
	try {
		await navigator.serviceWorker.register('/sw.js', { scope: '/' });
	} catch {
		await navigator.serviceWorker.register('/push-sw.js', { scope: '/' });
	}
	return withTimeout(
		navigator.serviceWorker.ready,
		8000,
		'Service Worker startet nicht. Seite neu laden — auf HTTP (nicht localhost) blockiert der Browser Push.'
	);
}

export async function enablePush(
	prefs: NotifyPrefs,
	place?: PushPlace
): Promise<{ ok: boolean; message: string }> {
	const blocked = pushBlockedReason();
	if (blocked && !blocked.includes('blockiert. In den Browser-Einstellungen')) {
		return { ok: false, message: blocked };
	}
	if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
		return { ok: false, message: 'Dieser Browser unterstützt kein Web Push.' };
	}

	let key: string | null;
	try {
		key = await fetchVapidPublicKey();
	} catch (error) {
		return {
			ok: false,
			message: error instanceof Error ? error.message : 'VAPID-Schlüssel konnte nicht geladen werden.'
		};
	}
	if (!key) {
		return { ok: false, message: 'VAPID-Schlüssel fehlt. Wetter-Container neu starten.' };
	}

	if (!('Notification' in window)) {
		return { ok: false, message: 'Dieser Browser unterstützt keine Benachrichtigungen.' };
	}
	const permission = await Notification.requestPermission();
	if (permission === 'denied') {
		return {
			ok: false,
			message: 'Benachrichtigungen sind blockiert. In den Browser-Einstellungen für diese Seite erlauben.'
		};
	}
	if (permission !== 'granted') {
		return { ok: false, message: 'Benachrichtigungen wurden nicht erlaubt.' };
	}

	let registration: ServiceWorkerRegistration;
	try {
		registration = await ensureServiceWorker();
	} catch (error) {
		return {
			ok: false,
			message: error instanceof Error ? error.message : 'Service Worker konnte nicht registriert werden.'
		};
	}

	try {
		const existing = await registration.pushManager.getSubscription();
		const subscription =
			existing ??
			(await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(key)
			}));
		await registerSubscription(subscription, prefs, place);
	} catch (error) {
		const text = error instanceof Error ? error.message : 'Anmeldung fehlgeschlagen.';
		if (/registration failed|push service|aborted/i.test(text)) {
			return {
				ok: false,
				message: 'Push-Anmeldung fehlgeschlagen. HTTPS prüfen oder Seite neu laden.'
			};
		}
		return { ok: false, message: text };
	}

	const status = await fetchPushStatus();
	return {
		ok: true,
		message: status.sendingEnabled
			? 'Gerät angemeldet. Der Server sendet nach den gewählten Kategorien.'
			: 'Abonnement und Ort gespeichert. Versand ist aus (PUSH_SEND_ENABLED=false).'
	};
}

export async function disablePush(): Promise<void> {
	if (!('serviceWorker' in navigator)) return;
	const registration = await navigator.serviceWorker.getRegistration('/');
	if (!registration) return;
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
