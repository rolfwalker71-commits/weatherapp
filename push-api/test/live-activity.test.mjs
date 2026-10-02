import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { test } from 'node:test';
import {
	getLiveActivityState,
	listLiveActivityClients,
	openDb,
	replaceLiveActivityStartTokens,
	upsertLiveActivityToken
} from '../src/db.js';
import { localToEpoch, rainActivityState, runLiveActivityCycle, warningActivityState } from '../src/liveactivity.js';
import { sampleWeather, severeAlert } from './fixtures.mjs';

const zurichNow = localToEpoch('2026-10-02T14:15', 'Europe/Zurich');

function memoryDb() {
	return openDb(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'push-test-')), 'push.db'));
}

test('local provider times convert to epoch with DST', () => {
	assert.equal(new Date(localToEpoch('2026-10-02T14:15', 'Europe/Zurich')).toISOString(), '2026-10-02T12:15:00.000Z');
	assert.equal(new Date(localToEpoch('2026-01-02T14:15', 'Europe/Zurich')).toISOString(), '2026-01-02T13:15:00.000Z');
	assert.equal(new Date(localToEpoch('2026-10-02T14:15', 'America/New_York')).toISOString(), '2026-10-02T18:15:00.000Z');
});

test('rain state: starts later, mirrors the app texts, epoch seconds', () => {
	const state = rainActivityState(sampleWeather(), zurichNow);
	assert.equal(state.headline, 'Regen ab 14:45');
	assert.match(state.detail, /^(leicht|mässig|stark)( · etwa \d+ mm)?, trocken ab \d{2}:\d{2}$/);
	assert.equal(state.symbol, 'cloud.heavyrain.fill', '4.8 mm/h peak counts as heavy like in the app');
	assert.equal(state.startsAt, Math.floor(localToEpoch('2026-10-02T14:45', 'Europe/Zurich') / 1000));
	assert.ok(state.endsAt > state.startsAt);
	assert.equal(state.level, 0);
	assert.ok(state.series.length > 0 && state.series.length <= 8);
});

test('rain state: dry and far-away rain give none; rain right now has no start', () => {
	assert.equal(rainActivityState(sampleWeather({ rain: false }), zurichNow), null);
	const raining = rainActivityState(sampleWeather(), localToEpoch('2026-10-02T15:05', 'Europe/Zurich'));
	assert.equal(raining.headline, 'Regen jetzt');
	assert.equal(raining.startsAt, undefined);
	const later = sampleWeather();
	later.minutesAll = later.minutesAll.map((slot, index) => ({ ...slot, precipMm: index === 12 ? 1 : 0 }));
	assert.equal(rainActivityState(later, zurichNow), null, 'rain more than an hour away');
});

test('warning state: only orange/red in force, strongest first', () => {
	const now = Date.parse('2026-10-02T12:15:00Z');
	const state = warningActivityState([{ ...severeAlert, id: 'a', severity: 'moderate' }, severeAlert], now);
	assert.equal(state.headline, 'Gewitterwarnung');
	assert.equal(state.detail, 'Stufe 3 · Hagel und Sturmböen möglich');
	assert.equal(state.symbol, 'cloud.bolt.rain.fill');
	assert.equal(state.level, 3);
	assert.equal(state.endsAt, Math.floor(Date.parse('2026-10-02T21:00:00+02:00') / 1000));
	assert.equal(warningActivityState([{ ...severeAlert, severity: 'moderate' }], now), null);
	assert.equal(warningActivityState([{ ...severeAlert, expires: '2026-10-02T10:00:00+02:00' }], now), null);
	assert.equal(warningActivityState([{ ...severeAlert, onset: '2026-10-02T20:00:00+02:00' }], now), null, 'starts in > 1 h');
});

test('cycle: start → no repeat → update → end, one push each', async () => {
	const db = memoryDb();
	const place = { latitude: 47.3769, longitude: 8.5417, name: 'Zürich', timezone: 'Europe/Zurich' };
	replaceLiveActivityStartTokens(db, { clientId: 'c1', token: 'ab'.repeat(40), kinds: ['rain'], bundleId: 'ch.rolfwalker.wetter', place });
	const sent = [];
	const send = async (_db, row, aps, options) => {
		sent.push({ token: row.token, aps, options });
		return { ok: true, status: 200 };
	};
	let weather = sampleWeather();
	const weatherFor = async () => ({ weather, alerts: [] });
	const run = (nowMs) => runLiveActivityCycle(db, { weatherFor, send, nowMs });

	let result = await run(zurichNow);
	assert.equal(result.actions[0].action, 'start');
	assert.equal(sent[0].aps.event, 'start');
	assert.equal(sent[0].aps['attributes-type'], 'WeatherActivityAttributes');
	assert.deepEqual(sent[0].aps.attributes, { kind: 'rain', place: 'Zürich' });
	assert.equal(sent[0].aps.alert.title, 'Regen im Anmarsch');
	assert.equal(sent[0].options.priority, 10);
	assert.equal(getLiveActivityState(db, 'c1', 'rain').phase, 'active');

	// The app has not reported an activity token yet: nothing is started twice.
	result = await run(zurichNow + 5 * 60_000);
	assert.equal(result.actions.length, 0);
	assert.equal(sent.length, 1);

	// App reports the token of the running activity.
	upsertLiveActivityToken(db, { clientId: 'c1', kind: 'rain', activityId: 'act-1', token: 'cd'.repeat(40), bundleId: 'ch.rolfwalker.wetter', place });
	// Same content within 20 min: no push. After 20 min: a refresh at priority 5.
	result = await run(zurichNow + 5 * 60_000);
	assert.equal(result.actions.length, 0, 'unchanged');
	result = await run(zurichNow + 25 * 60_000);
	assert.equal(result.actions[0].action, 'update');
	assert.equal(sent.at(-1).token, 'cd'.repeat(40));
	assert.equal(sent.at(-1).aps.event, 'update');
	assert.equal(sent.at(-1).options.priority, 5);

	// Headline changes (rain has started): update at priority 10.
	result = await run(zurichNow + 35 * 60_000);
	assert.equal(result.actions[0].action, 'update');
	assert.equal(sent.at(-1).options.priority, 10);

	// It stays dry: end, token row removed, state idle.
	weather = sampleWeather({ rain: false });
	result = await run(zurichNow + 60 * 60_000);
	assert.equal(result.actions[0].action, 'end');
	assert.equal(sent.at(-1).aps.event, 'end');
	assert.ok(sent.at(-1).aps['dismissal-date'] > sent.at(-1).aps.timestamp);
	assert.equal(getLiveActivityState(db, 'c1', 'rain').phase, 'idle');
	assert.equal(listLiveActivityClients(db)[0].rows.every((row) => row.token_kind === 'start'), true);
	const count = sent.length;
	await run(zurichNow + 65 * 60_000);
	assert.equal(sent.length, count, 'idle and dry sends nothing');
});

test('cycle: a dismissed activity is not restarted until the weather calmed down once', async () => {
	const db = memoryDb();
	replaceLiveActivityStartTokens(db, {
		clientId: 'c2',
		token: 'ef'.repeat(40),
		kinds: ['rain'],
		bundleId: null,
		place: { latitude: 47.3, longitude: 8.5, name: 'Zürich', timezone: 'Europe/Zurich' }
	});
	let starts = 0;
	const send = async (_db, _row, aps) => {
		if (aps.event === 'start') starts += 1;
		return { ok: true, status: 200 };
	};
	const weatherFor = async () => ({ weather: sampleWeather(), alerts: [] });
	await runLiveActivityCycle(db, { weatherFor, send, nowMs: zurichNow });
	await runLiveActivityCycle(db, { weatherFor, send, nowMs: zurichNow + 10 * 60_000 });
	await runLiveActivityCycle(db, { weatherFor, send, nowMs: zurichNow + 20 * 60_000 });
	assert.equal(starts, 1);
});

test('start tokens: empty kinds remove the registration; one row per enabled kind', () => {
	const db = memoryDb();
	replaceLiveActivityStartTokens(db, { clientId: 'c3', token: 'aa'.repeat(40), kinds: ['rain', 'warning'], bundleId: null, place: null });
	assert.equal(listLiveActivityClients(db)[0].rows.length, 2);
	replaceLiveActivityStartTokens(db, { clientId: 'c3', token: '', kinds: [], bundleId: null, place: null });
	assert.equal(listLiveActivityClients(db).length, 0);
});
