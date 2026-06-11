-- Blocked shots are no longer tracked (historical blocked-shot data is
-- intentionally forfeited). event_type is free text, so only the rows and the
-- shot_outcome CHECK constraint need updating.

DELETE FROM game_events WHERE event_type = 'shot_blocked';

UPDATE game_events SET shot_outcome = NULL WHERE shot_outcome = 'blocked';

ALTER TABLE game_events
  DROP CONSTRAINT IF EXISTS game_events_shot_outcome_check;
ALTER TABLE game_events
  ADD CONSTRAINT game_events_shot_outcome_check
    CHECK (shot_outcome IN ('missed', 'saved', 'post'));
