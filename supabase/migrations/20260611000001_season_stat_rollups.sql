-- =============================================================================
-- Roll up Goals Allowed (goalie records) and Faceoff Losses into the season
-- and org stat views. Both event types already flow through game_events; the
-- views just never counted them. All new columns are appended at the end so
-- CREATE OR REPLACE works without dropping dependents.
-- =============================================================================

-- ── v_game_player_stats: + goals_allowed, faceoff_losses ─────────────────────
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
  COUNT(*) FILTER (WHERE ge.event_type IN ('penalty_tech', 'penalty_min'))                AS penalties,
  COUNT(*) FILTER (WHERE ge.event_type = 'goal_allowed')                                  AS goals_allowed,
  COUNT(*) FILTER (WHERE ge.event_type = 'faceoff_loss')                                  AS faceoff_losses
FROM game_events ge
WHERE ge.deleted_at IS NULL
  AND ge.player_num IS NOT NULL
GROUP BY ge.game_id, ge.team_idx, ge.player_num, ge.player_name, ge.player_id;

-- ── v_game_team_totals: + faceoff_losses, goals_allowed ──────────────────────
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
  COUNT(*) FILTER (WHERE ge.event_type = 'mdd_success')                                   AS mdd_stops,
  COUNT(*) FILTER (WHERE ge.event_type = 'penalty_tech')                                  AS penalty_techs,
  COUNT(*) FILTER (WHERE ge.event_type = 'penalty_min')                                   AS penalty_personals,
  COALESCE(SUM(ge.penalty_minutes) FILTER (WHERE ge.event_type = 'penalty_min'), 0)       AS penalty_minutes_total,
  COUNT(*) FILTER (WHERE ge.event_type IN ('penalty_tech','penalty_min') AND ge.is_non_releasable IS TRUE) AS nr_penalties,
  COUNT(*) FILTER (
    WHERE ge.event_type = 'goal'
      AND ge.goal_time IS NOT NULL
      AND is_emo_goal(ge.game_id, ge.team_idx, ge.goal_time, ge.quarter)
  )                                                                                        AS emo_goals,
  COUNT(*) FILTER (
    WHERE ge.event_type = 'goal'
      AND ge.goal_time IS NOT NULL
      AND is_mdd_goal(ge.game_id, ge.team_idx, ge.goal_time, ge.quarter)
  )                                                                                        AS mdd_goals,
  COUNT(*) FILTER (WHERE ge.event_type = 'faceoff_loss')                                  AS faceoff_losses,
  COUNT(*) FILTER (WHERE ge.event_type = 'goal_allowed')                                  AS goals_allowed
FROM game_events ge
WHERE ge.deleted_at IS NULL
GROUP BY ge.game_id, ge.team_idx;

-- ── v_season_player_stats: + goals_allowed, faceoff_losses ───────────────────
-- (latest definition from 20260506000000_away_season_stats.sql, columns appended)
CREATE OR REPLACE VIEW v_season_player_stats AS
WITH game_season_pairs AS (
  SELECT id AS game_id, season_id      AS season_id FROM games WHERE season_id      IS NOT NULL AND schema_ver = 2
  UNION ALL
  SELECT id AS game_id, away_season_id AS season_id FROM games WHERE away_season_id IS NOT NULL AND schema_ver = 2
)
SELECT
  gsp.season_id,
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
  SUM(ps.penalties)                    AS penalties,
  SUM(ps.goals_allowed)                AS goals_allowed,
  SUM(ps.faceoff_losses)               AS faceoff_losses
FROM v_game_player_stats ps
JOIN game_season_pairs gsp ON gsp.game_id = ps.game_id
JOIN games g               ON g.id        = ps.game_id
JOIN seasons s             ON s.id        = gsp.season_id
JOIN teams pt
  ON pt.id = CASE ps.team_idx WHEN 0 THEN g.home_team_id ELSE g.away_team_id END
LEFT JOIN team_season_roster tsr
  ON  tsr.season_id = gsp.season_id
  AND tsr.player_id = ps.player_id
LEFT JOIN players p ON p.id = ps.player_id
WHERE ps.player_id IS NOT NULL
  AND pt.org_id    = s.org_id
GROUP BY
  gsp.season_id,
  tsr.team_id,
  ps.player_id,
  COALESCE(tsr.jersey_num, p.number),
  p.name;

GRANT SELECT ON v_season_player_stats TO authenticated, anon;

-- ── v_season_team_stats: + faceoff_losses ────────────────────────────────────
CREATE OR REPLACE VIEW v_season_team_stats AS
SELECT
  g.season_id,
  g.org_id,
  g.home_team_id                                                                  AS team_id,
  t.name                                                                          AS team_name,
  t.color                                                                         AS team_color,
  0                                                                               AS team_slot,
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
  SUM(home.mdd_goals)                                                             AS mdd_goals,
  SUM(home.faceoff_losses)                                                        AS faceoff_losses
FROM games g
JOIN teams t ON t.id = g.home_team_id
JOIN v_game_team_totals home ON home.game_id = g.id AND home.team_idx = 0
JOIN v_game_team_totals away ON away.game_id = g.id AND away.team_idx = 1
WHERE g.season_id IS NOT NULL
  AND g.schema_ver = 2
  AND g.home_team_id IS NOT NULL
GROUP BY g.season_id, g.org_id, g.home_team_id, t.name, t.color

UNION ALL

SELECT
  g.season_id,
  g.org_id,
  g.away_team_id                                                                  AS team_id,
  t.name                                                                          AS team_name,
  t.color                                                                         AS team_color,
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
  SUM(away.mdd_goals),
  SUM(away.faceoff_losses)
FROM games g
JOIN teams t ON t.id = g.away_team_id
JOIN v_game_team_totals home ON home.game_id = g.id AND home.team_idx = 0
JOIN v_game_team_totals away ON away.game_id = g.id AND away.team_idx = 1
WHERE g.season_id IS NOT NULL
  AND g.schema_ver = 2
  AND g.away_team_id IS NOT NULL
GROUP BY g.season_id, g.org_id, g.away_team_id, t.name, t.color;

GRANT SELECT ON v_season_team_stats TO authenticated, anon;

-- ── v_org_player_stats: + goals_allowed, faceoff_losses ──────────────────────
CREATE OR REPLACE VIEW v_org_player_stats AS
SELECT
  s.org_id,
  vsp.player_id,
  vsp.player_name,
  vsp.player_num,
  SUM(vsp.games_played)   AS games_played,
  SUM(vsp.goals)          AS goals,
  SUM(vsp.assists)        AS assists,
  SUM(vsp.points)         AS points,
  SUM(vsp.sog)            AS sog,
  SUM(vsp.saves)          AS saves,
  SUM(vsp.ground_balls)   AS ground_balls,
  SUM(vsp.faceoff_wins)   AS faceoff_wins,
  SUM(vsp.turnovers)      AS turnovers,
  SUM(vsp.forced_tos)     AS forced_tos,
  SUM(vsp.clears)         AS clears,
  SUM(vsp.failed_clears)  AS failed_clears,
  SUM(vsp.penalties)      AS penalties,
  SUM(vsp.goals_allowed)  AS goals_allowed,
  SUM(vsp.faceoff_losses) AS faceoff_losses
FROM v_season_player_stats vsp
JOIN seasons s ON s.id = vsp.season_id
GROUP BY s.org_id, vsp.player_id, vsp.player_name, vsp.player_num;

GRANT SELECT ON v_org_player_stats TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
