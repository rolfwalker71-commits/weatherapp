-- 004: forecast-change preference + plan snapshots for proactive diffs
ALTER TABLE notification_preferences ADD COLUMN forecast_change INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS forecast_snapshots (
	client_id TEXT NOT NULL,
	location_key TEXT NOT NULL,
	snapshot_json TEXT NOT NULL,
	updated_at TEXT NOT NULL DEFAULT (datetime('now')),
	PRIMARY KEY (client_id, location_key)
);

CREATE INDEX IF NOT EXISTS idx_forecast_snapshots_updated ON forecast_snapshots(updated_at);
