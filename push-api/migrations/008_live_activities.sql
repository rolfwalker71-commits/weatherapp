-- 008: ActivityKit tokens of the native app (Live Activities «Regen im Anmarsch» / «Unwetter aktiv»)
CREATE TABLE IF NOT EXISTS live_activity_tokens (
	client_id TEXT NOT NULL,
	-- 'rain' | 'warning'
	kind TEXT NOT NULL,
	-- 'start' = push-to-start token of the device, 'update' = push token of one running activity
	token_kind TEXT NOT NULL,
	token TEXT NOT NULL,
	-- ActivityKit id of the activity; '' for start tokens
	activity_id TEXT NOT NULL DEFAULT '',
	environment TEXT NOT NULL DEFAULT 'auto',
	bundle_id TEXT,
	-- the user's own place (activities never follow browsed places)
	latitude REAL,
	longitude REAL,
	place_name TEXT,
	timezone TEXT,
	updated_at TEXT NOT NULL DEFAULT (datetime('now')),
	PRIMARY KEY (client_id, kind, token_kind, activity_id)
);

CREATE INDEX IF NOT EXISTS idx_live_activity_tokens_token ON live_activity_tokens(token);

-- What the server last did for a client and kind, so it neither starts twice nor repeats identical updates
CREATE TABLE IF NOT EXISTS live_activity_state (
	client_id TEXT NOT NULL,
	kind TEXT NOT NULL,
	-- 'active' after a start/update push, 'idle' after an end push
	phase TEXT NOT NULL DEFAULT 'idle',
	started_at TEXT,
	last_push_at TEXT,
	last_hash TEXT,
	PRIMARY KEY (client_id, kind)
);
