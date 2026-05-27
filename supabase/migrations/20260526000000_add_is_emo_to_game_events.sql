-- Store whether a goal was scored during an extra-man opportunity (EMO).
-- Previously the EMO flag was computed client-side at log time but never
-- persisted, so EMO stats reset to zero on any page reload.
ALTER TABLE game_events
  ADD COLUMN IF NOT EXISTS is_emo boolean NOT NULL DEFAULT false;
