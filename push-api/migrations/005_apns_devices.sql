-- 005: native iOS app devices (Apple Push Notification service)
CREATE TABLE IF NOT EXISTS apns_devices (
	token TEXT PRIMARY KEY,
	client_id TEXT NOT NULL,
	-- 'auto' until the first delivery tells us whether the token is sandbox or production
	environment TEXT NOT NULL DEFAULT 'auto',
	bundle_id TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_apns_devices_client ON apns_devices(client_id);
