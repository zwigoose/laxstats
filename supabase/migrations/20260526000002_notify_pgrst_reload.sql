-- Force PostgREST to reload its schema cache so the is_emo column added
-- in 20260526000000 is visible in select("*") REST responses. supabase
-- db push applies DDL directly to Postgres but does not guarantee the
-- PostgREST API server refreshes its column introspection; without this
-- NOTIFY the JS client reads undefined for row.is_emo on every row.
NOTIFY pgrst, 'reload schema';

-- Re-run the full EMO backfill from 20260526000001 to cover any goals
-- inserted between the column being added (DEFAULT false) and the
-- application code being deployed (which now writes is_emo on insert).
CREATE OR REPLACE FUNCTION _emo_backfill_check(
  p_game_id         uuid,
  p_scoring_team    smallint,
  p_quarter         smallint,
  p_goal_remaining  int
) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
  v_pen           record;
  pen_remaining   int;
  to_serve        int;
  pen_expires_q   smallint;
  pen_expires_r   int;
  q               smallint;
  q_dur           int;
  is_released     boolean;
  defending_count int := 0;
  scoring_count   int := 0;
  opp_idx         smallint := 1 - p_scoring_team;
BEGIN
  FOR v_pen IN
    SELECT penalty_time,
           penalty_minutes,
           COALESCE(is_non_releasable, false) AS is_nr,
           quarter    AS pen_q,
           team_idx   AS pen_team
    FROM   game_events
    WHERE  game_id    = p_game_id
      AND  event_type = 'penalty'
      AND  deleted_at IS NULL
  LOOP
    pen_remaining := parse_clock_secs(v_pen.penalty_time);
    to_serve      := v_pen.penalty_minutes * 60;

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
    IF p_quarter = v_pen.pen_q AND p_goal_remaining > pen_remaining THEN CONTINUE; END IF;
    IF p_quarter > pen_expires_q THEN CONTINUE; END IF;
    IF p_quarter = pen_expires_q AND p_goal_remaining < pen_expires_r THEN CONTINUE; END IF;

    is_released := false;
    IF NOT v_pen.is_nr THEN
      SELECT EXISTS (
        SELECT 1 FROM game_events prev
        WHERE  prev.game_id    = p_game_id
          AND  prev.event_type = 'goal'
          AND  prev.deleted_at IS NULL
          AND  prev.goal_time  IS NOT NULL
          AND  prev.team_idx  <> v_pen.pen_team
          AND  (
            (prev.quarter = v_pen.pen_q AND prev.quarter = p_quarter
             AND parse_clock_secs(prev.goal_time) <= pen_remaining
             AND parse_clock_secs(prev.goal_time) >  p_goal_remaining)
            OR (prev.quarter > v_pen.pen_q AND prev.quarter < p_quarter)
            OR (prev.quarter = v_pen.pen_q AND prev.quarter < p_quarter
                AND parse_clock_secs(prev.goal_time) <= pen_remaining)
            OR (prev.quarter = p_quarter AND prev.quarter > v_pen.pen_q
                AND parse_clock_secs(prev.goal_time) > p_goal_remaining)
          )
      ) INTO is_released;
    END IF;

    IF NOT is_released THEN
      IF v_pen.pen_team = opp_idx THEN
        defending_count := defending_count + 1;
      ELSE
        scoring_count := scoring_count + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN defending_count > scoring_count;
END;
$$;

UPDATE game_events ge
SET    is_emo = _emo_backfill_check(
         ge.game_id, ge.team_idx, ge.quarter, parse_clock_secs(ge.goal_time)
       )
WHERE  ge.event_type = 'goal'
  AND  ge.goal_time  IS NOT NULL
  AND  ge.deleted_at IS NULL;

DROP FUNCTION _emo_backfill_check;
