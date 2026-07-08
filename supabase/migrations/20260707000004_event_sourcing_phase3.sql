-- ═══════════════════════════════════════════════════════════════════════════
-- Event-sourcing refactor, Phase 3: state & meta events join the stream
--
-- game_events becomes the single unified stream:
--   • quarter transitions (quarter_end / game_over / quarter_override) are
--     appended as meta-kind events with {fromQuarter, toQuarter} payloads;
--     existing game_meta_events rows are copied in with deterministic ids,
--     and a forwarding trigger keeps copying rows written by pre-Phase-3
--     clients until the table is dropped in Phase 5.
--   • roster/team/goalie/logistics/tracking state becomes LWW register
--     events (full-snapshot payloads; latest by seq wins).
--
-- project_game v2 derives the quarter machine and registers from the stream,
-- composing every register over legacy games.state so games that predate
-- state events keep rendering forever.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Registry: state and meta kinds ─────────────────────────────────────────

INSERT INTO event_type_registry (event_type, kind, requires_team) VALUES
  ('team_profile_set',     'state', true),
  ('roster_set',           'state', true),
  ('goalie_set',           'state', true),
  ('goalie_decisions_set', 'state', false),
  ('logistics_set',        'state', false),
  ('tracking_started',     'state', false),
  ('quarter_end',          'meta',  false),
  ('game_over',            'meta',  false),
  ('quarter_override',     'meta',  false)
ON CONFLICT (event_type) DO NOTHING;

-- State/meta events carry their content in payload — require it.
CREATE OR REPLACE FUNCTION game_events_validate()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  reg event_type_registry%ROWTYPE;
BEGIN
  SELECT * INTO reg FROM event_type_registry WHERE event_type = NEW.event_type;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown event_type: %', NEW.event_type;
  END IF;
  IF reg.requires_team AND NEW.team_idx IS NULL THEN
    RAISE EXCEPTION 'event_type % requires team_idx', NEW.event_type;
  END IF;
  IF reg.kind = 'stat' AND NEW.quarter IS NULL THEN
    RAISE EXCEPTION 'stat event_type % requires quarter', NEW.event_type;
  END IF;
  IF reg.kind IN ('state', 'meta') AND NEW.payload IS NULL THEN
    RAISE EXCEPTION '% event_type % requires payload', reg.kind, NEW.event_type;
  END IF;
  RETURN NEW;
END;
$$;

-- ── 2. Copy game_meta_events into the stream ──────────────────────────────────
-- Deterministic ids make the copy idempotent and let the forwarding trigger
-- re-run safely.

CREATE OR REPLACE FUNCTION copy_meta_event_to_stream(m game_meta_events)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO game_events
    (id, game_id, group_id, event_type, payload, event_version, created_by, client_created_at)
  VALUES (
    md5('meta:'    || m.id)::uuid,
    m.game_id,
    md5('metagrp:' || m.id)::uuid,
    m.event_type,
    jsonb_build_object('fromQuarter', m.from_quarter, 'toQuarter', m.to_quarter),
    1,
    m.created_by,
    m.client_created_at
  )
  ON CONFLICT (id) DO NOTHING;
$$;

-- Forward rows written by pre-Phase-3 clients into the stream. The stream
-- insert fires the game_events projection trigger itself, so this replaces
-- the Phase 1 projection trigger on game_meta_events.
CREATE OR REPLACE FUNCTION trg_forward_meta_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m game_meta_events%ROWTYPE;
BEGIN
  FOR m IN SELECT * FROM new_rows ORDER BY seq LOOP
    PERFORM copy_meta_event_to_stream(m);
  END LOOP;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_game_meta_events_project_ins ON game_meta_events;
CREATE TRIGGER trg_game_meta_events_forward
  AFTER INSERT ON game_meta_events
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION trg_forward_meta_events();

-- Backfill: copy all existing meta rows, per-game seq order preserved.
DO $$
DECLARE
  m game_meta_events%ROWTYPE;
BEGIN
  FOR m IN SELECT * FROM game_meta_events ORDER BY game_id, seq LOOP
    PERFORM copy_meta_event_to_stream(m);
  END LOOP;
END;
$$;

-- ── 3. project_game v2: stream meta + LWW registers over games.state ─────────

-- One summary team slot: the legacy state team overlaid with register values,
-- so unknown state fields (e.g. orgTeamId) survive the merge.
CREATE OR REPLACE FUNCTION summary_team_slot(base jsonb, profile jsonb, roster jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  overlay jsonb := '{}'::jsonb;
BEGIN
  IF profile IS NOT NULL THEN
    overlay := jsonb_build_object(
      'name',    profile -> 'name',
      'color',   profile -> 'color',
      'logoUrl', profile -> 'logoUrl'
    );
  END IF;
  IF roster IS NOT NULL THEN
    overlay := overlay || jsonb_build_object('roster', roster -> 'rosterText');
  END IF;
  IF base IS NULL AND overlay = '{}'::jsonb THEN RETURN NULL; END IF;
  RETURN COALESCE(base, '{}'::jsonb) || overlay;
END;
$$;

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
  v_reg        jsonb;  -- latest live register payloads keyed by "type:teamIdx"
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
    RETURN;  -- v1 games render from games.state forever
  END IF;

  -- Quarter machine over stream meta events (mirrors deriveQuarterState,
  -- quirks included — see fixtures/eventStreams/quarter-anomalies.json).
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
    END IF;
  END LOOP;

  -- LWW registers: latest live payload per (type, team)
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
    -- Register-driven team names keep games.name fresh (replaces the dead
    -- updateGameTeams helper's name maintenance).
    name = COALESCE(
      NULLIF(concat_ws(' vs ', v_team0 ->> 'name', v_team1 ->> 'name'), ''),
      name
    )
  WHERE id = p_game_id;
END;
$$;

-- ── 4. Re-project everything with v2 ─────────────────────────────────────────

DO $$
DECLARE
  g record;
BEGIN
  FOR g IN SELECT id FROM games WHERE schema_ver >= 2 LOOP
    BEGIN
      PERFORM project_game(g.id);
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO projector_failures (game_id, error) VALUES (g.id, SQLERRM);
    END;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
