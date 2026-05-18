ALTER TABLE game_events ADD COLUMN game_time text;
COMMENT ON COLUMN game_events.game_time IS 'Clock time of the event (MM:SS)';