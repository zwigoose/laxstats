-- v_season_player_stats and v_season_team_stats still hard-filtered
-- `schema_ver = 2`, written back when 2 was the only event-sourced version.
-- Since 20260707000005_event_sourcing_phase4.sql moved the default to 3,
-- every game created since then has been silently excluded from season and
-- org-wide leaderboards (v_org_player_stats sums v_season_player_stats, so
-- it inherited the gap too). Per-game stats were never affected —
-- v_game_player_stats / v_game_team_totals don't filter on schema_ver at all.
-- `>= 2` is the correct, forward-compatible check used everywhere else in
-- the schema (project_game, games_state_freeze, etc.) — anything on the
-- event-sourced path, not just exactly version 2.

CREATE OR REPLACE VIEW v_season_player_stats AS
 WITH game_season_pairs AS (
         SELECT games.id AS game_id,
            games.season_id
           FROM games
          WHERE games.season_id IS NOT NULL AND games.schema_ver >= 2
        UNION ALL
         SELECT games.id AS game_id,
            games.away_season_id AS season_id
           FROM games
          WHERE games.away_season_id IS NOT NULL AND games.schema_ver >= 2
        )
 SELECT gsp.season_id,
    tsr.team_id,
    COALESCE(tsr.jersey_num, p.number) AS player_num,
    p.name AS player_name,
    ps.player_id,
    count(DISTINCT ps.game_id) AS games_played,
    sum(ps.goals) AS goals,
    sum(ps.assists) AS assists,
    sum(ps.goals + ps.assists) AS points,
    sum(ps.sog) AS sog,
    sum(ps.saves) AS saves,
    sum(ps.ground_balls) AS ground_balls,
    sum(ps.faceoff_wins) AS faceoff_wins,
    sum(ps.turnovers) AS turnovers,
    sum(ps.forced_tos) AS forced_tos,
    sum(ps.clears) AS clears,
    sum(ps.failed_clears) AS failed_clears,
    sum(ps.penalties) AS penalties,
    sum(ps.goals_allowed) AS goals_allowed,
    sum(ps.faceoff_losses) AS faceoff_losses
   FROM v_game_player_stats ps
     JOIN game_season_pairs gsp ON gsp.game_id = ps.game_id
     JOIN games g ON g.id = ps.game_id
     JOIN seasons s ON s.id = gsp.season_id
     JOIN teams pt ON pt.id =
        CASE ps.team_idx
            WHEN 0 THEN g.home_team_id
            ELSE g.away_team_id
        END
     LEFT JOIN team_season_roster tsr ON tsr.season_id = gsp.season_id AND tsr.player_id = ps.player_id
     LEFT JOIN players p ON p.id = ps.player_id
  WHERE ps.player_id IS NOT NULL AND pt.org_id = s.org_id
  GROUP BY gsp.season_id, tsr.team_id, ps.player_id, (COALESCE(tsr.jersey_num, p.number)), p.name;

CREATE OR REPLACE VIEW v_season_team_stats AS
 SELECT g.season_id,
    g.org_id,
    g.home_team_id AS team_id,
    t.name AS team_name,
    t.color AS team_color,
    0 AS team_slot,
    count(*) AS games_played,
    count(*) FILTER (WHERE home.goals > away.goals) AS wins,
    count(*) FILTER (WHERE home.goals < away.goals) AS losses,
    sum(home.goals) AS goals_for,
    sum(away.goals) AS goals_against,
    sum(home.sog) AS sog,
    sum(home.saves) AS saves,
    sum(home.ground_balls) AS ground_balls,
    sum(home.faceoff_wins) AS faceoff_wins,
    sum(home.emo_goals) AS emo_goals,
    sum(home.mdd_goals) AS mdd_goals,
    sum(home.faceoff_losses) AS faceoff_losses
   FROM games g
     JOIN teams t ON t.id = g.home_team_id
     JOIN v_game_team_totals home ON home.game_id = g.id AND home.team_idx = 0
     JOIN v_game_team_totals away ON away.game_id = g.id AND away.team_idx = 1
  WHERE g.season_id IS NOT NULL AND g.schema_ver >= 2 AND g.home_team_id IS NOT NULL
  GROUP BY g.season_id, g.org_id, g.home_team_id, t.name, t.color
UNION ALL
 SELECT g.season_id,
    g.org_id,
    g.away_team_id AS team_id,
    t.name AS team_name,
    t.color AS team_color,
    1 AS team_slot,
    count(*) AS games_played,
    count(*) FILTER (WHERE away.goals > home.goals) AS wins,
    count(*) FILTER (WHERE away.goals < home.goals) AS losses,
    sum(away.goals) AS goals_for,
    sum(home.goals) AS goals_against,
    sum(away.sog) AS sog,
    sum(away.saves) AS saves,
    sum(away.ground_balls) AS ground_balls,
    sum(away.faceoff_wins) AS faceoff_wins,
    sum(away.emo_goals) AS emo_goals,
    sum(away.mdd_goals) AS mdd_goals,
    sum(away.faceoff_losses) AS faceoff_losses
   FROM games g
     JOIN teams t ON t.id = g.away_team_id
     JOIN v_game_team_totals home ON home.game_id = g.id AND home.team_idx = 0
     JOIN v_game_team_totals away ON away.game_id = g.id AND away.team_idx = 1
  WHERE g.season_id IS NOT NULL AND g.schema_ver >= 2 AND g.away_team_id IS NOT NULL
  GROUP BY g.season_id, g.org_id, g.away_team_id, t.name, t.color;
