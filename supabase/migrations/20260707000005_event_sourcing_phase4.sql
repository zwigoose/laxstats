-- ═══════════════════════════════════════════════════════════════════════════
-- Event-sourcing refactor, Phase 4: the state freeze
--
-- Clients no longer write games.state — setup changes exist only as LWW
-- register events on the stream, and games.summary (server-projected) is the
-- read cache. Games created from here on are schema_ver 3, marking "state
-- was never client-written after creation".
--
-- Belt-and-suspenders: a BEFORE UPDATE trigger silently ignores state writes
-- to ver-3 games from any straggler pre-Phase-4 client. (Registers already
-- beat state in the projector, so such writes were harmless — this just
-- keeps frozen state bytes truthful.)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. New games are schema_ver 3 ─────────────────────────────────────────────

ALTER TABLE games ALTER COLUMN schema_ver SET DEFAULT 3;

CREATE OR REPLACE FUNCTION create_personal_game(p_name text)
RETURNS uuid SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_limit   int;
  v_current int;
  v_id      uuid;
BEGIN
  v_limit := personal_game_limit();

  IF v_limit IS NOT NULL THEN
    SELECT COUNT(*)::int INTO v_current
    FROM games WHERE user_id = auth.uid() AND org_id IS NULL;

    IF v_current >= v_limit THEN
      RAISE EXCEPTION 'plan_limit_exceeded:personal_games:%:%', v_current, v_limit;
    END IF;
  END IF;

  INSERT INTO games (name, user_id, schema_ver)
  VALUES (p_name, auth.uid(), 3)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION create_org_game(
  p_org_id       uuid,
  p_name         text,
  p_season_id    uuid        DEFAULT NULL,
  p_away_org_id  uuid        DEFAULT NULL,
  p_game_type    text        DEFAULT 'regular',
  p_game_date    date        DEFAULT NULL
)
RETURNS uuid SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_limit           int;
  v_current         bigint;
  v_id              uuid;
  v_multi_scorer    boolean;
BEGIN
  IF NOT (is_platform_admin() OR get_org_role(p_org_id) IN ('org_admin','coach','scorekeeper')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_season_id IS NOT NULL THEN
    v_limit := org_feature_limit(p_org_id, 'org_games_per_season');
    IF v_limit IS NOT NULL THEN
      SELECT COUNT(*) INTO v_current
        FROM games
        WHERE season_id = p_season_id AND org_id = p_org_id;
      IF v_current >= v_limit THEN
        RAISE EXCEPTION 'plan_limit_exceeded:org_games_per_season:%:%', v_current, v_limit;
      END IF;
    END IF;
  END IF;

  -- Enable multi-scorer if the org's plan allows it (limit > 0 or unlimited).
  v_multi_scorer := COALESCE(org_feature_limit(p_org_id, 'multi_scorekeeper'), 1) > 0;

  INSERT INTO games (name, state, user_id, org_id, away_org_id, season_id, game_type, game_date, schema_ver, multi_scorer_enabled)
    VALUES (p_name, NULL, auth.uid(), p_org_id, p_away_org_id, p_season_id, p_game_type, p_game_date, 3, v_multi_scorer)
    RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION admin_create_game(p_user_id uuid, p_name text)
RETURNS uuid
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  INSERT INTO games (name, user_id, state, schema_ver)
    VALUES (p_name, p_user_id, NULL, 3)
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ── 2. Freeze state on ver-3 games ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION games_state_freeze()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.schema_ver >= 3 THEN
    NEW.state := OLD.state;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_games_00_state_freeze
  BEFORE UPDATE OF state ON games
  FOR EACH ROW EXECUTE FUNCTION games_state_freeze();

NOTIFY pgrst, 'reload schema';
