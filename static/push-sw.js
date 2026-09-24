/*
 * Web Push for the PWA, imported by the generated sw.js (vite.config.ts → importScripts).
 * Payload from push-api (send.js → noticePayload): title, body, url, tag, timestamp, actions,
 * requireInteraction. iOS home-screen apps show title + body only; the body carries emoji and
 * ▁▃▅▇ mini charts so it still reads well there. Every push must show a notification — Safari
 * revokes the subscription of a web app that receives pushes without showing one.
 */

const PUSH_API = '/api/push';

function absolute(url) {
	try {
		return new URL(url || '/', self.location.origin).href;
	} catch {
		return self.location.origin + '/';
	}
}

/** Home-screen badge = notifications still in the notification centre. */
async function refreshBadge() {
	try {
		const open = await self.registration.getNotifications();
		if (open.length && self.navigator.setAppBadge) await self.navigator.setAppBadge(open.length);
		else if (self.navigator.clearAppBadge) await self.navigator.clearAppBadge();
	} catch {
		/* Badging API missing */
	}
}

const VIBRATE = {
	warnings: [300, 120, 300, 120, 300],
	rainSoon: [120, 60, 120],
	forecastChange: [80, 40, 80]
};

self.addEventListener('push', (event) => {
	let payload = { title: 'Wetter', body: 'Neue Wetterinfo', url: '/' };
	try {
		if (event.data) payload = { ...payload, ...event.data.json() };
	} catch {
		if (event.data) payload.body = event.data.text();
	}
	const actions = Array.isArray(payload.actions) ? payload.actions : [];
	const maxActions = (self.Notification && self.Notification.maxActions) || 2;
	const options = {
		body: payload.body || '',
		icon: '/pwa-192x192.png',
		badge: '/pwa-192x192.png',
		lang: 'de-CH',
		tag: payload.tag || undefined,
		// A newer rain notice replaces the older one but still alerts.
		renotify: Boolean(payload.tag),
		timestamp: payload.timestamp || Date.now(),
		requireInteraction: Boolean(payload.requireInteraction),
		vibrate: VIBRATE[payload.category] || [100],
		actions: actions.slice(0, maxActions).map((item) => ({ action: item.action, title: item.title })),
		data: {
			url: payload.url || '/',
			actions: Object.fromEntries(actions.map((item) => [item.action, item.url]))
		}
	};
	event.waitUntil(
		self.registration
			.showNotification(payload.title || 'Wetter', options)
			.catch(() => self.registration.showNotification(payload.title || 'Wetter', { body: options.body, data: options.data }))
			.then(refreshBadge)
	);
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const data = event.notification.data || {};
	// Older payloads stored the URL string directly.
	const url = typeof data === 'string' ? data : (event.action && data.actions?.[event.action]) || data.url || '/';
	const target = absolute(url);
	event.waitUntil(
		self.clients
			.matchAll({ type: 'window', includeUncontrolled: true })
			.then((windows) => {
				for (const client of windows) {
					if (!('focus' in client)) continue;
					// The open app switches section itself (hash route) without a reload.
					client.postMessage({ type: 'wx-open', url: target });
					return client.focus();
				}
				return self.clients.openWindow(target);
			})
			.then(refreshBadge)
	);
});

self.addEventListener('notificationclose', (event) => {
	event.waitUntil(refreshBadge());
});

/** The push service rotated the subscription: re-subscribe and move it over on the server. */
self.addEventListener('pushsubscriptionchange', (event) => {
	event.waitUntil(
		(async () => {
			const previous = event.oldSubscription;
			let next = event.newSubscription;
			if (!next && previous?.options) {
				next = await self.registration.pushManager.subscribe(previous.options);
			}
			if (!next || !previous) return;
			const json = next.toJSON();
			await fetch(`${PUSH_API}/v1/subscriptions/rotate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ oldEndpoint: previous.endpoint, endpoint: json.endpoint, keys: json.keys })
			});
		})().catch(() => {
			/* the app re-registers on its next start */
		})
	);
});
