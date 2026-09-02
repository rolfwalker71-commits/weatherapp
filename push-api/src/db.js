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

export function upsertPreferences(db, payload) {
	db.prepare(
		`
		INSERT INTO notification_preferences (
			client_id, rain_soon, warnings, frost, uv, air, daily_brief,
			latitude, longitude, place_name, timezone, updated_at
		) VALUES (
			@client_id, @rain_soon, @warnings, @frost, @uv, @air, @daily_brief,
			@latitude, @longitude, @place_name, @timezone, datetime('now')
		)
		ON CONFLICT(client_id) DO UPDATE SET
			rain_soon = excluded.rain_soon,
			warnings = excluded.warnings,
			frost = excluded.frost,
			uv = excluded.uv,
			air = excluded.air,
			daily_brief = excluded.daily_brief,
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
			p.latitude, p.longitude, p.place_name, p.timezone
		FROM subscriptions s
		LEFT JOIN notification_preferences p ON p.client_id = s.client_id
	`
	).all();
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
