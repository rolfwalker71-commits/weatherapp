import webpush from 'web-push';
import { deleteSubscription } from './db.js';

export async function sendPush(db, row, payload) {
	try {
		await webpush.sendNotification(
			{ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
			JSON.stringify(payload)
		);
		return { endpoint: row.endpoint, ok: true };
	} catch (error) {
		if (error?.statusCode === 404 || error?.statusCode === 410) {
			deleteSubscription(db, row.endpoint);
		}
		return { endpoint: row.endpoint, ok: false, status: error?.statusCode || 0 };
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
