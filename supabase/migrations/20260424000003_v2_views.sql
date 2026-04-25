-- =============================================================================
-- LaxStats v2 — Phase 1: SQL Views
-- These replace the client-side buildPlayerStats() / buildTeamTotals() for
-- schema_ver=2 games. v1 games continue using the JSONB path unchanged.
-- =============================================================================

-- ── v_game_player_stats ───────────────────────────────────────────────────────
-- Replaces buildPlayerStats(). Groups by (game_id, team_idx, player_num, player_name).
-- SOG = goals + shots with outcome 'saved' or 'post' (blocked/missed don't count).
CREATE OR REPLACE VIEW v_game_player_stats AS
SELECT
  ge.game_id,
  ge.team_idx,
  ge.player_num,
  ge.player_name,
  ge.player_id,
  COUNT(*) FILTER (WHERE ge.event_type = 'goal')                                          AS goals,
  COUNT(*) FILTER (WHERE ge.event_type = 'assist')                                        AS assists,
  COUNT(*) FILTER (
    WHERE ge.event_type = 'goal'
       OR (ge.event_type = 'shot' AND ge.shot_outcome IN ('saved','post'))
  )                                                                                        AS sog,
  COUNT(*) FILTER (WHERE ge.event_type = 'shot_saved')                                    AS saves,
  COUNT(*) FILTER (WHERE ge.event_type = 'ground_ball' AND ge.is_team_stat IS NOT TRUE)   AS ground_balls,
  COUNT(*) FILTER (WHERE ge.event_type = 'faceoff_win')                                   AS faceoff_wins,
  COUNT(*) FILTER (WHERE ge.event_type = 'turnover'    AND ge.is_team_stat IS NOT TRUE)   AS turnovers,
  COUNT(*) FILTER (WHERE ge.event_type = 'forced_to')                                     AS forced_tos,
  COUNT(*) FILTER (WHERE ge.event_type = 'clear'       AND ge.is_team_stat IS NOT TRUE)   AS clears,
  COUNT(*) FILTER (WHERE ge.event_type = 'failed_clear' AND ge.is_team_stat IS NOT TRUE)  AS failed_clears,
  COUNT(*) FILTER (WHERE ge.event_type = 'penalty')                                       AS penalties
FROM game_events ge
WHERE ge.deleted_at IS NULL
  AND ge.player_num IS NOT NULL
GROUP BY ge.game_id, ge.team_idx, ge.player_num, ge.player_name, ge.player_id;

-- ── v_game_team_totals ────────────────────────────────────────────────────────
-- Replaces buildTeamTotals(). Includes mirror stats and EMO/MDD derived from
-- is_emo_goal() / is_mdd_goal() functions rather than a stored flag.
-- Note: calling is_emo_goal per goal row makes this view expensive on large event
-- logs. For Phase 1 (per-game use) this is acceptable; consider materializing
-- or caching in Phase 5 if performance becomes an issue.
CREATE OR REPLACE VIEW v_game_team_totals AS
SELECT
  ge.game_id,
  ge.team_idx,
  COUNT(*) FILTER (WHERE ge.event_type = 'goal')                                          AS goals,
  COUNT(*) FILTER (WHERE ge.event_type = 'assist')                                        AS assists,
  COUNT(*) FILTER (
    WHERE ge.event_type = 'goal'
       OR (ge.event_type = 'shot' AND ge.shot_outcome IN ('saved','post'))
  )                                                                                        AS sog,
  COUNT(*) FILTER (WHERE ge.event_type = 'shot_saved')                                    AS saves,
  COUNT(*) FILTER (WHERE ge.event_type = 'ground_ball')                                   AS ground_balls,
  COUNT(*) FILTER (WHERE ge.event_type = 'faceoff_win')                                   AS faceoff_wins,
  COUNT(*) FILTER (WHERE ge.event_type = 'turnover')                                      AS turnovers,
  COUNT(*) FILTER (WHERE ge.event_type = 'forced_to')                                     AS forced_tos,
  COUNT(*) FILTER (WHERE ge.event_type = 'timeout')                                       AS timeouts,
  COUNT(*) FILTER (WHERE ge.event_type = 'clear')                                         AS clears,
  COUNT(*) FILTER (WHERE ge.event_type = 'failed_clear')                                  AS failed_clears,
  COUNT(*) FILTER (WHERE ge.event_type = 'mdd_stop')                                      AS mdd_stops,
  COUNT(*) FILTER (WHERE ge.event_type = 'penalty')                                       AS penalties,
  COUNT(*) FILTER (WHERE ge.event_type = 'penalty' AND ge.is_non_releasable IS TRUE)      AS nr_penalties,
  -- EMO goals: scored while opposing team had an active releasable penalty
  COUNT(*) FILTER (
    WHERE ge.event_type = 'goal'
      AND ge.goal_time IS NOT NULL
      AND is_emo_goal(ge.game_id, ge.team_idx, ge.goal_time, ge.quarter)
  )                                                                                        AS emo_goals,
  -- MDD goals: scored while scoring team had any active penalty
  COUNT(*) FILTER (
    WHERE ge.event_type = 'goal'
      AND ge.goal_time IS NOT NULL
      AND is_mdd_goal(ge.game_id, ge.team_idx, ge.goal_time, ge.quarter)
  )                                                                                        AS mdd_goals,
  -- Failed EMO = mdd_stop events (opponent killed the penalty)
  COUNT(*) FILTER (WHERE ge.event_type = 'mdd_stop')                                      AS failed_emo
FROM game_events ge
WHERE ge.deleted_at IS NULL
GROUP BY ge.game_id, ge.team_idx;

-- ── v_season_player_stats (materialized) ──────────────────────────────────────
-- Cross-game player stat rollups per (season_id, team_id, player).
-- Refreshed when a game is finalized (Phase 5 will wire the trigger).
CREATE MATERIALIZED VIEW IF NOT EXISTS v_season_player_stats AS
SELECT
  g.season_id,
  tsr.team_id,
  ps.team_idx,
  ps.player_num,
  ps.player_name,
  ps.player_id,
  COUNT(DISTINCT ps.game_id)  AS games_played,
  SUM(ps.goals)               AS goals,
  SUM(ps.assists)             AS assists,
  SUM(ps.goals + ps.assists)  AS points,
  SUM(ps.sog)                 AS sog,
  SUM(ps.saves)               AS saves,
  SUM(ps.ground_balls)        AS ground_balls,
  SUM(ps.faceoff_wins)        AS faceoff_wins,
  SUM(ps.turnovers)           AS turnovers,
  SUM(ps.forced_tos)          AS forced_tos,
  SUM(ps.clears)              AS clears,
  SUM(ps.failed_clears)       AS failed_clears,
  SUM(ps.penalties)           AS penalties
FROM v_game_player_stats ps
JOIN games g ON g.id = ps.game_id
LEFT JOIN team_season_roster tsr
  ON tsr.season_id = g.season_id
  AND tsr.player_id = ps.player_id
WHERE g.season_id IS NOT NULL
  AND g.schema_ver = 2
GROUP BY
  g.season_id, tsr.team_id, ps.team_idx,
  ps.player_num, ps.player_name, ps.player_id
WITH NO DATA;

-- Index for season/team lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_v_season_player_stats_pk
  ON v_season_player_stats (season_id, COALESCE(player_id::text, player_num), team_idx);

-- ── v_season_team_stats (materialized) ────────────────────────────────────────
-- Team win/loss record and aggregate stats per season.
-- Refreshed when a game is finalized.
CREATE MATERIALIZED VIEW IF NOT EXISTS v_season_team_stats AS
SELECT
  g.season_id,
  g.org_id,
  -- Home team perspective
  g.home_team_id                                                                  AS team_id,
  0                                                                               AS team_slot,  -- 0=home
  COUNT(*)                                                                        AS games_played,
  COUNT(*) FILTER (WHERE home.goals > away.goals)                                 AS wins,
  COUNT(*) FILTER (WHERE home.goals < away.goals)                                 AS losses,
  SUM(home.goals)                                                                 AS goals_for,
  SUM(away.goals)                                                                 AS goals_against,
  SUM(home.sog)                                                                   AS sog,
  SUM(home.saves)                                                                 AS saves,
  SUM(home.ground_balls)                                                          AS ground_balls,
  SUM(home.faceoff_wins)                                                          AS faceoff_wins,
  SUM(home.emo_goals)                                                             AS emo_goals,
  SUM(home.mdd_goals)                                                             AS mdd_goals
FROM games g
JOIN v_game_team_totals home ON home.game_id = g.id AND home.team_idx = 0
JOIN v_game_team_totals away ON away.game_id = g.id AND away.team_idx = 1
WHERE g.season_id IS NOT NULL
  AND g.schema_ver = 2
  AND g.home_team_id IS NOT NULL
GROUP BY g.season_id, g.org_id, g.home_team_id

UNION ALL

SELECT
  g.season_id,
  g.org_id,
  g.away_team_id                                                                  AS team_id,
  1                                                                               AS team_slot,
  COUNT(*),
  COUNT(*) FILTER (WHERE away.goals > home.goals),
  COUNT(*) FILTER (WHERE away.goals < home.goals),
  SUM(away.goals),
  SUM(home.goals),
  SUM(away.sog),
  SUM(away.saves),
  SUM(away.ground_balls),
  SUM(away.faceoff_wins),
  SUM(away.emo_goals),
  SUM(away.mdd_goals)
FROM games g
JOIN v_game_team_totals home ON home.game_id = g.id AND home.team_idx = 0
JOIN v_game_team_totals away ON away.game_id = g.id AND away.team_idx = 1
WHERE g.season_id IS NOT NULL
  AND g.schema_ver = 2
  AND g.away_team_id IS NOT NULL
GROUP BY g.season_id, g.org_id, g.away_team_id
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_v_season_team_stats_pk
  ON v_season_team_stats (season_id, team_id);
