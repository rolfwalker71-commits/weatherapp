import webpush from 'web-push';
import { getSetting, setSetting } from './db.js';

export const VAPID_PUBLIC_KEY_SETTING = 'vapid_public_key';
export const VAPID_PRIVATE_KEY_SETTING = 'vapid_private_key';
export const VAPID_SUBJECT_SETTING = 'vapid_subject';

function envOrEmpty(name) {
	return process.env[name]?.trim() || '';
}

function resolveSubject(stored) {
	return envOrEmpty('VAPID_SUBJECT') || stored?.trim() || 'mailto:weather@localhost';
}

function envOverride() {
	const publicKey = envOrEmpty('VAPID_PUBLIC_KEY');
	const privateKey = envOrEmpty('VAPID_PRIVATE_KEY');
	if (!publicKey || !privateKey) return null;
	return { publicKey, privateKey, subject: resolveSubject(null) };
}

function readStored(db) {
	const publicKey = getSetting(db, VAPID_PUBLIC_KEY_SETTING)?.trim() || '';
	const privateKey = getSetting(db, VAPID_PRIVATE_KEY_SETTING)?.trim() || '';
	if (!publicKey || !privateKey) return null;
	return {
		publicKey,
		privateKey,
		subject: resolveSubject(getSetting(db, VAPID_SUBJECT_SETTING))
	};
}

/** Generate once and persist. BEGIN IMMEDIATE avoids a split pair on race. */
function generateAndPersist(db) {
	const persist = db.transaction(() => {
		const existing = readStored(db);
		if (existing) return existing;

		const keys = webpush.generateVAPIDKeys();
		const subject = resolveSubject(null);
		setSetting(db, VAPID_PUBLIC_KEY_SETTING, keys.publicKey);
		setSetting(db, VAPID_PRIVATE_KEY_SETTING, keys.privateKey);
		setSetting(db, VAPID_SUBJECT_SETTING, subject);
		return {
			publicKey: keys.publicKey,
			privateKey: keys.privateKey,
			subject
		};
	});
	return persist.immediate();
}

/**
 * Env `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` override when both are set.
 * Otherwise keys live in `app_settings` and are created on first start.
 */
export function getVapidConfig(db) {
	const fromEnv = envOverride();
	if (fromEnv) return fromEnv;
	try {
		return readStored(db) ?? generateAndPersist(db);
	} catch (error) {
		console.warn('VAPID-Keys nicht verfügbar', error.message);
		return null;
	}
}

let appliedSignature = null;

export function ensureWebPushConfigured(db) {
	const cfg = getVapidConfig(db);
	if (!cfg) return null;
	const signature = `${cfg.subject}\0${cfg.publicKey}\0${cfg.privateKey}`;
	if (appliedSignature !== signature) {
		webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);
		appliedSignature = signature;
	}
	return cfg;
}
