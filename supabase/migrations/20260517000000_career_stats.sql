-- ── v_career_player_stats ─────────────────────────────────────────────────────
-- Aggregate player stats across all seasons/teams for their entire career.
CREATE OR REPLACE VIEW v_career_player_stats AS
SELECT
  p.id                                 AS player_id,
  p.name                               AS player_name,
  p.org_id,
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
FROM players p
JOIN v_game_player_stats ps ON ps.player_id = p.id
GROUP BY p.id, p.name, p.org_id;

GRANT SELECT ON v_career_player_stats TO authenticated, anon;
