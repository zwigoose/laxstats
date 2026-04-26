-- =============================================================================
-- Fix v_season_player_stats: player_id is the canonical key for stat rollups
--
-- Bugs in the original view:
--
-- 1. team_idx in GROUP BY — this is the home/away slot within a single game
--    (0 = home, 1 = away). A team alternates between 0 and 1 across games, so
--    including it in the GROUP BY splits every player's season stats into two
--    rows: one for games their team was home, one for away. Wrong.
--
-- 2. player_num in GROUP BY — sourced from game_events at record time. If the
--    same player's number is entered differently across games (number change,
--    typo, etc.) their stats accumulate into separate rows instead of one.
--    Number is a display attribute; player_id is the identity.
--
-- Fix: GROUP BY (season_id, team_id, player_id) only.
-- Display number pulled from team_season_roster.jersey_num → players.number.
-- Display name pulled from players.name (canonical, not from event text).
-- Only rows where player_id IS NOT NULL are aggregated (ad-hoc/unregistered
-- players without an id cannot be reliably tracked across games).
-- =============================================================================

DROP MATERIALIZED VIEW IF EXISTS v_season_player_stats CASCADE;

CREATE MATERIALIZED VIEW v_season_player_stats AS
SELECT
  g.season_id,
  tsr.team_id,
  -- Display number: per-season roster override, then canonical player number.
  -- Never sourced from game_events (changes don't affect identity).
  COALESCE(tsr.jersey_num, p.number)  AS player_num,
  -- Display name from the players table, not from event text.
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
-- Roster join: links player to their team for this season and provides
-- the season-specific jersey number override.
LEFT JOIN team_season_roster tsr
  ON  tsr.season_id = g.season_id
  AND tsr.player_id = ps.player_id
-- Player join: provides canonical name and default jersey number.
LEFT JOIN players p ON p.id = ps.player_id
WHERE g.season_id  IS NOT NULL
  AND g.schema_ver = 2
  AND ps.player_id IS NOT NULL   -- exclude ad-hoc (unregistered) players
GROUP BY
  g.season_id,
  tsr.team_id,
  ps.player_id,
  -- Must be in GROUP BY because they're non-aggregated expressions.
  -- Values are functionally determined by player_id + team_id + season_id,
  -- so this grouping produces exactly one row per player per season team.
  COALESCE(tsr.jersey_num, p.number),
  p.name
WITH NO DATA;

-- Unique index: one row per (season, player, team).
-- COALESCE handles players with events but no roster entry (team_id = null).
CREATE UNIQUE INDEX idx_v_season_player_stats_pk
  ON v_season_player_stats (
    season_id,
    player_id,
    COALESCE(team_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
