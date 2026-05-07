-- Cascade game deletes to dependent tables so deleting a game automatically
-- removes its events and scorekeeper invites without a client-side pre-delete step.

ALTER TABLE game_events
  DROP CONSTRAINT game_events_game_id_fkey,
  ADD  CONSTRAINT game_events_game_id_fkey
       FOREIGN KEY (game_id) REFERENCES games ON DELETE CASCADE;

ALTER TABLE game_scorekeepers
  DROP CONSTRAINT game_scorekeepers_game_id_fkey,
  ADD  CONSTRAINT game_scorekeepers_game_id_fkey
       FOREIGN KEY (game_id) REFERENCES games ON DELETE CASCADE;
