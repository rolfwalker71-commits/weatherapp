-- 006: remember how the last delivery went, so the app can show whether this device really receives
ALTER TABLE subscriptions ADD COLUMN last_success_at TEXT;
ALTER TABLE subscriptions ADD COLUMN last_error TEXT;
ALTER TABLE subscriptions ADD COLUMN last_error_at TEXT;
ALTER TABLE subscriptions ADD COLUMN failures INTEGER NOT NULL DEFAULT 0;
