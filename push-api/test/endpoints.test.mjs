import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Starts the real server against a temp database. APNs goes through the simctl transport with a fake `xcrun`
 * that records what would have been pushed, so the whole chain (endpoint → payload → "Apple") is exercised offline.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'push-e2e-'));
const pushed = path.join(sandbox, 'pushed');
fs.mkdirSync(pushed);
fs.mkdirSync(path.join(sandbox, 'bin'));
fs.writeFileSync(
	path.join(sandbox, 'bin', 'xcrun'),
	`#!/bin/sh\n# xcrun simctl push <sim> <bundle> <file>\ncp "$5" "${pushed}/$(date +%s%N).json"\n`,
	{ mode: 0o755 }
);

const token = 'a1'.repeat(32);
let server;
let base;

async function freePort() {
	return new Promise((resolve) => {
		const probe = net.createServer().listen(0, '127.0.0.1', () => {
			const { port } = probe.address();
			probe.close(() => resolve(port));
		});
	});
}

before(async () => {
	const port = await freePort();
	base = `http://127.0.0.1:${port}`;
	server = spawn(process.execPath, [path.join(here, '..', 'src', 'index.js')], {
		env: {
			...process.env,
			PATH: `${path.join(sandbox, 'bin')}:${process.env.PATH}`,
			PORT: String(port),
			HOST: '127.0.0.1',
			SQLITE_PATH: path.join(sandbox, 'push.db'),
			APNS_TRANSPORT: 'simctl',
			PUSH_POLL_MS: '3600000',
			LIVE_ACTIVITY_POLL_MS: '3600000'
		},
		stdio: ['ignore', 'pipe', 'inherit']
	});
	await new Promise((resolve, reject) => {
		server.stdout.on('data', (chunk) => String(chunk).includes('weather push api on') && resolve());
		server.on('exit', (code) => reject(new Error(`server exited ${code}`)));
		setTimeout(() => reject(new Error('server did not start')), 15000);
	});
});

after(() => server?.kill());

const call = async (method, route, body) => {
	const response = await fetch(base + route, {
		method,
		headers: { 'content-type': 'application/json' },
		body: body ? JSON.stringify(body) : undefined
	});
	return { status: response.status, body: await response.json() };
};

test('status advertises Live Activities only for the real APNs transport', async () => {
	const { body } = await call('GET', '/v1/status');
	assert.equal(body.hasApns, true);
	assert.equal(body.apnsTransport, 'simctl');
	assert.equal(body.liveActivities, false);
});

test('device status and test push for an iPhone', async () => {
	assert.deepEqual((await call('POST', '/v1/apns-devices/status', { token, clientId: 'c1' })).body, { registered: false });
	assert.equal((await call('POST', '/v1/apns-devices/test', { token, clientId: 'c1' })).status, 404);

	assert.equal((await call('POST', '/v1/apns-devices', { token, clientId: 'c1', bundleId: 'ch.rolfwalker.wetter' })).status, 200);
	assert.equal((await call('POST', '/v1/apns-devices/status', { token, clientId: 'other' })).body.registered, false, 'other client');

	const sent = await call('POST', '/v1/apns-devices/test', { token, clientId: 'c1' });
	assert.deepEqual(sent.body, { ok: true });
	const files = fs.readdirSync(pushed);
	assert.equal(files.length, 1);
	const payload = JSON.parse(fs.readFileSync(path.join(pushed, files[0]), 'utf8'));
	// Without a saved place there is no weather to draw: the sample stays a plain notification.
	assert.equal(payload.aps.alert.title, '✅ Mitteilungen aktiv');
	assert.equal(payload.aps.category, undefined);
	assert.equal(payload.url, '/#einstellungen');

	const again = await call('POST', '/v1/apns-devices/test', { token, clientId: 'c1' });
	assert.equal(again.status, 429);
	assert.ok(again.body.hint);

	const status = (await call('POST', '/v1/apns-devices/status', { token, clientId: 'c1' })).body;
	assert.equal(status.registered, true);
	assert.match(status.lastSuccessAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
	assert.equal(status.lastError, null);
});

test('Live Activity registration endpoints validate and store', async () => {
	const place = { latitude: 47.37, longitude: 8.54, name: 'Zürich', timezone: 'Europe/Zurich' };
	const start = 'b2'.repeat(40);
	assert.equal((await call('POST', '/v1/live-activity-start-tokens', { clientId: 'c1', token: 'nope', kinds: ['rain'] })).status, 400);
	assert.equal((await call('POST', '/v1/live-activity-start-tokens', { clientId: 'c1', token: start, kinds: ['rain', 'warning', 'bogus'], place })).status, 200);
	assert.equal((await call('POST', '/v1/live-activity-start-tokens', { clientId: 'c1', token: '', kinds: [] })).status, 200, 'empty kinds unregister');
	assert.equal((await call('POST', '/v1/live-activities', { clientId: 'c1', kind: 'rain', activityId: 'a1', pushToken: 'xyz' })).status, 400);
	assert.equal((await call('POST', '/v1/live-activities', { clientId: 'c1', kind: 'rain', activityId: 'a1', pushToken: 'c3'.repeat(40), place })).status, 200);
	assert.equal((await call('DELETE', '/v1/live-activities', { clientId: 'c1', activityId: 'a1' })).status, 200);
	assert.equal((await call('DELETE', '/v1/live-activities', { clientId: 'c1' })).status, 400);
});
