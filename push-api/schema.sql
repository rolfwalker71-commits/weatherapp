-- Push subscriptions + notification preferences (SQLite)
-- Applied automatically on API start. See migrations/ for versioned copies.

CREATE TABLE IF NOT EXISTS schema_migrations (
	id INTEGER PRIMARY KEY,
	name TEXT NOT NULL UNIQUE,
	applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subscriptions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	endpoint TEXT NOT NULL UNIQUE,
	p256dh TEXT NOT NULL,
	auth TEXT NOT NULL,
	client_id TEXT NOT NULL,
	user_agent TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_client ON subscriptions(client_id);

CREATE TABLE IF NOT EXISTS notification_preferences (
	client_id TEXT PRIMARY KEY,
	rain_soon INTEGER NOT NULL DEFAULT 0,
	warnings INTEGER NOT NULL DEFAULT 0,
	frost INTEGER NOT NULL DEFAULT 0,
	uv INTEGER NOT NULL DEFAULT 0,
	air INTEGER NOT NULL DEFAULT 0,
	daily_brief INTEGER NOT NULL DEFAULT 0,
	sending_enabled INTEGER NOT NULL DEFAULT 0,
	latitude REAL,
	longitude REAL,
	place_name TEXT,
	timezone TEXT,
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS send_cooldowns (
	client_id TEXT NOT NULL,
	category TEXT NOT NULL,
	fingerprint TEXT NOT NULL,
	sent_at TEXT NOT NULL DEFAULT (datetime('now')),
	PRIMARY KEY (client_id, category, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_send_cooldowns_sent ON send_cooldowns(sent_at);

CREATE TABLE IF NOT EXISTS app_settings (
	key TEXT PRIMARY KEY,
	value TEXT NOT NULL,
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
