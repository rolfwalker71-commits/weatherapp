import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http2 from 'node:http2';
import os from 'node:os';
import path from 'node:path';

/**
 * Apple Push Notification service for the native iOS app.
 *
 * Production: token auth with a .p8 key (APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY or APNS_KEY_FILE).
 * Local development: APNS_TRANSPORT=simctl delivers through `xcrun simctl push` into a booted
 * iOS Simulator on this Mac, so the whole chain can be tested without an Apple Developer account.
 */

const HOSTS = {
	production: 'https://api.push.apple.com',
	sandbox: 'https://api.sandbox.push.apple.com'
};

const TOKEN_TTL_MS = 40 * 60 * 1000; // Apple rejects provider tokens older than 60 min.

export function apnsConfig(env = process.env) {
	const bundleId = env.APNS_BUNDLE_ID || 'ch.rolfwalker.wetter';
	if (env.APNS_TRANSPORT === 'simctl') {
		return { transport: 'simctl', bundleId, simulator: env.APNS_SIMULATOR || 'booted' };
	}
	let pem = env.APNS_KEY || '';
	if (!pem && env.APNS_KEY_FILE && fs.existsSync(env.APNS_KEY_FILE)) {
		pem = fs.readFileSync(env.APNS_KEY_FILE, 'utf8');
	}
	if (!pem || !env.APNS_KEY_ID || !env.APNS_TEAM_ID) return null;
	return {
		transport: 'apns',
		bundleId,
		keyId: env.APNS_KEY_ID,
		teamId: env.APNS_TEAM_ID,
		// .env files often carry the key on one line with literal \n.
		key: crypto.createPrivateKey(pem.replace(/\\n/g, '\n'))
	};
}

let cachedToken = null;

function providerToken(config) {
	if (cachedToken && Date.now() - cachedToken.at < TOKEN_TTL_MS) return cachedToken.value;
	const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
	const unsigned = `${encode({ alg: 'ES256', kid: config.keyId })}.${encode({
		iss: config.teamId,
		iat: Math.floor(Date.now() / 1000)
	})}`;
	const signature = crypto
		.sign('sha256', Buffer.from(unsigned), { key: config.key, dsaEncoding: 'ieee-p1363' })
		.toString('base64url');
	cachedToken = { at: Date.now(), value: `${unsigned}.${signature}` };
	return cachedToken.value;
}

const sessions = new Map();

function session(environment) {
	const existing = sessions.get(environment);
	if (existing && !existing.closed && !existing.destroyed) return existing;
	const client = http2.connect(HOSTS[environment]);
	client.on('error', () => sessions.delete(environment));
	client.on('close', () => sessions.delete(environment));
	// Do not keep the process alive just for an idle APNs connection.
	client.unref();
	sessions.set(environment, client);
	return client;
}

function post(config, environment, token, { pushType, topic, priority, expiration, body }) {
	return new Promise((resolve) => {
		const headers = {
			':method': 'POST',
			':path': `/3/device/${token}`,
			authorization: `bearer ${providerToken(config)}`,
			'apns-topic': topic,
			'apns-push-type': pushType,
			'apns-priority': String(priority),
			'content-type': 'application/json'
		};
		if (expiration != null) headers['apns-expiration'] = String(expiration);
		let request;
		try {
			request = session(environment).request(headers);
		} catch (error) {
			resolve({ ok: false, status: 0, reason: error.message });
			return;
		}
		let status = 0;
		let data = '';
		request.setEncoding('utf8');
		request.setTimeout(10_000, () => request.close(http2.constants.NGHTTP2_CANCEL));
		request.on('response', (response) => {
			status = Number(response[':status']);
		});
		request.on('data', (chunk) => {
			data += chunk;
		});
		request.on('end', () => {
			let reason = '';
			try {
				reason = data ? JSON.parse(data).reason || '' : '';
			} catch {
				/* empty body on success */
			}
			resolve({ ok: status === 200, status, reason });
		});
		request.on('error', (error) => resolve({ ok: false, status: 0, reason: error.message }));
		request.end(JSON.stringify(body));
	});
}

function simctlPush(config, body) {
	return new Promise((resolve) => {
		const file = path.join(os.tmpdir(), `apns-${crypto.randomUUID()}.json`);
		fs.writeFileSync(file, JSON.stringify({ ...body, 'Simulator Target Bundle': config.bundleId }));
		execFile('xcrun', ['simctl', 'push', config.simulator, config.bundleId, file], (error, _out, stderr) => {
			fs.rmSync(file, { force: true });
			resolve(
				error
					? { ok: false, status: 0, reason: String(stderr || error.message).trim() }
					: { ok: true, status: 200, reason: '', environment: 'simulator' }
			);
		});
	});
}

/**
 * Sends one push. `device.environment` is 'auto' until a delivery succeeds; a token from a
 * development build is only valid on the sandbox host, so 'auto' tries production, then sandbox.
 */
export async function sendApns(config, device, { pushType = 'alert', topicSuffix = '', priority = 10, expiration, body }) {
	if (config.transport === 'simctl') {
		if (pushType !== 'alert') {
			return { ok: false, status: 0, reason: 'simctl liefert nur normale Mitteilungen' };
		}
		return simctlPush(config, body);
	}
	const topic = `${config.bundleId}${topicSuffix}`;
	const request = { pushType, topic, priority, expiration, body };
	const order =
		device.environment === 'sandbox' || device.environment === 'production'
			? [device.environment]
			: ['production', 'sandbox'];
	let result = { ok: false, status: 0, reason: 'nicht gesendet' };
	for (const environment of order) {
		result = await post(config, environment, device.token, request);
		if (result.ok) return { ...result, environment };
		// Wrong environment shows up as BadDeviceToken; anything else will not improve on the other host.
		if (result.reason !== 'BadDeviceToken') break;
	}
	return result;
}

/** Apple's response means the token will never work again (app deleted, token rotated). */
export function isDeadToken(result) {
	return result.status === 410 || result.reason === 'Unregistered' || result.reason === 'BadDeviceToken';
}

export function alertPayload({ title, body, url, tag }) {
	return {
		aps: {
			alert: { title, body },
			sound: 'default',
			'thread-id': tag || 'wetter'
		},
		url: url || '/#jetzt'
	};
}
