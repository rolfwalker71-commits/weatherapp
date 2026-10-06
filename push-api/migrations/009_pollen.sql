-- Pollen notifications (MeteoSwiss stations): one more preference switch per client.
ALTER TABLE notification_preferences ADD COLUMN pollen INTEGER NOT NULL DEFAULT 0;
