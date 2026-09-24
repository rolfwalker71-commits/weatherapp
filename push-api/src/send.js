import webpush from 'web-push';
import { alertPayload, apnsConfig, isDeadToken, sendApns } from './apns.js';
import { deleteApnsDevice, deleteSubscription, recordDelivery, setApnsEnvironment } from './db.js';

let apns;

/** APNs settings from the environment; null when the server has no Apple key (web push only). */
export function getApns() {
	if (apns === undefined) {
		try {
			apns = apnsConfig();
		} catch (error) {
			console.warn('APNs-Schlüssel ungültig:', error.message);
			apns = null;
		}
	}
	return apns;
}

async function sendApnsAlert(db, row, payload) {
	const config = getApns();
	if (!config) return { token: row.token, ok: false, status: 0, reason: 'APNs nicht konfiguriert' };
	const result = await sendApns(config, row, { body: alertPayload(payload) });
	if (result.ok && result.environment && result.environment !== row.environment && result.environment !== 'simulator') {
		setApnsEnvironment(db, row.token, result.environment);
	}
	if (!result.ok && isDeadToken(result)) {
		deleteApnsDevice(db, row.token);
	}
	return { token: row.token, ok: result.ok, status: result.status, reason: result.reason };
}

/**
 * Wire format shared by the service worker (push-sw.js) and APNs: text plus presentation hints.
 * iOS web apps show title and body only; desktop and Android also use actions and interaction.
 */
export function noticePayload(notice) {
	return {
		title: notice.title,
		body: notice.body,
		url: notice.url || '/#jetzt',
		tag: notice.category,
		category: notice.category,
		timestamp: Date.now(),
		actions: notice.actions || [],
		requireInteraction: Boolean(notice.requireInteraction),
		urgency: notice.urgency || 'normal',
		ttl: notice.ttl
	};
}

/** Push-service answer as text, e.g. Apple's `{"reason":"BadJwtToken"}` → "403 BadJwtToken". */
function describePushError(error) {
	const status = error?.statusCode || 0;
	let reason = '';
	try {
		reason = JSON.parse(error?.body || '{}').reason || '';
	} catch {
		reason = String(error?.body || '').trim().slice(0, 120);
	}
	if (!reason) reason = error?.message || 'unbekannt';
	return status ? `${status} ${reason}` : reason;
}

/** Delivers one notification to one channel: a web subscription or (kind 'apns') an iPhone. */
export async function sendPush(db, row, payload) {
	if (row.kind === 'apns') return sendApnsAlert(db, row, payload);
	try {
		await webpush.sendNotification(
			{ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
			JSON.stringify(payload),
			{
				// A rain notice is worthless an hour later; the morning brief can wait for the phone.
				TTL: payload.ttl ?? 60 * 60,
				urgency: payload.urgency || 'normal',
				// Same category replaces a still-undelivered older notice on the push service.
				...(payload.tag ? { topic: String(payload.tag).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) } : {})
			}
		);
		recordDelivery(db, row.endpoint, { ok: true });
		return { endpoint: row.endpoint, ok: true };
	} catch (error) {
		const status = error?.statusCode || 0;
		const reason = describePushError(error);
		if (status === 404 || status === 410) {
			deleteSubscription(db, row.endpoint);
		} else {
			recordDelivery(db, row.endpoint, { ok: false, error: reason });
		}
		console.warn('web push failed', new URL(row.endpoint).host, reason);
		return { endpoint: row.endpoint, ok: false, status, reason };
	}
}

export function isLocalRequest(req) {
	const forwarded = String(req.get('x-real-ip') || req.get('x-forwarded-for') || '')
		.split(',')[0]
		.trim();
	const ip = forwarded || String(req.socket?.remoteAddress || req.ip || '');
	return ip === '127.0.0.1' || ip === '::1' || ip === ':ffff:127.0.0.1' || ip.endsWith('127.0.0.1');
}

export function canTriggerManualSend(req, testToken) {
	if (testToken && req.get('x-push-test-token') === testToken) return true;
	return isLocalRequest(req);
}
