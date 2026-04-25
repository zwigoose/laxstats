-- =============================================================================
-- LaxStats v2 — Phase 4: Multi-user scoring additions
-- =============================================================================

-- ── 1. Add game_date to games ─────────────────────────────────────────────────
ALTER TABLE games ADD COLUMN IF NOT EXISTS game_date date;

-- ── 2. Add foul_name to game_events ──────────────────────────────────────────
-- (is_possible_duplicate, deleted_at, deleted_by already exist from Phase 1)
ALTER TABLE game_events ADD COLUMN IF NOT EXISTS foul_name text;

-- ── 3. Fix v_game_player_stats ────────────────────────────────────────────────
-- Correct event type names to match LaxStats EVENTS[] ids.
-- Drop dependents first (CASCADE), then recreate all.
DROP MATERIALIZED VIEW IF EXISTS v_season_player_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS v_season_team_stats CASCADE;
DROP VIEW IF EXISTS v_game_player_stats CASCADE;
DROP VIEW IF EXISTS v_game_team_totals CASCADE;

CREATE VIEW v_game_player_stats AS
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
  COUNT(*) FILTER (WHERE ge.event_type IN ('penalty_tech', 'penalty_min'))                AS penalties
FROM game_events ge
WHERE ge.deleted_at IS NULL
  AND ge.player_num IS NOT NULL
GROUP BY ge.game_id, ge.team_idx, ge.player_num, ge.player_name, ge.player_id;

-- ── 4. Fix v_game_team_totals ─────────────────────────────────────────────────
-- Use correct event type names: mdd_success (not mdd_stop), penalty_tech/penalty_min.
CREATE VIEW v_game_team_totals AS
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
  -- EMO goals: scored while opposing team had an active releasable penalty
  COUNT(*) FILTER (
    WHERE ge.event_type = 'goal'
      AND ge.goal_time IS NOT NULL
      AND is_emo_goal(ge.game_id, ge.team_idx, ge.goal_time, ge.quarter)
  )                                                                                        AS emo_goals,
  -- MDD goals: scored while scoring team had any active penalty (opponent EMO'd)
  COUNT(*) FILTER (
    WHERE ge.event_type = 'goal'
      AND ge.goal_time IS NOT NULL
      AND is_mdd_goal(ge.game_id, ge.team_idx, ge.goal_time, ge.quarter)
  )                                                                                        AS mdd_goals
FROM game_events ge
WHERE ge.deleted_at IS NULL
GROUP BY ge.game_id, ge.team_idx;

-- ── 5. Duplicate detection trigger ───────────────────────────────────────────
-- Flags events as possible duplicates if a similar event was inserted within
-- 5 seconds by a DIFFERENT user in the same game, quarter, and event type.
CREATE OR REPLACE FUNCTION game_events_dup_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM game_events
    WHERE game_id    = NEW.game_id
      AND team_idx   = NEW.team_idx
      AND event_type = NEW.event_type
      AND quarter    = NEW.quarter
      AND id         <> NEW.id
      AND created_by <> NEW.created_by
      AND created_at > NOW() - interval '5 seconds'
      AND deleted_at IS NULL
  ) THEN
    NEW.is_possible_duplicate := true;
    -- Also mark any matching recent event from the other scorer
    UPDATE game_events
      SET is_possible_duplicate = true
    WHERE game_id    = NEW.game_id
      AND team_idx   = NEW.team_idx
      AND event_type = NEW.event_type
      AND quarter    = NEW.quarter
      AND id         <> NEW.id
      AND created_by <> NEW.created_by
      AND created_at > NOW() - interval '5 seconds'
      AND deleted_at IS NULL
      AND is_possible_duplicate = false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_game_events_dup_check ON game_events;
CREATE TRIGGER trg_game_events_dup_check
  BEFORE INSERT ON game_events
  FOR EACH ROW EXECUTE FUNCTION game_events_dup_check();

-- ── 6. Guest scorekeeper invite RPCs ─────────────────────────────────────────

-- Generate a fresh invite token for a game (coach+ only, 24-hour expiry)
CREATE OR REPLACE FUNCTION create_scorekeeper_invite(
  p_game_id uuid,
  p_label   text DEFAULT NULL
)
RETURNS text
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_token text;
BEGIN
  -- Caller must be the game owner, an org scorekeeper+, or platform admin
  IF NOT (
    is_platform_admin()
    OR EXISTS (SELECT 1 FROM games WHERE id = p_game_id AND user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM games g
      JOIN org_members om ON om.org_id = g.org_id
      WHERE g.id = p_game_id
        AND om.user_id = auth.uid()
        AND om.role IN ('org_admin','coach','scorekeeper')
    )
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  v_token := encode(gen_random_bytes(18), 'base64');
  -- Replace URL-unsafe chars
  v_token := replace(replace(v_token, '+', '-'), '/', '_');
  v_token := replace(v_token, '=', '');

  INSERT INTO game_scorekeepers (game_id, invited_by, label, invite_token, expires_at)
    VALUES (p_game_id, auth.uid(), p_label, v_token, now() + interval '24 hours');

  RETURN v_token;
END;
$$;

-- Claim an invite token — records the authenticated user against the scorekeeper row
CREATE OR REPLACE FUNCTION claim_scorekeeper_invite(p_token text)
RETURNS void
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_row game_scorekeepers%ROWTYPE;
BEGIN
  SELECT * INTO v_row
    FROM game_scorekeepers
    WHERE invite_token = p_token
      AND expires_at > now()
    LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid or expired token';
  END IF;

  UPDATE game_scorekeepers
    SET user_id = auth.uid(), used_at = now()
    WHERE id = v_row.id
      AND user_id IS NULL;  -- only claim once
END;
$$;

-- ── 7. Recreate materialized views (dropped in step 3) ───────────────────────
CREATE MATERIALIZED VIEW v_season_player_stats AS
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

CREATE UNIQUE INDEX idx_v_season_player_stats_pk
  ON v_season_player_stats (season_id, COALESCE(player_id::text, player_num), team_idx);

CREATE MATERIALIZED VIEW v_season_team_stats AS
SELECT
  g.season_id,
  g.org_id,
  g.home_team_id                                                                  AS team_id,
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

CREATE UNIQUE INDEX idx_v_season_team_stats_pk
  ON v_season_team_stats (season_id, team_id);
