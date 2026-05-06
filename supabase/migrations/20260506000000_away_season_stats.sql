-- Include away-org games in v_season_player_stats.
-- A game can be linked to two seasons: season_id (home org) and away_season_id (away org).
-- Previously only season_id was used, so away orgs never saw their linked games in stat leaders.

DROP VIEW IF EXISTS v_season_player_stats CASCADE;

CREATE VIEW v_season_player_stats AS
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
  SUM(ps.penalties)                    AS penalties
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
