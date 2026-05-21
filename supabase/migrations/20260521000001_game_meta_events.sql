-- Add client_created_at to game_events so the scorer's local timestamp is preserved
-- alongside the server-assigned created_at. Nullable so existing rows are unaffected.
ALTER TABLE game_events
  ADD COLUMN IF NOT EXISTS client_created_at TIMESTAMPTZ;

-- ── game_meta_events ──────────────────────────────────────────────────────────
-- Append-only log of quarter transitions and game-over events for v2 games.
-- currentQuarter, completedQuarters, and gameOver are derived by replaying
-- these rows — they are never read from games.state for v2 games.

CREATE TABLE IF NOT EXISTS game_meta_events (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id           UUID        NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  event_type        TEXT        NOT NULL CHECK (event_type IN ('quarter_end', 'game_over', 'quarter_override')),
  from_quarter      INT         NOT NULL,
  to_quarter        INT         NOT NULL,
  created_by        UUID        REFERENCES auth.users(id),
  client_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  seq               BIGINT      GENERATED ALWAYS AS IDENTITY
);

CREATE INDEX IF NOT EXISTS game_meta_events_game_id_seq
  ON game_meta_events (game_id, seq);

ALTER TABLE game_meta_events ENABLE ROW LEVEL SECURITY;

-- INSERT: must be able to score the game
CREATE POLICY "game_meta_events_insert"
  ON game_meta_events FOR INSERT
  WITH CHECK (can_score_game(game_id));

-- SELECT: any authenticated user (same as game_events)
CREATE POLICY "game_meta_events_select"
  ON game_meta_events FOR SELECT
  TO authenticated
  USING (true);

-- Realtime replication (mirrors game_events setup)
ALTER TABLE game_meta_events REPLICA IDENTITY FULL;
