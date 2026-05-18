
-- Add game_time to game_events for possession tracking
ALTER TABLE game_events ADD COLUMN game_time text;
COMMENT ON COLUMN game_events.game_time IS 'Clock time remaining (M:SS) when the event occurred.';

-- Backfill game_time from existing specialized time columns
UPDATE game_events SET game_time = COALESCE(goal_time, penalty_time, timeout_time) WHERE game_time IS NULL;
