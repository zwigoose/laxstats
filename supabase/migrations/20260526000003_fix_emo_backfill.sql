-- Fix EMO backfill: previous migrations used event_type = 'penalty' but
-- the app stores penalties as 'penalty_tech' (30-second technical) or
-- 'penalty_min' (personal foul, penalty_minutes * 60 seconds). The wrong
-- filter caused every goal to stay is_emo = false even when penalties exist.
--
-- Also fixes the duration: penalty_tech is always 30 s; penalty_min uses
-- the penalty_minutes column (mirroring penaltyDurSecs() in stats.js).

CREATE OR REPLACE FUNCTION _emo_backfill_check_v2(
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
    SELECT event_type,
           penalty_time,
           penalty_minutes,
           COALESCE(is_non_releasable, false) AS is_nr,
           quarter  AS pen_q,
           team_idx AS pen_team
    FROM   game_events
    WHERE  game_id    = p_game_id
      AND  event_type IN ('penalty_tech', 'penalty_min')
      AND  penalty_time IS NOT NULL
      AND  deleted_at IS NULL
  LOOP
    pen_remaining := parse_clock_secs(v_pen.penalty_time);

    -- Mirror penaltyDurSecs() in stats.js
    to_serve := CASE
      WHEN v_pen.event_type = 'penalty_tech' THEN 30
      ELSE COALESCE(v_pen.penalty_minutes, 1) * 60
    END;

    -- Compute expiry quarter and remaining clock
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

    -- Skip if goal is before penalty started
    IF p_quarter < v_pen.pen_q THEN CONTINUE; END IF;
    IF p_quarter = v_pen.pen_q AND p_goal_remaining > pen_remaining THEN CONTINUE; END IF;
    -- Skip if goal is after penalty expired
    IF p_quarter > pen_expires_q THEN CONTINUE; END IF;
    IF p_quarter = pen_expires_q AND p_goal_remaining < pen_expires_r THEN CONTINUE; END IF;

    -- Penalty is active at goal time.
    -- Check if a prior goal by the EMO team already released this penalty.
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

-- Re-run backfill for all goals (resets any false values from prior runs)
UPDATE game_events ge
SET    is_emo = _emo_backfill_check_v2(
         ge.game_id, ge.team_idx, ge.quarter, parse_clock_secs(ge.goal_time)
       )
WHERE  ge.event_type = 'goal'
  AND  ge.goal_time  IS NOT NULL
  AND  ge.deleted_at IS NULL;

DROP FUNCTION _emo_backfill_check_v2;

NOTIFY pgrst, 'reload schema';
