-- 007: remember how the last iPhone delivery went (like 006 does for browsers), for «Gerät prüfen» in the app
ALTER TABLE apns_devices ADD COLUMN last_success_at TEXT;
ALTER TABLE apns_devices ADD COLUMN last_error TEXT;
ALTER TABLE apns_devices ADD COLUMN last_error_at TEXT;
ALTER TABLE apns_devices ADD COLUMN failures INTEGER NOT NULL DEFAULT 0;
