-- =============================================================================
-- Entitlement Phase 2 — Enforcement RPCs
-- Creates server-side enforced create RPCs for seasons, teams, and games.
-- Updates invite_org_member to enforce org_members limit and one-org constraint.
-- Adds org_feature_enabled() and org_entitlement_summary() helpers for the UI.
-- =============================================================================

-- ── Helper: org_feature_enabled ───────────────────────────────────────────────
-- Returns true if the feature is enabled (limit is null=unlimited or >= 1).
-- Returns false only when limit = 0.
CREATE OR REPLACE FUNCTION org_feature_enabled(p_org_id uuid, p_feature_id text)
RETURNS boolean STABLE SECURITY DEFINER SET search_path = public
LANGUAGE sql AS $$
  SELECT COALESCE(org_feature_limit(p_org_id, p_feature_id), 1) <> 0;
$$;

-- ── Helper: org_entitlement_summary ───────────────────────────────────────────
-- Returns current usage vs. plan limit for each numeric feature.
-- Boolean features (pressbox, multi_scorekeeper, season_stats) are excluded.
CREATE OR REPLACE FUNCTION org_entitlement_summary(p_org_id uuid)
RETURNS TABLE (
  feature_id    text,
  description   text,
  plan_limit    int,    -- null = unlimited, 0 = disabled
  current_usage bigint,
  at_limit      boolean
)
STABLE SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT (is_platform_admin() OR EXISTS (
    SELECT 1 FROM org_members WHERE org_id = p_org_id AND user_id = auth.uid()
  )) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    f.feature_id,
    f.description,
    f.plan_limit,
    CASE f.feature_id
      WHEN 'org_active_seasons'  THEN (SELECT COUNT(*) FROM seasons     WHERE org_id = p_org_id AND status = 'active')
      WHEN 'org_active_teams'    THEN (SELECT COUNT(*) FROM teams       WHERE org_id = p_org_id AND status = 'active')
      WHEN 'org_members'         THEN (SELECT COUNT(*) FROM org_members WHERE org_id = p_org_id)
      ELSE 0::bigint
    END AS current_usage,
    CASE
      WHEN f.plan_limit IS NULL THEN false
      ELSE (CASE f.feature_id
        WHEN 'org_active_seasons' THEN (SELECT COUNT(*) FROM seasons     WHERE org_id = p_org_id AND status = 'active')
        WHEN 'org_active_teams'   THEN (SELECT COUNT(*) FROM teams       WHERE org_id = p_org_id AND status = 'active')
        WHEN 'org_members'        THEN (SELECT COUNT(*) FROM org_members WHERE org_id = p_org_id)
        ELSE 0::bigint
      END) >= f.plan_limit
    END AS at_limit
  FROM (
    SELECT
      pf.id AS feature_id,
      pf.description,
      org_feature_limit(p_org_id, pf.id) AS plan_limit
    FROM plan_features pf
    WHERE pf.id IN ('org_active_seasons','org_active_teams','org_members','org_games_per_season')
  ) f
  ORDER BY f.feature_id;
END;
$$;

-- ── create_org_season ─────────────────────────────────────────────────────────
-- Inserts a season after checking org_active_seasons entitlement.
-- Callers: OrgDashboard.jsx, CreateGame.jsx (inline season creation)
CREATE OR REPLACE FUNCTION create_org_season(
  p_org_id     uuid,
  p_name       text,
  p_start_date date DEFAULT NULL,
  p_end_date   date DEFAULT NULL
)
RETURNS uuid SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_limit   int;
  v_current bigint;
  v_id      uuid;
BEGIN
  IF NOT (is_platform_admin() OR get_org_role(p_org_id) IN ('org_admin','coach')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  v_limit := org_feature_limit(p_org_id, 'org_active_seasons');
  IF v_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current FROM seasons WHERE org_id = p_org_id AND status = 'active';
    IF v_current >= v_limit THEN
      RAISE EXCEPTION 'plan_limit_exceeded:org_active_seasons:%:%', v_current, v_limit;
    END IF;
  END IF;

  INSERT INTO seasons (org_id, name, start_date, end_date)
    VALUES (p_org_id, p_name, p_start_date, p_end_date)
    RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ── create_org_team ───────────────────────────────────────────────────────────
-- Inserts a team after checking org_active_teams entitlement.
-- Callers: TeamManager.jsx, OrgCard.jsx (admin)
CREATE OR REPLACE FUNCTION create_org_team(
  p_org_id uuid,
  p_name   text,
  p_color  text DEFAULT '#1a6bab'
)
RETURNS uuid SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_limit   int;
  v_current bigint;
  v_id      uuid;
BEGIN
  IF NOT (is_platform_admin() OR get_org_role(p_org_id) IN ('org_admin','coach')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  v_limit := org_feature_limit(p_org_id, 'org_active_teams');
  IF v_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current FROM teams WHERE org_id = p_org_id AND status = 'active';
    IF v_current >= v_limit THEN
      RAISE EXCEPTION 'plan_limit_exceeded:org_active_teams:%:%', v_current, v_limit;
    END IF;
  END IF;

  INSERT INTO teams (org_id, name, color)
    VALUES (p_org_id, p_name, p_color)
    RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ── create_org_game ───────────────────────────────────────────────────────────
-- Inserts an org game after checking org_games_per_season entitlement.
-- p_season_id may be null (unattached game); limit only enforced when non-null.
-- Callers: CreateGame.jsx
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
  v_limit   int;
  v_current bigint;
  v_id      uuid;
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

  INSERT INTO games (name, state, user_id, org_id, away_org_id, season_id, game_type, game_date, schema_ver)
    VALUES (p_name, NULL, auth.uid(), p_org_id, p_away_org_id, p_season_id, p_game_type, p_game_date, 2)
    RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ── invite_org_member (updated) ───────────────────────────────────────────────
-- Adds: org_members entitlement check + friendly one-org-per-user error.
CREATE OR REPLACE FUNCTION invite_org_member(p_org_id uuid, p_username text, p_role text)
RETURNS void SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_email     text;
  v_user_id   uuid;
  v_limit     int;
  v_current   bigint;
  v_other_org text;
BEGIN
  IF NOT (is_platform_admin() OR get_org_role(p_org_id) = 'org_admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF p_role NOT IN ('org_admin','coach','scorekeeper','viewer') THEN
    RAISE EXCEPTION 'invalid role: %', p_role;
  END IF;

  v_email := CASE WHEN p_username LIKE '%@%' THEN p_username ELSE p_username || '@laxstats.app' END;
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(v_email) LIMIT 1;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'user not found'; END IF;

  -- One-org-per-user: reject if already in a different org
  SELECT o.name INTO v_other_org
    FROM org_members om JOIN organizations o ON o.id = om.org_id
    WHERE om.user_id = v_user_id AND om.org_id <> p_org_id
    LIMIT 1;
  IF v_other_org IS NOT NULL THEN
    RAISE EXCEPTION 'user_already_in_org:%', v_other_org;
  END IF;

  -- Org members entitlement check (skip if already a member — role update, not new seat)
  IF NOT EXISTS (SELECT 1 FROM org_members WHERE org_id = p_org_id AND user_id = v_user_id) THEN
    v_limit := org_feature_limit(p_org_id, 'org_members');
    IF v_limit IS NOT NULL THEN
      SELECT COUNT(*) INTO v_current FROM org_members WHERE org_id = p_org_id;
      IF v_current >= v_limit THEN
        RAISE EXCEPTION 'plan_limit_exceeded:org_members:%:%', v_current, v_limit;
      END IF;
    END IF;
  END IF;

  INSERT INTO org_members (org_id, user_id, role)
    VALUES (p_org_id, v_user_id, p_role)
    ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role;
END;
$$;
