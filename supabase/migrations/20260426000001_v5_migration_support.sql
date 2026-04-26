-- =============================================================================
-- LaxStats v2 — Phase 5: Historical migration support
-- =============================================================================

-- ── migration_errors ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS migration_errors (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id       uuid        REFERENCES games ON DELETE SET NULL,
  phase         text,       -- 'insert' | 'verify' | 'update'
  error_message text        NOT NULL,
  created_at    timestamptz DEFAULT now()
);

-- ── Fix is_emo_goal: event_type was 'penalty' but actual types are penalty_tech/penalty_min ──
CREATE OR REPLACE FUNCTION is_emo_goal(
  p_game_id  uuid,
  p_team_idx smallint,
  p_goal_time text,
  p_quarter  smallint
) RETURNS boolean STABLE SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  goal_remaining  int := parse_clock_secs(p_goal_time);
  opp_idx         smallint := 1 - p_team_idx;
  v_pen           record;
  pen_remaining   int;
  to_serve        int;
  pen_expires_q   smallint;
  pen_expires_r   int;
  q               smallint;
  q_dur           int;
BEGIN
  FOR v_pen IN
    SELECT event_type, penalty_time, penalty_minutes, quarter AS pen_q
    FROM game_events
    WHERE game_id = p_game_id
      AND team_idx = opp_idx
      AND event_type IN ('penalty_tech', 'penalty_min')
      AND is_non_releasable IS NOT TRUE
      AND deleted_at IS NULL
  LOOP
    pen_remaining := parse_clock_secs(v_pen.penalty_time);
    to_serve := CASE
      WHEN v_pen.event_type = 'penalty_tech' THEN 30
      ELSE COALESCE(v_pen.penalty_minutes, 1) * 60
    END;

    IF pen_remaining >= to_serve THEN
      pen_expires_q := v_pen.pen_q;
      pen_expires_r := pen_remaining - to_serve;
    ELSE
      to_serve := to_serve - pen_remaining;
      q        := v_pen.pen_q + 1;
      LOOP
        q_dur := quarter_duration_secs(q);
        EXIT WHEN to_serve <= q_dur;
        to_serve := to_serve - q_dur;
        q        := q + 1;
      END LOOP;
      pen_expires_q := q;
      pen_expires_r := quarter_duration_secs(q) - to_serve;
    END IF;

    IF p_quarter < v_pen.pen_q THEN CONTINUE; END IF;
    IF p_quarter = v_pen.pen_q AND goal_remaining > pen_remaining THEN CONTINUE; END IF;
    IF p_quarter > pen_expires_q THEN CONTINUE; END IF;
    IF p_quarter = pen_expires_q AND goal_remaining < pen_expires_r THEN CONTINUE; END IF;

    IF NOT EXISTS (
      SELECT 1 FROM game_events prev
      WHERE prev.game_id = p_game_id
        AND prev.team_idx = p_team_idx
        AND prev.event_type = 'goal'
        AND prev.deleted_at IS NULL
        AND (
          (prev.quarter = v_pen.pen_q AND prev.quarter = p_quarter
           AND parse_clock_secs(prev.goal_time) <= pen_remaining
           AND parse_clock_secs(prev.goal_time) > goal_remaining)
          OR (prev.quarter > v_pen.pen_q AND prev.quarter < p_quarter)
          OR (prev.quarter = v_pen.pen_q AND prev.quarter < p_quarter
              AND parse_clock_secs(prev.goal_time) <= pen_remaining)
          OR (prev.quarter = p_quarter AND prev.quarter > v_pen.pen_q
              AND parse_clock_secs(prev.goal_time) > goal_remaining)
        )
    ) THEN
      RETURN true;
    END IF;
  END LOOP;
  RETURN false;
END;
$$;

-- ── Fix is_mdd_goal: same event_type fix ─────────────────────────────────────
CREATE OR REPLACE FUNCTION is_mdd_goal(
  p_game_id  uuid,
  p_team_idx smallint,
  p_goal_time text,
  p_quarter  smallint
) RETURNS boolean STABLE SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  goal_remaining  int := parse_clock_secs(p_goal_time);
  v_pen           record;
  pen_remaining   int;
  to_serve        int;
  pen_expires_q   smallint;
  pen_expires_r   int;
  q               smallint;
  q_dur           int;
BEGIN
  FOR v_pen IN
    SELECT event_type, penalty_time, penalty_minutes, is_non_releasable, quarter AS pen_q
    FROM game_events
    WHERE game_id = p_game_id
      AND team_idx = p_team_idx
      AND event_type IN ('penalty_tech', 'penalty_min')
      AND deleted_at IS NULL
  LOOP
    pen_remaining := parse_clock_secs(v_pen.penalty_time);
    to_serve := CASE
      WHEN v_pen.event_type = 'penalty_tech' THEN 30
      ELSE COALESCE(v_pen.penalty_minutes, 1) * 60
    END;

    IF pen_remaining >= to_serve THEN
      pen_expires_q := v_pen.pen_q;
      pen_expires_r := pen_remaining - to_serve;
    ELSE
      to_serve := to_serve - pen_remaining;
      q        := v_pen.pen_q + 1;
      LOOP
        q_dur := quarter_duration_secs(q);
        EXIT WHEN to_serve <= q_dur;
        to_serve := to_serve - q_dur;
        q        := q + 1;
      END LOOP;
      pen_expires_q := q;
      pen_expires_r := quarter_duration_secs(q) - to_serve;
    END IF;

    IF p_quarter < v_pen.pen_q THEN CONTINUE; END IF;
    IF p_quarter = v_pen.pen_q AND goal_remaining > pen_remaining THEN CONTINUE; END IF;
    IF p_quarter > pen_expires_q THEN CONTINUE; END IF;
    IF p_quarter = pen_expires_q AND goal_remaining < pen_expires_r THEN CONTINUE; END IF;

    IF v_pen.is_non_releasable IS NOT TRUE THEN
      IF EXISTS (
        SELECT 1 FROM game_events prev
        WHERE prev.game_id = p_game_id
          AND prev.team_idx = 1 - p_team_idx
          AND prev.event_type = 'goal'
          AND prev.deleted_at IS NULL
          AND (
            (prev.quarter = v_pen.pen_q AND prev.quarter = p_quarter
             AND parse_clock_secs(prev.goal_time) <= pen_remaining
             AND parse_clock_secs(prev.goal_time) > goal_remaining)
            OR (prev.quarter > v_pen.pen_q AND prev.quarter < p_quarter)
            OR (prev.quarter = v_pen.pen_q AND prev.quarter < p_quarter
                AND parse_clock_secs(prev.goal_time) <= pen_remaining)
            OR (prev.quarter = p_quarter AND prev.quarter > v_pen.pen_q
                AND parse_clock_secs(prev.goal_time) > goal_remaining)
          )
      ) THEN
        CONTINUE;
      END IF;
    END IF;

    RETURN true;
  END LOOP;
  RETURN false;
END;
$$;
