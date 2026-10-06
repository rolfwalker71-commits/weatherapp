import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { alertOptions, alertPayload } from '../src/apns.js';
import { getPreferences, listApnsRecipients, openDb, upsertApnsDevice, upsertPreferences } from '../src/db.js';
import { noticePayload } from '../src/send.js';
import { SPECIES, classify, fetchSwissPollen, nearestStation, parseCsv, pollenNotice, readings } from '../src/pollen.js';

const grass = SPECIES.find((item) => item.id === 'grass');
const birch = SPECIES.find((item) => item.id === 'birch');

/** Hourly file in the MeteoSwiss format: ';' separated, UTC timestamps, one column per species. */
function hourlyCsv(rows) {
	const header = 'station_abbr;reference_timestamp;kabetuh0;khpoach0;kaalnuh0;kacoryh0;kafaguh0;kafraxh0;kaquerh0';
	return [header, ...rows.map(([time, birchValue, grassValue]) => `PZH;${time};${birchValue};${grassValue};0;0;0;0;0`)].join('\n');
}

const SPRING = hourlyCsv([
	['02.05.2026 08:00', 5, 10],
	['02.05.2026 09:00', 14, 40],
	['02.05.2026 10:00', 16, 60],
	['02.05.2026 11:00', 18, 70]
]);

const row = { place_name: 'Zürich', latitude: 47.37, longitude: 8.54, timezone: 'Europe/Zurich' };
const NOON = new Date('2026-05-02T10:00:00Z'); // 12:00 in Zürich

test('classes follow the MeteoSwiss table', () => {
	assert.equal(classify(grass, 0), 0);
	assert.equal(classify(grass, 1), 1);
	assert.equal(classify(grass, 19), 1);
	assert.equal(classify(grass, 20), 2);
	assert.equal(classify(grass, 50), 3);
	assert.equal(classify(grass, 150), 4);
	assert.equal(classify(birch, 10), 1);
	assert.equal(classify(birch, 11), 2);
	assert.equal(classify(birch, 70), 3);
	assert.equal(classify(birch, 300), 4);
	assert.equal(classify(birch, null), 0);
});

test('the nearest station is used within 100 km only', () => {
	assert.equal(nearestStation(47.37, 8.54).station.abbr, 'pzh');
	assert.equal(nearestStation(46.95, 7.45).station.abbr, 'pbe');
	assert.equal(nearestStation(53.55, 10.0), null);
	assert.equal(nearestStation(NaN, 8), null);
});

test('current load is the mean of the last three hours', () => {
	const { readings: list, updated } = readings(parseCsv(SPRING));
	const gräser = list.find((item) => item.id === 'grass');
	assert.equal(Math.round(gräser.value), 57); // (40 + 60 + 70) / 3
	assert.equal(gräser.level, 3);
	assert.equal(list.find((item) => item.id === 'birch').level, 2);
	assert.equal(list.find((item) => item.id === 'oak').level, 0);
	assert.equal(updated, '02.05.2026 11:00');
});

test('pollen notice carries text and wx data the app can decode', () => {
	const report = { station: 'Zürich', ...readings(parseCsv(SPRING)) };
	const notice = pollenNotice(report, row, NOON);
	assert.equal(notice.category, 'pollen');
	assert.match(notice.title, /^🌿 Pollenflug: Gräser stark · Zürich$/);
	assert.match(notice.body, /Gräser 57 \/m³ \(stark\) · Birke 16 \/m³ \(mässig\)/);
	const payload = alertPayload(noticePayload(notice));
	assert.equal(payload.aps.category, 'wx.pollen');
	assert.equal(payload.aps['interruption-level'], 'passive');
	assert.equal(payload.url, '/#luft');
	assert.equal(payload.wx.kind, 'pollen');
	assert.equal(payload.wx.station, 'Zürich');
	assert.deepEqual(payload.wx.species[0], { name: 'Gräser', value: 57, level: 3 });
	assert.equal(alertOptions(noticePayload(notice)).priority, 5);
	assert.ok(Buffer.byteLength(JSON.stringify(payload)) < 3000);
});

test('no notice at night, below "mässig", or without a report', () => {
	const report = { station: 'Zürich', ...readings(parseCsv(SPRING)) };
	assert.equal(pollenNotice(report, row, new Date('2026-05-02T01:00:00Z')), null); // 03:00 local
	assert.equal(pollenNotice(null, row, NOON), null);
	const weak = { station: 'Zürich', ...readings(parseCsv(hourlyCsv([['02.05.2026 10:00', 3, 8]]))) };
	assert.equal(pollenNotice(weak, row, NOON), null);
});

test('a stronger class of the leading species is a new notice, the same one is not', () => {
	const moderate = { station: 'Zürich', ...readings(parseCsv(hourlyCsv([['02.05.2026 10:00', 2, 30]]))) };
	const strong = { station: 'Zürich', ...readings(parseCsv(SPRING)) };
	const a = pollenNotice(moderate, row, NOON);
	const b = pollenNotice(strong, row, NOON);
	assert.notEqual(a.fingerprint, b.fingerprint);
	assert.equal(a.fingerprint, pollenNotice(moderate, row, NOON).fingerprint);
});

test('the station file is fetched once per half hour', async () => {
	let calls = 0;
	const fetchImpl = async (url) => {
		calls += 1;
		assert.match(url, /\/pbe\/ogd-pollen_pbe_h_now\.csv$/);
		return { ok: true, text: async () => SPRING };
	};
	const first = await fetchSwissPollen(46.95, 7.45, { fetchImpl });
	const second = await fetchSwissPollen(46.95, 7.45, { fetchImpl });
	assert.equal(calls, 1);
	assert.equal(first.station, 'Bern');
	assert.ok(second.km < 5);
	assert.equal(await fetchSwissPollen(53.55, 10.0, { fetchImpl }), null);
});

test('the pollen switch is stored and reaches the recipients', () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'push-pollen-'));
	const db = openDb(path.join(dir, 'push.db'));
	upsertApnsDevice(db, { token: 'ab'.repeat(32), client_id: 'c1', environment: 'production', bundle_id: 'ch.rolfwalker.wetter' });
	const base = { client_id: 'c1', rain_soon: 0, warnings: 0, frost: 0, uv: 0, air: 0, daily_brief: 0, forecast_change: 0, latitude: 47.37, longitude: 8.54, place_name: 'Zürich', timezone: 'Europe/Zurich' };
	upsertPreferences(db, { ...base, pollen: 1 });
	assert.equal(getPreferences(db, 'c1').pollen, 1);
	assert.equal(listApnsRecipients(db)[0].pollen, 1);
	upsertPreferences(db, { ...base, pollen: 0 });
	assert.equal(listApnsRecipients(db)[0].pollen, 0);
	db.close();
});
