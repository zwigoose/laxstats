-- ═══════════════════════════════════════════════════════════════════════════
-- Quarter fix: real repair instead of a bare pointer override
--
-- 1. relabel_event_quarters RPC — move mis-stamped stat events to the right
--    quarter. SECURITY DEFINER + can_score_game (mirrors
--    soft_delete_event_group): the plain UPDATE policy is creator-or-admin,
--    so a scorer fixing a co-scorer's events would otherwise silently no-op.
--    The UPDATE fires the projection trigger. EMO/MDD view stats self-correct
--    because is_emo_goal()/is_mdd_goal() read ge.quarter live; the
--    client-stamped is_emo column on old rows is not recomputed (accepted —
--    boundary corner case).
--
-- 2. project_game: quarter_override now reconciles completedQuarters —
--    quarters at or beyond the override target un-complete, so overriding
--    down can no longer leave a quarter simultaneously "current" and
--    "completed". Mirrored in src/domain/reduceGame.js; parity enforced by
--    the override-down fixture.
--
-- (Undoing an accidental quarter transition needs no new SQL: meta events
-- are individually grouped, soft_delete_event_group tombstones them, and
-- replay heals the quarter machine.)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Relabel RPC ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION relabel_event_quarters(p_game_id uuid, p_event_ids uuid[], p_quarter int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT can_score_game(p_game_id) THEN
    RAISE EXCEPTION 'not authorized to modify this game';
  END IF;
  IF p_quarter IS NULL OR p_quarter NOT BETWEEN 1 AND 9 THEN
    RAISE EXCEPTION 'invalid quarter: %', p_quarter;
  END IF;
  UPDATE game_events
     SET quarter = p_quarter
   WHERE game_id = p_game_id
     AND id = ANY(p_event_ids)
     AND deleted_at IS NULL
     AND quarter IS NOT NULL;  -- stat events only; state/meta rows have no quarter
END;
$$;

REVOKE EXECUTE ON FUNCTION relabel_event_quarters(uuid, uuid[], int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION relabel_event_quarters(uuid, uuid[], int) TO authenticated, anon;

-- ── 2. project_game: override reconciles completedQuarters ───────────────────

CREATE OR REPLACE FUNCTION project_game(p_game_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_state      jsonb;
  v_schema_ver int;
  v_q          int;
  v_completed  jsonb := '[]'::jsonb;
  v_over       boolean;
  v_has_meta   boolean := false;
  v_score0     int;
  v_score1     int;
  v_started    boolean;
  v_reg        jsonb;
  v_team0      jsonb;
  v_team1      jsonb;
  v_teams      jsonb;
  v_goalies    jsonb;
  r            record;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_game_id::text, 0));

  SELECT state, schema_ver INTO v_state, v_schema_ver
  FROM games WHERE id = p_game_id;
  IF NOT FOUND OR v_schema_ver < 2 THEN
    RETURN;
  END IF;

  v_q    := COALESCE((v_state ->> 'currentQuarter')::int, 1);
  v_over := COALESCE((v_state ->> 'gameOver')::boolean, false);
  FOR r IN
    SELECT ge.event_type, ge.payload
    FROM game_events ge
    JOIN event_type_registry reg ON reg.event_type = ge.event_type
    WHERE ge.game_id = p_game_id AND ge.deleted_at IS NULL AND reg.kind = 'meta'
    ORDER BY ge.seq
  LOOP
    IF NOT v_has_meta THEN
      v_has_meta := true;
      v_q        := 1;
      v_over     := false;
    END IF;
    IF r.event_type = 'quarter_end' THEN
      v_completed := v_completed || (r.payload -> 'fromQuarter');
      v_q         := (r.payload ->> 'toQuarter')::int;
    ELSIF r.event_type = 'game_over' THEN
      v_completed := v_completed || (r.payload -> 'fromQuarter');
      v_over      := true;
      v_q         := (r.payload ->> 'fromQuarter')::int;
    ELSIF r.event_type = 'quarter_override' THEN
      v_q := (r.payload ->> 'toQuarter')::int;
      -- Reconcile: quarters at or beyond the override target un-complete,
      -- so a downward override cannot leave a quarter both current and done.
      v_completed := (
        SELECT COALESCE(jsonb_agg(t.x ORDER BY t.ord), '[]'::jsonb)
        FROM jsonb_array_elements(v_completed) WITH ORDINALITY AS t(x, ord)
        WHERE (t.x)::text::int < v_q
      );
    END IF;
  END LOOP;

  SELECT COALESCE(jsonb_object_agg(key, payload), '{}'::jsonb) INTO v_reg
  FROM (
    SELECT DISTINCT ON (ge.event_type, COALESCE(ge.team_idx, -1))
           ge.event_type || ':' || COALESCE(ge.team_idx::text, '-') AS key,
           ge.payload
    FROM game_events ge
    JOIN event_type_registry reg ON reg.event_type = ge.event_type
    WHERE ge.game_id = p_game_id AND ge.deleted_at IS NULL AND reg.kind = 'state'
    ORDER BY ge.event_type, COALESCE(ge.team_idx, -1), ge.seq DESC
  ) regs;

  SELECT count(*) FILTER (WHERE team_idx = 0),
         count(*) FILTER (WHERE team_idx = 1)
    INTO v_score0, v_score1
  FROM game_events
  WHERE game_id = p_game_id AND deleted_at IS NULL AND event_type = 'goal';

  v_started := COALESCE((v_state ->> 'trackingStarted')::boolean, false)
            OR v_has_meta
            OR (v_reg -> 'tracking_started:-') IS NOT NULL
            OR EXISTS (
                 SELECT 1 FROM game_events ge
                 JOIN event_type_registry reg ON reg.event_type = ge.event_type
                 WHERE ge.game_id = p_game_id AND ge.deleted_at IS NULL
                   AND reg.kind = 'stat'
               );

  v_team0 := summary_team_slot(v_state -> 'teams' -> 0,
                               v_reg -> 'team_profile_set:0', v_reg -> 'roster_set:0');
  v_team1 := summary_team_slot(v_state -> 'teams' -> 1,
                               v_reg -> 'team_profile_set:1', v_reg -> 'roster_set:1');
  v_teams := CASE
    WHEN v_team0 IS NULL AND v_team1 IS NULL THEN v_state -> 'teams'
    ELSE jsonb_build_array(v_team0, v_team1)
  END;

  v_goalies := CASE
    WHEN (v_reg -> 'goalie_set:0') IS NULL AND (v_reg -> 'goalie_set:1') IS NULL
      THEN v_state -> 'activeGoalies'
    ELSE jsonb_build_array(
      COALESCE(v_reg -> 'goalie_set:0' -> 'player', v_state -> 'activeGoalies' -> 0),
      COALESCE(v_reg -> 'goalie_set:1' -> 'player', v_state -> 'activeGoalies' -> 1)
    )
  END;

  UPDATE games SET
    summary = jsonb_build_object(
      'score0',            v_score0,
      'score1',            v_score1,
      'currentQuarter',    v_q,
      'completedQuarters', v_completed,
      'gameOver',          v_over,
      'trackingStarted',   v_started,
      'teams',             v_teams,
      'activeGoalies',     v_goalies,
      'goalieDecisions',   COALESCE(v_reg -> 'goalie_decisions_set:-' -> 'decisions',
                                    v_state -> 'goalieDecisions'),
      'gameDate',          COALESCE(v_reg -> 'logistics_set:-' -> 'gameDate',
                                    v_state -> 'gameDate'),
      'refereeNames',      COALESCE(v_reg -> 'logistics_set:-' -> 'refereeNames',
                                    v_state -> 'refereeNames'),
      'weatherConditions', COALESCE(v_reg -> 'logistics_set:-' -> 'weatherConditions',
                                    v_state -> 'weatherConditions'),
      'fieldLocation',     COALESCE(v_reg -> 'logistics_set:-' -> 'fieldLocation',
                                    v_state -> 'fieldLocation')
    ),
    summary_updated_at = now(),
    name = COALESCE(
      NULLIF(concat_ws(' vs ', v_team0 ->> 'name', v_team1 ->> 'name'), ''),
      name
    )
  WHERE id = p_game_id;
END;
$$;

-- Re-project: only games with quarter_override events can change.
DO $$
DECLARE
  g record;
BEGIN
  FOR g IN
    SELECT DISTINCT game_id AS id FROM game_events
    WHERE event_type = 'quarter_override' AND deleted_at IS NULL
  LOOP
    BEGIN
      PERFORM project_game(g.id);
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO projector_failures (game_id, error) VALUES (g.id, SQLERRM);
    END;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
