import webpush from 'web-push';
import { alertPayload, apnsConfig, isDeadToken, sendApns } from './apns.js';
import { deleteApnsDevice, deleteSubscription, setApnsEnvironment } from './db.js';

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

/** Delivers one notification to one channel: a web subscription or (kind 'apns') an iPhone. */
export async function sendPush(db, row, payload) {
	if (row.kind === 'apns') return sendApnsAlert(db, row, payload);
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
