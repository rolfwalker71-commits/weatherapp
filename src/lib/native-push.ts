import { PushNotifications, type Token } from '@capacitor/push-notifications';
import { loadNotifyPrefs } from './notify-prefs';
import type { NotifyPrefs } from './types';

/**
 * iOS app notifications via Apple Push (APNs). The web build keeps using Web Push in
 * push-client.ts; that module delegates here when running inside the Capacitor shell.
 */

const TOKEN_KEY = 'weather.apnsToken';

type Request = <T>(path: string, init?: RequestInit) => Promise<T>;
type Place = { latitude: number; longitude: number; name: string; timezone?: string };

function storedToken(): string | null {
	try {
		return localStorage.getItem(TOKEN_KEY);
	} catch {
		return null;
	}
}

function storeToken(token: string | null): void {
	try {
		if (token) localStorage.setItem(TOKEN_KEY, token);
		else localStorage.removeItem(TOKEN_KEY);
	} catch {
		/* private mode */
	}
}

/** Resolves with the APNs device token (hex) once iOS has registered the app. */
function registerForToken(timeoutMs = 15_000): Promise<string> {
	return new Promise((resolve, reject) => {
		const handles: Promise<{ remove: () => Promise<void> }>[] = [];
		const cleanup = () => {
			clearTimeout(timer);
			for (const handle of handles) void handle.then((h) => h.remove());
		};
		const timer = setTimeout(() => {
			cleanup();
			reject(new Error('iOS hat kein Geräte-Token geliefert. App neu starten und nochmals versuchen.'));
		}, timeoutMs);
		handles.push(
			PushNotifications.addListener('registration', (token: Token) => {
				cleanup();
				resolve(token.value);
			}),
			PushNotifications.addListener('registrationError', (error) => {
				cleanup();
				reject(new Error(`Apple-Push-Anmeldung fehlgeschlagen: ${error.error}`));
			})
		);
		void PushNotifications.register();
	});
}

export async function nativePermissionDenied(): Promise<boolean> {
	const { receive } = await PushNotifications.checkPermissions();
	return receive === 'denied';
}

export async function enableNativePush(
	request: Request,
	clientId: string,
	prefs: NotifyPrefs,
	place?: Place
): Promise<{ ok: boolean; message: string }> {
	let { receive } = await PushNotifications.checkPermissions();
	if (receive === 'prompt' || receive === 'prompt-with-rationale') {
		({ receive } = await PushNotifications.requestPermissions());
	}
	if (receive !== 'granted') {
		return {
			ok: false,
			message: 'Mitteilungen sind aus. In Einstellungen → Mitteilungen → Wetter CH erlauben.'
		};
	}

	let token: string;
	try {
		token = await registerForToken();
	} catch (error) {
		return { ok: false, message: error instanceof Error ? error.message : 'Anmeldung fehlgeschlagen.' };
	}

	try {
		const result = await request<{ ok: boolean; hasApns: boolean }>('/v1/apns-devices', {
			method: 'POST',
			body: JSON.stringify({ token, clientId, bundleId: 'ch.rolfwalker.wetter', preferences: prefs, place })
		});
		storeToken(token);
		return {
			ok: true,
			message: result.hasApns
				? 'Gerät angemeldet. Der Server sendet nach den gewählten Kategorien.'
				: 'Gerät angemeldet. Dem Server fehlt noch der Apple-Push-Schlüssel — Meldungen kommen, sobald er eingetragen ist.'
		};
	} catch (error) {
		return { ok: false, message: error instanceof Error ? error.message : 'Server nicht erreichbar.' };
	}
}

export async function disableNativePush(request: Request, clientId: string): Promise<void> {
	const token = storedToken();
	if (token) {
		try {
			await request('/v1/apns-devices', {
				method: 'DELETE',
				body: JSON.stringify({ token, clientId })
			});
		} catch {
			/* local unregister still happens */
		}
	}
	storeToken(null);
	await PushNotifications.unregister();
}

/**
 * App start: re-send the token with prefs and place (iOS may rotate it, and the server drops
 * tokens after failed deliveries) and open the section a tapped notification points to
 * (payload `url`, e.g. "/#jetzt").
 */
export function initNativePush(request: Request, clientId: string, place: () => Place | undefined): void {
	void PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
		const url = String(action.notification.data?.url ?? '');
		const hash = url.includes('#') ? url.slice(url.indexOf('#')) : '';
		if (hash) location.hash = hash;
	});

	if (!storedToken()) return;
	void PushNotifications.checkPermissions().then(async ({ receive }) => {
		if (receive !== 'granted') return;
		try {
			const token = await registerForToken();
			await request('/v1/apns-devices', {
				method: 'POST',
				body: JSON.stringify({
					token,
					clientId,
					bundleId: 'ch.rolfwalker.wetter',
					preferences: loadNotifyPrefs(),
					place: place()
				})
			});
			storeToken(token);
		} catch {
			/* next start retries */
		}
	});
}
