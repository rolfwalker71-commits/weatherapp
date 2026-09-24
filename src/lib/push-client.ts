import { env } from '$env/dynamic/public';
import { getPushClientId, loadNotifyPrefs } from './notify-prefs';
import { disableNativePush, enableNativePush, initNativePush } from './native-push';
import { isNativeApp, serverUrl } from './platform';
import type { AlertItem, AvalancheBulletin, NotifyPrefs } from './types';

export function pushApiBase(): string {
	const configured = env.PUBLIC_PUSH_API_URL?.trim();
	if (configured) return configured.replace(/\/$/, '');
	return serverUrl('/api/push');
}

export interface PushStatus {
	ok: boolean;
	configured: boolean;
	sendingEnabled: boolean;
	hasVapid: boolean;
	/** Server can reach iPhones (APNs key, or simulator transport in development). */
	hasApns?: boolean;
	message: string;
	blockedReason?: string;
}

function isLocalHost(hostname = typeof location === 'undefined' ? '' : location.hostname): boolean {
	return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function isAppleMobile(): boolean {
	return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
	return (
		(navigator as Navigator & { standalone?: boolean }).standalone === true ||
		window.matchMedia?.('(display-mode: standalone)').matches === true
	);
}

export function pushBlockedReason(): string | null {
	if (typeof window === 'undefined') return null;
	// iOS app: Apple Push, not Web Push; permission is asked when enabling.
	if (isNativeApp()) return null;
	if (!window.isSecureContext && !isLocalHost()) {
		return 'Benachrichtigungen brauchen HTTPS. Über HTTP blockiert der Browser Push (außer localhost).';
	}
	if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
		if (isAppleMobile() && !isStandalone()) {
			return 'Auf iPhone und iPad gibt es Mitteilungen nur für die installierte App: in Safari Teilen → «Zum Home-Bildschirm», dann von dort öffnen.';
		}
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
		if (isNativeApp()) {
			return {
				...data,
				ok: true,
				configured: true,
				message: data.hasApns
					? 'Mitteilungen sind bereit. Kategorie einschalten oder iPhone anmelden.'
					: 'Server erreichbar, aber noch ohne Apple-Push-Schlüssel. Kategorien werden gespeichert.'
			};
		}
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
	if (isNativeApp()) return enableNativePush(request, getPushClientId(), prefs, place);
	const blocked = pushBlockedReason();
	if (blocked && !blocked.includes('blockiert. In den Browser-Einstellungen')) {
		return { ok: false, message: blocked };
	}
	if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
		return { ok: false, message: 'Dieser Browser unterstützt kein Web Push.' };
	}

	// Safari only shows the permission prompt while the tap is still "fresh": ask before any fetch.
	const permission =
		Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
	if (permission === 'denied') {
		return {
			ok: false,
			message: isAppleMobile()
				? 'Mitteilungen sind blockiert. In den iOS-Einstellungen → Mitteilungen → Wetter CH erlauben.'
				: 'Benachrichtigungen sind blockiert. In den Browser-Einstellungen für diese Seite erlauben.'
		};
	}
	if (permission !== 'granted') {
		return { ok: false, message: 'Benachrichtigungen wurden nicht erlaubt.' };
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
		lastSyncAt = Date.now();
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
			? 'Gerät angemeldet. Tipp: «Testmitteilung» senden und prüfen, ob sie ankommt.'
			: 'Abonnement und Ort gespeichert. Versand ist aus (PUSH_SEND_ENABLED=false).'
	};
}

export async function disablePush(): Promise<void> {
	if (isNativeApp()) return disableNativePush(request, getPushClientId());
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

async function currentSubscription(): Promise<PushSubscription | null> {
	if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
	const registration = await navigator.serviceWorker.getRegistration('/');
	return (await registration?.pushManager.getSubscription()) ?? null;
}

export interface DeviceState {
	/** registered: server has this device · off: not subscribed · blocked/unsupported: cannot be. */
	state: 'registered' | 'off' | 'blocked' | 'unsupported' | 'unknown';
	lastSuccessAt?: string | null;
	lastError?: string | null;
	lastErrorAt?: string | null;
	placeName?: string | null;
}

/** What this device really is: permission, browser subscription and the server's record of it. */
export async function fetchDeviceState(): Promise<DeviceState> {
	if (isNativeApp()) return { state: 'unknown' };
	const blocked = pushBlockedReason();
	if (blocked) {
		return { state: typeof Notification !== 'undefined' && Notification.permission === 'denied' ? 'blocked' : 'unsupported' };
	}
	if (Notification.permission !== 'granted') return { state: 'off' };
	try {
		const subscription = await currentSubscription();
		if (!subscription) return { state: 'off' };
		const data = await request<{
			registered: boolean;
			lastSuccessAt?: string | null;
			lastError?: string | null;
			lastErrorAt?: string | null;
			placeName?: string | null;
		}>('/v1/subscriptions/status', {
			method: 'POST',
			body: JSON.stringify({ endpoint: subscription.endpoint, clientId: getPushClientId() })
		});
		return data.registered ? { state: 'registered', ...data } : { state: 'off' };
	} catch {
		return { state: 'unknown' };
	}
}

export async function sendTestPush(): Promise<{ ok: boolean; message: string }> {
	try {
		const subscription = await currentSubscription();
		if (!subscription) return { ok: false, message: 'Dieses Gerät ist nicht angemeldet.' };
		await request('/v1/subscriptions/test', {
			method: 'POST',
			body: JSON.stringify({ endpoint: subscription.endpoint, clientId: getPushClientId() })
		});
		return { ok: true, message: 'Testmitteilung gesendet — sie sollte in wenigen Sekunden erscheinen.' };
	} catch (error) {
		return { ok: false, message: error instanceof Error ? error.message : 'Test fehlgeschlagen.' };
	}
}

let lastSyncAt = 0;
const RESYNC_MS = 15 * 60 * 1000;

function anyPrefOn(prefs: NotifyPrefs): boolean {
	return Object.values(prefs).some(Boolean);
}

/**
 * Keeps the server's record of this browser current: re-sends the subscription (the server may
 * have dropped it after a failed delivery or a database reset) and re-subscribes when Safari lost
 * it although notifications are still allowed. Runs on start and when the app comes back.
 */
export async function resyncWebPush(place?: PushPlace, force = false): Promise<void> {
	if (isNativeApp() || pushBlockedReason()) return;
	if (Notification.permission !== 'granted') return;
	if (!force && Date.now() - lastSyncAt < RESYNC_MS) return;
	const prefs = loadNotifyPrefs();
	try {
		let subscription = await currentSubscription();
		if (!subscription) {
			if (!anyPrefOn(prefs)) return;
			const key = await fetchVapidPublicKey();
			if (!key) return;
			const registration = await ensureServiceWorker();
			subscription = await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(key)
			});
		}
		await registerSubscription(subscription, prefs, place);
		lastSyncAt = Date.now();
	} catch {
		/* next start or return to the app retries; the settings show the state */
	}
}

export async function fetchAlerts(
	lat: number,
	lon: number,
	place?: { name?: string; admin1?: string; country_code?: string }
): Promise<AlertItem[]> {
	try {
		const params = new URLSearchParams({ lat: String(lat), lon: String(lon) });
		if (place?.country_code) params.set('country', place.country_code);
		if (place?.name) params.set('name', place.name);
		if (place?.admin1) params.set('admin1', place.admin1);
		const data = await request<{ alerts: AlertItem[] }>(`/v1/alerts?${params}`);
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

function clearBadge(): void {
	const nav = navigator as Navigator & { clearAppBadge?: () => Promise<void> };
	void nav.clearAppBadge?.().catch(() => {});
}

/**
 * App start hook. iOS app: refreshes the APNs token. PWA: re-registers the subscription, opens the
 * section a tapped notification points to and clears the home-screen badge.
 */
export function initPush(place: () => PushPlace | undefined): () => void {
	if (isNativeApp()) {
		initNativePush(request, getPushClientId(), place);
		return () => {};
	}
	if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => {};
	const onMessage = (event: MessageEvent) => {
		const data = event.data as { type?: string; url?: string } | null;
		if (data?.type !== 'wx-open' || !data.url) return;
		const url = new URL(data.url, location.origin);
		if (url.hash && url.hash !== location.hash) location.hash = url.hash;
	};
	const onVisible = () => {
		if (document.visibilityState !== 'visible') return;
		clearBadge();
		void resyncWebPush(place());
	};
	navigator.serviceWorker.addEventListener('message', onMessage);
	document.addEventListener('visibilitychange', onVisible);
	clearBadge();
	void resyncWebPush(place(), true);
	return () => {
		navigator.serviceWorker.removeEventListener('message', onMessage);
		document.removeEventListener('visibilitychange', onVisible);
	};
}
