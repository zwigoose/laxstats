-- Replace WITH NO DATA materialized views with live regular views.
-- Materialized views were always empty (never refreshed); regular views
-- query live data every time, which is correct for this workload.

DROP MATERIALIZED VIEW IF EXISTS v_season_player_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS v_season_team_stats  CASCADE;

-- ── v_season_player_stats ─────────────────────────────────────────────────────
CREATE VIEW v_season_player_stats AS
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
  p.name;

GRANT SELECT ON v_season_player_stats TO authenticated, anon;

-- ── v_season_team_stats ───────────────────────────────────────────────────────
CREATE VIEW v_season_team_stats AS
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
  SUM(home.mdd_goals)                                                             AS mdd_goals
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
  SUM(away.mdd_goals)
FROM games g
JOIN teams t ON t.id = g.away_team_id
JOIN v_game_team_totals home ON home.game_id = g.id AND home.team_idx = 0
JOIN v_game_team_totals away ON away.game_id = g.id AND away.team_idx = 1
WHERE g.season_id IS NOT NULL
  AND g.schema_ver = 2
  AND g.away_team_id IS NOT NULL
GROUP BY g.season_id, g.org_id, g.away_team_id, t.name, t.color;

GRANT SELECT ON v_season_team_stats TO authenticated, anon;
