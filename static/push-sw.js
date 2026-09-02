self.addEventListener('push', (event) => {
	let payload = { title: 'Wetter', body: 'Neue Wetterinfo', url: '/' };
	try {
		if (event.data) payload = { ...payload, ...event.data.json() };
	} catch {
		if (event.data) payload.body = event.data.text();
	}
	event.waitUntil(
		self.registration.showNotification(payload.title || 'Wetter', {
			body: payload.body || '',
			icon: '/pwa-192x192.png',
			badge: '/pwa-192x192.png',
			data: payload.url || '/'
		})
	);
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const target = event.notification.data || '/';
	event.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
			for (const client of windows) {
				if ('focus' in client) {
					client.navigate?.(target);
					return client.focus();
				}
			}
			return self.clients.openWindow(target);
		})
	);
});
