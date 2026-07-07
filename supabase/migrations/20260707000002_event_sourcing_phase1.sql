-- ═══════════════════════════════════════════════════════════════════════════
-- Event-sourcing refactor, Phase 1: server-derived summary cache
--
-- games.summary becomes a server-maintained projection of the event stream
-- (game_events + game_meta_events), composed over legacy games.state for
-- fields that aren't event-sourced yet (teams, logistics, goalies). Clients
-- keep writing games.state for now — a trigger re-projects on every state
-- write, so summary can never be staler than state. Display read paths
-- switch to `summary ?? state` client-side.
--
-- Also lays schema groundwork for later phases: payload/event_version on
-- game_events, the event_type_registry, and relaxed NOT NULLs so future
-- game-scoped events (no team, no quarter) can share the stream.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. game_events: payload + versioning + relaxed constraints ───────────────

ALTER TABLE game_events
  ADD COLUMN IF NOT EXISTS payload       jsonb,
  ADD COLUMN IF NOT EXISTS event_version smallint NOT NULL DEFAULT 1;

-- Keep realtime payloads bounded (REPLICA IDENTITY FULL ships whole rows).
ALTER TABLE game_events
  ADD CONSTRAINT game_events_payload_size
    CHECK (payload IS NULL OR pg_column_size(payload) < 16384);

-- Game-scoped events (state/meta kinds, arriving in Phase 3) have neither a
-- team nor a quarter. The inline CHECK (team_idx IN (0,1)) passes NULL as-is.
ALTER TABLE game_events ALTER COLUMN quarter  DROP NOT NULL;
ALTER TABLE game_events ALTER COLUMN team_idx DROP NOT NULL;

-- ── 2. Event type registry ────────────────────────────────────────────────────
-- One place that says what an event_type is: how it's classified ('stat' rows
-- feed player/team stats; 'state' rows are LWW registers; 'meta' rows drive
-- the quarter machine) and what shape it requires.

CREATE TABLE event_type_registry (
  event_type      text     PRIMARY KEY,
  kind            text     NOT NULL CHECK (kind IN ('stat', 'state', 'meta')),
  current_version smallint NOT NULL DEFAULT 1,
  requires_team   boolean  NOT NULL DEFAULT false
);

ALTER TABLE event_type_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "etr_select_all" ON event_type_registry FOR SELECT USING (true);

-- Everything the client writes today (LaxStats mkEntry + doCommitEntries).
INSERT INTO event_type_registry (event_type, kind, requires_team) VALUES
  ('goal',          'stat', true),
  ('assist',        'stat', true),
  ('shot',          'stat', true),
  ('shot_saved',    'stat', true),
  ('goal_allowed',  'stat', true),
  ('ground_ball',   'stat', true),
  ('turnover',      'stat', true),
  ('forced_to',     'stat', true),
  ('faceoff_win',   'stat', true),
  ('faceoff_loss',  'stat', true),
  ('clear',         'stat', true),
  ('failed_clear',  'stat', true),
  ('timeout',       'stat', true),
  ('penalty_min',   'stat', true),
  ('penalty_tech',  'stat', true),
  ('goalie_change', 'stat', true);

-- Safety net: event_type has always been free text, so register any
-- historical type still present in live rows (e.g. v1-migrated 'penalty')
-- rather than rejecting inserts that reference shapes we forgot.
INSERT INTO event_type_registry (event_type, kind, requires_team)
SELECT DISTINCT event_type, 'stat', true
FROM game_events
ON CONFLICT (event_type) DO NOTHING;

-- ── 3. Insert validation ──────────────────────────────────────────────────────
-- Named 00_ so it runs before trg_game_events_dup_check (BEFORE INSERT
-- triggers fire in name order).

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
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_game_events_00_validate
  BEFORE INSERT ON game_events
  FOR EACH ROW EXECUTE FUNCTION game_events_validate();

-- ── 4. Duplicate detection: stat events only ──────────────────────────────────
-- The 5-second cross-user heuristic protects against two humans logging the
-- same real-world action. State/meta events are LWW registers — "duplicates"
-- are normal there. Same body as before with an early return added.

CREATE OR REPLACE FUNCTION game_events_dup_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM event_type_registry
    WHERE event_type = NEW.event_type AND kind <> 'stat'
  ) THEN
    RETURN NEW;
  END IF;

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

-- ── 5. games.summary + failure log ────────────────────────────────────────────

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS summary            jsonb,
  ADD COLUMN IF NOT EXISTS summary_updated_at timestamptz;

CREATE TABLE projector_failures (
  id         bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  game_id    uuid        NOT NULL,
  error      text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- No policies: only SECURITY DEFINER functions and the service role touch it.
ALTER TABLE projector_failures ENABLE ROW LEVEL SECURITY;

-- ── 6. The projector ──────────────────────────────────────────────────────────
-- Full recompute per invocation, serialized per game with an advisory lock.
-- Order-insensitive for counters; the quarter machine mirrors
-- deriveQuarterState() in src/services/gameEvents.js exactly (including its
-- quirks — see src/test/fixtures/eventStreams/quarter-anomalies.json).
-- Fields not yet event-sourced pass through from games.state.

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
  r            record;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_game_id::text, 0));

  SELECT state, schema_ver INTO v_state, v_schema_ver
  FROM games WHERE id = p_game_id;
  IF NOT FOUND OR v_schema_ver < 2 THEN
    -- v1 games live entirely in games.state; summary stays NULL and clients
    -- fall back to state forever.
    RETURN;
  END IF;

  -- Quarter machine: replay meta events when any exist; otherwise fall back
  -- to the client-written state (pre-first-quarter_end games have no rows).
  v_q    := COALESCE((v_state ->> 'currentQuarter')::int, 1);
  v_over := COALESCE((v_state ->> 'gameOver')::boolean, false);
  FOR r IN
    SELECT event_type, from_quarter, to_quarter
    FROM game_meta_events
    WHERE game_id = p_game_id
    ORDER BY seq
  LOOP
    IF NOT v_has_meta THEN
      v_has_meta := true;
      v_q        := 1;
      v_over     := false;
    END IF;
    IF r.event_type = 'quarter_end' THEN
      v_completed := v_completed || to_jsonb(r.from_quarter);
      v_q         := r.to_quarter;
    ELSIF r.event_type = 'game_over' THEN
      v_completed := v_completed || to_jsonb(r.from_quarter);
      v_over      := true;
      v_q         := r.from_quarter;
    ELSIF r.event_type = 'quarter_override' THEN
      v_q := r.to_quarter;
    END IF;
  END LOOP;

  SELECT count(*) FILTER (WHERE team_idx = 0),
         count(*) FILTER (WHERE team_idx = 1)
    INTO v_score0, v_score1
  FROM game_events
  WHERE game_id = p_game_id AND deleted_at IS NULL AND event_type = 'goal';

  -- A game with committed events or quarter transitions has started even if
  -- the client's debounced state write never landed.
  v_started := COALESCE((v_state ->> 'trackingStarted')::boolean, false)
            OR v_has_meta
            OR EXISTS (
                 SELECT 1 FROM game_events
                 WHERE game_id = p_game_id AND deleted_at IS NULL
               );

  UPDATE games SET
    summary = jsonb_build_object(
      'score0',            v_score0,
      'score1',            v_score1,
      'currentQuarter',    v_q,
      'completedQuarters', v_completed,
      'gameOver',          v_over,
      'trackingStarted',   v_started,
      -- Not event-sourced until Phase 3: pass through the client-written state.
      'teams',             v_state -> 'teams',
      'activeGoalies',     v_state -> 'activeGoalies',
      'goalieDecisions',   v_state -> 'goalieDecisions',
      'gameDate',          v_state -> 'gameDate',
      'refereeNames',      v_state -> 'refereeNames',
      'weatherConditions', v_state -> 'weatherConditions',
      'fieldLocation',     v_state -> 'fieldLocation'
    ),
    summary_updated_at = now()
  WHERE id = p_game_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION project_game(uuid) FROM PUBLIC;

-- ── 7. Projection triggers ────────────────────────────────────────────────────
-- Statement-level with transition tables on the event streams; a projector
-- failure is logged, never allowed to abort the scorer's write.

CREATE OR REPLACE FUNCTION trg_project_game_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g record;
BEGIN
  FOR g IN SELECT DISTINCT game_id FROM new_rows LOOP
    BEGIN
      PERFORM project_game(g.game_id);
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO projector_failures (game_id, error) VALUES (g.game_id, SQLERRM);
    END;
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_game_events_project_ins
  AFTER INSERT ON game_events
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION trg_project_game_events();

-- UPDATE covers soft-deletes and duplicate-flag changes.
CREATE TRIGGER trg_game_events_project_upd
  AFTER UPDATE ON game_events
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION trg_project_game_events();

CREATE TRIGGER trg_game_meta_events_project_ins
  AFTER INSERT ON game_meta_events
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION trg_project_game_events();

-- Transition-period trigger: legacy clients still write games.state, so
-- re-project after every state write to keep summary at least as fresh.
-- project_game itself only sets summary/summary_updated_at, which does not
-- match UPDATE OF state — no recursion.
CREATE OR REPLACE FUNCTION trg_project_game_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    PERFORM project_game(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO projector_failures (game_id, error) VALUES (NEW.id, SQLERRM);
  END;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_games_state_project
  AFTER UPDATE OF state ON games
  FOR EACH ROW EXECUTE FUNCTION trg_project_game_state();

-- Project at creation too, so every v2 game has a summary from birth
-- (otherwise a game has no summary until its first event or state write).
CREATE TRIGGER trg_games_insert_project
  AFTER INSERT ON games
  FOR EACH ROW EXECUTE FUNCTION trg_project_game_state();

-- ── 8. Manual repair / staleness RPC ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION refresh_game_summary(p_game_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (can_view_game(p_game_id) OR can_score_game(p_game_id)) THEN
    RAISE EXCEPTION 'not authorized to refresh this game';
  END IF;
  PERFORM project_game(p_game_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION refresh_game_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION refresh_game_summary(uuid) TO authenticated;

-- ── 9. Backfill ───────────────────────────────────────────────────────────────

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

-- ── 10. Reload PostgREST schema cache ─────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
