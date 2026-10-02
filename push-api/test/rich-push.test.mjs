import assert from 'node:assert/strict';
import { test } from 'node:test';
import { alertOptions, alertPayload, placeSlug } from '../src/apns.js';
import { evaluateNotifications, testNotice } from '../src/weather.js';
import { noticePayload } from '../src/send.js';
import { prefsAll, sampleWeather, severeAlert } from './fixtures.mjs';

/** Keys of `RichNotice` in iosweather/Shared/RichNotice.swift: the app decodes exactly these. */
const WX_KEYS = new Set([
	'v', 'kind', 'place', 'scene', 'isDay', 'code', 'series', 't0', 't1', 'noun', 'startsAt', 'dryAt', 'totalMm', 'prob',
	'level', 'event', 'headline', 'area', 'from', 'until', 'source', 'now', 'feels', 'lowest', 'lowestAt', 'wet', 'peak',
	'peakAt', 'highUntil', 'aqi', 'pollen', 'tMin', 'tMax', 'rainProb', 'condition', 'sunrise', 'sunset', 'rainSeries',
	'change', 'seriesKind'
]);

function notices({ rain = true, frost = false } = {}) {
	const weather = sampleWeather({ rain, frost });
	return evaluateNotifications(weather, prefsAll, [severeAlert]);
}

test('placeSlug is ASCII and stable', () => {
	assert.equal(placeSlug('Zürich'), 'zuerich');
	assert.equal(placeSlug('St. Moritz'), 'st-moritz');
	assert.equal(placeSlug('Genève'), 'geneve');
	assert.equal(placeSlug(''), 'ort');
});

test('every notice carries iOS presentation data the app can decode', () => {
	const all = notices({ frost: true });
	const categories = all.map((notice) => notice.category).sort();
	assert.deepEqual(categories, ['air', 'dailyBrief', 'frost', 'rainSoon', 'uv', 'warnings']);
	for (const notice of all) {
		assert.ok(notice.ios, `${notice.category} has ios data`);
		const payload = alertPayload(noticePayload(notice));
		assert.equal(payload.aps.category, `wx.${notice.category}`);
		assert.equal(payload.aps['mutable-content'], 1);
		assert.match(payload.aps['thread-id'], /^wx\.[A-Za-z]+\.zuerich$/);
		assert.ok(payload.aps['relevance-score'] >= 0 && payload.aps['relevance-score'] <= 1);
		assert.equal(payload.wx.v, 1);
		assert.equal(payload.wx.kind, notice.category);
		assert.equal(payload.wx.place.name, 'Zürich');
		for (const key of Object.keys(payload.wx)) assert.ok(WX_KEYS.has(key), `unknown wx key ${key} in ${notice.category}`);
		// APNs limit is 4 KB.
		assert.ok(Buffer.byteLength(JSON.stringify(payload)) < 3000, `${notice.category} payload size`);
		// Title and body stay what web clients show.
		assert.equal(payload.aps.alert.title, notice.title);
	}
});

test('rainSoon wx matches the text of the notification', () => {
	const rain = notices().find((notice) => notice.category === 'rainSoon');
	const payload = alertPayload(noticePayload(rain));
	assert.equal(payload.aps['interruption-level'], 'active');
	assert.equal(payload.url, '/#radar');
	assert.equal(payload.wx.noun, 'Regen');
	assert.equal(payload.wx.startsAt, '14:45');
	assert.equal(payload.wx.series.length, 8);
	assert.ok(payload.wx.series.every((value) => typeof value === 'number'));
	assert.equal(payload.wx.prob, 80);
	assert.ok(payload.wx.totalMm > 2);
});

test('severe warnings are time-sensitive and use clock times of the place', () => {
	const warning = notices().find((notice) => notice.category === 'warnings');
	const payload = alertPayload(noticePayload(warning));
	assert.equal(payload.aps['interruption-level'], 'time-sensitive');
	assert.equal(payload.aps['relevance-score'], 1);
	assert.equal(payload.wx.level, 3);
	assert.equal(payload.wx.event, 'Gewitterwarnung');
	assert.equal(payload.wx.area, 'Kanton Zürich');
	assert.match(payload.wx.until, /^(\d{2}:\d{2}|[A-Za-zäöü]+\.? \d{2}:\d{2})$/);
});

test('low-priority categories wait; rain/uv/air collapse; web payload stays free of iOS data', () => {
	const all = notices({ frost: true });
	const by = Object.fromEntries(all.map((notice) => [notice.category, notice]));
	assert.equal(alertOptions(noticePayload(by.dailyBrief)).priority, 5);
	assert.equal(alertOptions(noticePayload(by.rainSoon)).priority, 10);
	assert.equal(alertOptions(noticePayload(by.rainSoon)).collapseId, 'wx.rainSoon.zuerich');
	assert.equal(alertOptions(noticePayload(by.warnings)).collapseId, undefined);
	assert.ok(alertOptions(noticePayload(by.frost)).expiration > Date.now() / 1000);
});

test('plain payloads (manual /v1/send) stay plain', () => {
	const payload = alertPayload({ title: 'Wetter', body: 'Neue Wetterinfo', url: '/' });
	assert.equal(payload.aps.category, undefined);
	assert.equal(payload.aps['mutable-content'], undefined);
	assert.equal(payload.wx, undefined);
	assert.equal(payload.aps['thread-id'], 'wetter');
});

test('test notice and brief carry a day card with sun times', () => {
	const weather = sampleWeather();
	const test = alertPayload(noticePayload(testNotice(weather, prefsAll)));
	assert.equal(test.wx.kind, 'test');
	assert.equal(test.wx.sunrise, '07:30');
	assert.equal(test.wx.sunset, '19:08');
	assert.equal(test.wx.tMax, 19);
});
