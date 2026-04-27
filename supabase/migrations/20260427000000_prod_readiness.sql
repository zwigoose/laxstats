-- =============================================================================
-- Prod readiness fixes
--
-- 1. team_season_roster.jersey_num type fix
--    Created as text in 00001; must be integer to COALESCE with players.number.
--    Using a safe cast — jersey numbers are always numeric.
--    On prod this is a no-op (00005 already fixed it via ALTER COLUMN).
--    On staging it was never fixed — this corrects it.
--
-- 2. Refresh v_season_player_stats
--    Drops and recreates with the correct types in case the previous creation
--    attempt failed or ran against the wrong column type.
--
-- 3. Realtime publication
--    Adds game_events and game_scorekeepers to supabase_realtime so that
--    postgres_changes listeners (the fallback sync path) receive INSERT/UPDATE
--    events for multi-scorer games.
-- =============================================================================

-- 1. Fix jersey_num type ──────────────────────────────────────────────────────
DO $$
BEGIN
  IF (
    SELECT data_type FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'team_season_roster'
      AND column_name  = 'jersey_num'
  ) = 'text' THEN
    ALTER TABLE team_season_roster
      ALTER COLUMN jersey_num TYPE integer USING jersey_num::integer;
  END IF;
END $$;

-- 2. Refresh v_season_player_stats ────────────────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS v_season_player_stats CASCADE;

CREATE MATERIALIZED VIEW v_season_player_stats AS
SELECT
  g.season_id,
  tsr.team_id,
  COALESCE(tsr.jersey_num, p.number)  AS player_num,
  p.name                               AS player_name,
  ps.player_id,
  COUNT(DISTINCT ps.game_id)           AS games_played,
  SUM(ps.goals)                        AS goals,
  SUM(ps.assists)                      AS assists,
  SUM(ps.goals + ps.assists)           AS points,
  SUM(ps.sog)                          AS sog,
  SUM(ps.saves)                        AS saves,
  SUM(ps.ground_balls)                 AS ground_balls,
  SUM(ps.faceoff_wins)                 AS faceoff_wins,
  SUM(ps.turnovers)                    AS turnovers,
  SUM(ps.forced_tos)                   AS forced_tos,
  SUM(ps.clears)                       AS clears,
  SUM(ps.failed_clears)                AS failed_clears,
  SUM(ps.penalties)                    AS penalties
FROM v_game_player_stats ps
JOIN games g ON g.id = ps.game_id
LEFT JOIN team_season_roster tsr
  ON  tsr.season_id = g.season_id
  AND tsr.player_id = ps.player_id
LEFT JOIN players p ON p.id = ps.player_id
WHERE g.season_id  IS NOT NULL
  AND g.schema_ver = 2
  AND ps.player_id IS NOT NULL
GROUP BY
  g.season_id,
  tsr.team_id,
  ps.player_id,
  COALESCE(tsr.jersey_num, p.number),
  p.name
WITH NO DATA;

CREATE UNIQUE INDEX idx_v_season_player_stats_pk
  ON v_season_player_stats (
    season_id,
    player_id,
    COALESCE(team_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- 3. Realtime publication ─────────────────────────────────────────────────────
DO $$
BEGIN
  -- game_events: primary table for multi-scorer real-time sync fallback
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'game_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE game_events;
  END IF;

  -- game_scorekeepers: presence/invite table watched by secondary scorers
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'game_scorekeepers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE game_scorekeepers;
  END IF;
END $$;
