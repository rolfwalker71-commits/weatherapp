-- 002_delivery: cooldown log for real Web Push sends
CREATE TABLE IF NOT EXISTS send_cooldowns (
	client_id TEXT NOT NULL,
	category TEXT NOT NULL,
	fingerprint TEXT NOT NULL,
	sent_at TEXT NOT NULL DEFAULT (datetime('now')),
	PRIMARY KEY (client_id, category, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_send_cooldowns_sent ON send_cooldowns(sent_at);
