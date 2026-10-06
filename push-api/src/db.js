import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultDb = path.join(here, '..', 'data', 'push.db');

export function openDb(sqlitePath = process.env.SQLITE_PATH || defaultDb) {
	fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
	const db = new Database(sqlitePath);
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');
	migrate(db);
	return db;
}

function migrate(db) {
	db.exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			id INTEGER PRIMARY KEY,
			name TEXT NOT NULL UNIQUE,
			applied_at TEXT NOT NULL DEFAULT (datetime('now'))
		);
	`);
	const applied = new Set(db.prepare('SELECT name FROM schema_migrations').all().map((row) => row.name));
	const migrationsDir = path.join(here, '..', 'migrations');
	if (!fs.existsSync(migrationsDir)) return;
	const files = fs.readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort();
	for (const file of files) {
		if (applied.has(file)) continue;
		const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
		db.exec(sql);
		db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(file);
	}
}

export function upsertSubscription(db, payload) {
	db.prepare(
		`
		INSERT INTO subscriptions (endpoint, p256dh, auth, client_id, user_agent, updated_at)
		VALUES (@endpoint, @p256dh, @auth, @client_id, @user_agent, datetime('now'))
		ON CONFLICT(endpoint) DO UPDATE SET
			p256dh = excluded.p256dh,
			auth = excluded.auth,
			client_id = excluded.client_id,
			user_agent = excluded.user_agent,
			updated_at = datetime('now')
	`
	).run(payload);
}

export function deleteSubscription(db, endpoint, clientId) {
	if (clientId) {
		return db.prepare('DELETE FROM subscriptions WHERE endpoint = ? AND client_id = ?').run(endpoint, clientId);
	}
	return db.prepare('DELETE FROM subscriptions WHERE endpoint = ?').run(endpoint);
}

export function getSubscription(db, endpoint) {
	return db.prepare('SELECT * FROM subscriptions WHERE endpoint = ?').get(endpoint);
}

export function recordDelivery(db, endpoint, { ok, error }) {
	if (ok) {
		db.prepare(
			`UPDATE subscriptions SET last_success_at = datetime('now'), failures = 0 WHERE endpoint = ?`
		).run(endpoint);
		return;
	}
	db.prepare(
		`UPDATE subscriptions
		SET last_error = ?, last_error_at = datetime('now'), failures = failures + 1
		WHERE endpoint = ?`
	).run(String(error || 'Zustellung fehlgeschlagen').slice(0, 240), endpoint);
}

export function upsertPreferences(db, payload) {
	db.prepare(
		`
		INSERT INTO notification_preferences (
			client_id, rain_soon, warnings, frost, uv, air, daily_brief, forecast_change, pollen,
			latitude, longitude, place_name, timezone, updated_at
		) VALUES (
			@client_id, @rain_soon, @warnings, @frost, @uv, @air, @daily_brief, @forecast_change, @pollen,
			@latitude, @longitude, @place_name, @timezone, datetime('now')
		)
		ON CONFLICT(client_id) DO UPDATE SET
			rain_soon = excluded.rain_soon,
			warnings = excluded.warnings,
			frost = excluded.frost,
			uv = excluded.uv,
			air = excluded.air,
			daily_brief = excluded.daily_brief,
			forecast_change = excluded.forecast_change,
			pollen = excluded.pollen,
			latitude = excluded.latitude,
			longitude = excluded.longitude,
			place_name = excluded.place_name,
			timezone = excluded.timezone,
			updated_at = datetime('now')
	`
	).run(payload);
}

export function getPreferences(db, clientId) {
	return db.prepare('SELECT * FROM notification_preferences WHERE client_id = ?').get(clientId);
}

export function listSubscriptions(db) {
	return db.prepare('SELECT * FROM subscriptions').all();
}

export function listRecipients(db) {
	return db.prepare(
		`
		SELECT
			s.endpoint, s.p256dh, s.auth, s.client_id,
			COALESCE(p.rain_soon, 0) AS rain_soon,
			COALESCE(p.warnings, 0) AS warnings,
			COALESCE(p.frost, 0) AS frost,
			COALESCE(p.uv, 0) AS uv,
			COALESCE(p.air, 0) AS air,
			COALESCE(p.daily_brief, 0) AS daily_brief,
			COALESCE(p.forecast_change, 0) AS forecast_change,
			COALESCE(p.pollen, 0) AS pollen,
			p.latitude, p.longitude, p.place_name, p.timezone
		FROM subscriptions s
		LEFT JOIN notification_preferences p ON p.client_id = s.client_id
	`
	).all();
}

export function upsertApnsDevice(db, payload) {
	db.prepare(
		`
		INSERT INTO apns_devices (token, client_id, environment, bundle_id, updated_at)
		VALUES (@token, @client_id, @environment, @bundle_id, datetime('now'))
		ON CONFLICT(token) DO UPDATE SET
			client_id = excluded.client_id,
			bundle_id = excluded.bundle_id,
			updated_at = datetime('now')
	`
	).run(payload);
}

export function deleteApnsDevice(db, token, clientId) {
	if (clientId) {
		return db.prepare('DELETE FROM apns_devices WHERE token = ? AND client_id = ?').run(token, clientId);
	}
	return db.prepare('DELETE FROM apns_devices WHERE token = ?').run(token);
}

export function getApnsDevice(db, token) {
	return db.prepare(`SELECT *, 'apns' AS kind FROM apns_devices WHERE token = ?`).get(token);
}

/** Outcome of the last iPhone delivery, shown as «Gerät prüfen» in the app. */
export function recordApnsDelivery(db, token, { ok, error }) {
	if (ok) {
		db.prepare(
			`UPDATE apns_devices SET last_success_at = datetime('now'), failures = 0 WHERE token = ?`
		).run(token);
		return;
	}
	db.prepare(
		`UPDATE apns_devices
		SET last_error = ?, last_error_at = datetime('now'), failures = failures + 1
		WHERE token = ?`
	).run(String(error || 'Zustellung fehlgeschlagen').slice(0, 240), token);
}

export function setApnsEnvironment(db, token, environment) {
	db.prepare('UPDATE apns_devices SET environment = ? WHERE token = ?').run(environment, token);
}

export function listApnsDevices(db) {
	return db.prepare(`SELECT *, 'apns' AS kind FROM apns_devices`).all();
}

/** Same shape as listRecipients, for iOS devices; `kind` routes delivery in sendPush. */
export function listApnsRecipients(db) {
	return db.prepare(
		`
		SELECT
			'apns' AS kind, d.token, d.environment, d.client_id,
			COALESCE(p.rain_soon, 0) AS rain_soon,
			COALESCE(p.warnings, 0) AS warnings,
			COALESCE(p.frost, 0) AS frost,
			COALESCE(p.uv, 0) AS uv,
			COALESCE(p.air, 0) AS air,
			COALESCE(p.daily_brief, 0) AS daily_brief,
			COALESCE(p.forecast_change, 0) AS forecast_change,
			COALESCE(p.pollen, 0) AS pollen,
			p.latitude, p.longitude, p.place_name, p.timezone
		FROM apns_devices d
		LEFT JOIN notification_preferences p ON p.client_id = d.client_id
	`
	).all();
}

export function getForecastSnapshot(db, clientId, locationKey) {
	const row = db
		.prepare(
			`SELECT snapshot_json FROM forecast_snapshots WHERE client_id = ? AND location_key = ?`
		)
		.get(clientId, locationKey);
	if (!row?.snapshot_json) return null;
	try {
		return JSON.parse(row.snapshot_json);
	} catch {
		return null;
	}
}

export function saveForecastSnapshot(db, clientId, locationKey, snapshot) {
	db.prepare(
		`
		INSERT INTO forecast_snapshots (client_id, location_key, snapshot_json, updated_at)
		VALUES (?, ?, ?, datetime('now'))
		ON CONFLICT(client_id, location_key) DO UPDATE SET
			snapshot_json = excluded.snapshot_json,
			updated_at = datetime('now')
	`
	).run(clientId, locationKey, JSON.stringify(snapshot));
}

export function pruneForecastSnapshots(db) {
	db.prepare(`DELETE FROM forecast_snapshots WHERE updated_at < datetime('now', '-14 days')`).run();
}

export function wasRecentlySent(db, clientId, category, fingerprint, cooldownHours) {
	const row = db
		.prepare(
			`
			SELECT sent_at FROM send_cooldowns
			WHERE client_id = ? AND category = ? AND fingerprint = ?
				AND sent_at > datetime('now', ?)
		`
		)
		.get(clientId, category, fingerprint, `-${Number(cooldownHours)} hours`);
	return Boolean(row);
}

export function recordSend(db, clientId, category, fingerprint) {
	db.prepare(
		`
		INSERT INTO send_cooldowns (client_id, category, fingerprint, sent_at)
		VALUES (?, ?, ?, datetime('now'))
		ON CONFLICT(client_id, category, fingerprint) DO UPDATE SET sent_at = datetime('now')
	`
	).run(clientId, category, fingerprint);
}

export function pruneSendLog(db) {
	db.prepare(`DELETE FROM send_cooldowns WHERE sent_at < datetime('now', '-7 days')`).run();
}

export function getSetting(db, key) {
	const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key);
	return row?.value ?? null;
}

export function setSetting(db, key, value) {
	db.prepare(
		`
		INSERT INTO app_settings (key, value, updated_at)
		VALUES (?, ?, datetime('now'))
		ON CONFLICT(key) DO UPDATE SET
			value = excluded.value,
			updated_at = datetime('now')
	`
	).run(key, value);
}

// --- Live Activities (ActivityKit tokens) ---------------------------------------------------------

/** Replaces the push-to-start token of a client: one row per enabled kind; no kinds removes it. */
export function replaceLiveActivityStartTokens(db, { clientId, token, kinds, bundleId, place }) {
	const write = db.transaction(() => {
		db.prepare(`DELETE FROM live_activity_tokens WHERE client_id = ? AND token_kind = 'start'`).run(clientId);
		const insert = db.prepare(
			`
			INSERT INTO live_activity_tokens
				(client_id, kind, token_kind, token, activity_id, bundle_id, latitude, longitude, place_name, timezone)
			VALUES (?, ?, 'start', ?, '', ?, ?, ?, ?, ?)
		`
		);
		for (const kind of kinds) {
			insert.run(clientId, kind, token, bundleId, place?.latitude ?? null, place?.longitude ?? null, place?.name ?? null, place?.timezone ?? null);
		}
	});
	write();
}

/** Stores the push token of a running activity; only one activity per kind exists, so older rows go. */
export function upsertLiveActivityToken(db, { clientId, kind, activityId, token, bundleId, place }) {
	const write = db.transaction(() => {
		db.prepare(`DELETE FROM live_activity_tokens WHERE client_id = ? AND kind = ? AND token_kind = 'update'`).run(clientId, kind);
		db.prepare(
			`
			INSERT INTO live_activity_tokens
				(client_id, kind, token_kind, token, activity_id, bundle_id, latitude, longitude, place_name, timezone)
			VALUES (?, ?, 'update', ?, ?, ?, ?, ?, ?, ?)
		`
		).run(clientId, kind, token, activityId, bundleId, place?.latitude ?? null, place?.longitude ?? null, place?.name ?? null, place?.timezone ?? null);
	});
	write();
}

export function deleteLiveActivityToken(db, clientId, activityId) {
	const rows = db
		.prepare(`SELECT kind FROM live_activity_tokens WHERE client_id = ? AND token_kind = 'update' AND activity_id = ?`)
		.all(clientId, activityId);
	db.prepare(`DELETE FROM live_activity_tokens WHERE client_id = ? AND token_kind = 'update' AND activity_id = ?`).run(clientId, activityId);
	for (const { kind } of rows) setLiveActivityState(db, clientId, kind, { phase: 'idle', hash: null });
}

/** Drops a token Apple says is dead (410, Unregistered, BadDeviceToken). */
export function deleteLiveActivityTokenValue(db, token) {
	db.prepare('DELETE FROM live_activity_tokens WHERE token = ?').run(token);
}

export function setLiveActivityEnvironment(db, token, environment) {
	db.prepare('UPDATE live_activity_tokens SET environment = ? WHERE token = ?').run(environment, token);
}

/** Every client with at least one ActivityKit token, with the rows it registered. */
export function listLiveActivityClients(db) {
	const groups = new Map();
	for (const row of db.prepare('SELECT * FROM live_activity_tokens').all()) {
		const group = groups.get(row.client_id) || { clientId: row.client_id, rows: [] };
		group.rows.push(row);
		groups.set(row.client_id, group);
	}
	return [...groups.values()];
}

export function getLiveActivityState(db, clientId, kind) {
	return (
		db.prepare('SELECT * FROM live_activity_state WHERE client_id = ? AND kind = ?').get(clientId, kind) || {
			client_id: clientId,
			kind,
			phase: 'idle',
			started_at: null,
			last_push_at: null,
			last_hash: null
		}
	);
}

export function setLiveActivityState(db, clientId, kind, { phase, hash, started }) {
	db.prepare(
		`
		INSERT INTO live_activity_state (client_id, kind, phase, started_at, last_push_at, last_hash)
		VALUES (?, ?, ?, ${started ? "datetime('now')" : 'NULL'}, datetime('now'), ?)
		ON CONFLICT(client_id, kind) DO UPDATE SET
			phase = excluded.phase,
			started_at = ${started ? 'excluded.started_at' : 'live_activity_state.started_at'},
			last_push_at = excluded.last_push_at,
			last_hash = excluded.last_hash
	`
	).run(clientId, kind, phase, hash ?? null);
}

export function pruneLiveActivityTokens(db) {
	db.prepare(`DELETE FROM live_activity_tokens WHERE token_kind = 'update' AND updated_at < datetime('now', '-2 days')`).run();
	db.prepare(`DELETE FROM live_activity_tokens WHERE token_kind = 'start' AND updated_at < datetime('now', '-60 days')`).run();
}
