-- Phase 7: org all-time player stats view

CREATE OR REPLACE VIEW v_org_player_stats AS
SELECT
  s.org_id,
  vsp.player_id,
  vsp.player_name,
  vsp.player_num,
  SUM(vsp.games_played)  AS games_played,
  SUM(vsp.goals)         AS goals,
  SUM(vsp.assists)       AS assists,
  SUM(vsp.points)        AS points,
  SUM(vsp.sog)           AS sog,
  SUM(vsp.saves)         AS saves,
  SUM(vsp.ground_balls)  AS ground_balls,
  SUM(vsp.faceoff_wins)  AS faceoff_wins,
  SUM(vsp.turnovers)     AS turnovers,
  SUM(vsp.forced_tos)    AS forced_tos,
  SUM(vsp.clears)        AS clears,
  SUM(vsp.failed_clears) AS failed_clears,
  SUM(vsp.penalties)     AS penalties
FROM v_season_player_stats vsp
JOIN seasons s ON s.id = vsp.season_id
GROUP BY s.org_id, vsp.player_id, vsp.player_name, vsp.player_num;

GRANT SELECT ON v_org_player_stats TO authenticated, anon;
