-- Personal game limits: per-user cap combining personal_plan tier + org membership benefit.

-- ── 1. personal_plan_limits table ────────────────────────────────────────────
CREATE TABLE personal_plan_limits (
  plan        text PRIMARY KEY CHECK (plan IN ('free', 'basic', 'plus')),
  game_limit  int  -- NULL = unlimited, 0 = disabled
);
INSERT INTO personal_plan_limits VALUES ('free', 3), ('basic', 10), ('plus', 20);
GRANT SELECT ON personal_plan_limits TO authenticated, anon;

-- ── 2. personal_game_limit() — effective cap for the calling user ──────────
-- Combines personal plan limit with org membership benefit (takes higher of the two).
-- Returns NULL for platform admins (unlimited).
CREATE OR REPLACE FUNCTION personal_game_limit()
RETURNS int STABLE SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_personal int;
  v_org      int;
  v_has_org  boolean;
BEGIN
  IF (SELECT COALESCE(is_admin, false) FROM profiles WHERE id = auth.uid()) THEN
    RETURN NULL;
  END IF;

  -- Personal plan limit
  SELECT ppl.game_limit INTO v_personal
  FROM personal_plan_limits ppl
  JOIN profiles p ON p.personal_plan = ppl.plan
  WHERE p.id = auth.uid();

  -- Org membership benefit (NULL if no org)
  SELECT EXISTS (SELECT 1 FROM org_members WHERE user_id = auth.uid()) INTO v_has_org;

  IF v_has_org THEN
    SELECT
      CASE o.plan
        WHEN 'free' THEN pf.free_limit
        WHEN 'pro'  THEN pf.pro_limit
        WHEN 'max'  THEN pf.max_limit
        WHEN 'giga' THEN pf.giga_limit
      END INTO v_org
    FROM org_members om
    JOIN organizations o ON o.id = om.org_id
    JOIN plan_features pf ON pf.id = 'org_member_personal_games'
    WHERE om.user_id = auth.uid();

    -- If either is NULL (unlimited), result is unlimited
    IF v_personal IS NULL OR v_org IS NULL THEN
      RETURN NULL;
    END IF;
    RETURN GREATEST(v_personal, v_org);
  END IF;

  RETURN v_personal;
END;
$$;

-- ── 3. personal_game_usage() — current count + limit for the calling user ──
CREATE OR REPLACE FUNCTION personal_game_usage()
RETURNS TABLE (current_count int, game_limit int, at_limit boolean)
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_limit int;
  v_count int;
BEGIN
  v_limit := personal_game_limit();
  SELECT COUNT(*)::int INTO v_count FROM games WHERE user_id = auth.uid() AND org_id IS NULL;
  RETURN QUERY SELECT v_count, v_limit, (v_limit IS NOT NULL AND v_count >= v_limit);
END;
$$;

-- ── 4. create_personal_game(p_name) — enforced insert ──────────────────────
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
  VALUES (p_name, auth.uid(), 2)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ── 5. Admin RPCs for personal plan limits ────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_personal_plan_limits()
RETURNS TABLE (plan text, game_limit int)
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY SELECT ppl.plan, ppl.game_limit FROM personal_plan_limits ppl ORDER BY ppl.plan;
END;
$$;

CREATE OR REPLACE FUNCTION admin_set_personal_plan_limit(p_plan text, p_game_limit int)
RETURNS void SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF p_plan NOT IN ('free', 'basic', 'plus') THEN
    RAISE EXCEPTION 'invalid personal plan: %', p_plan;
  END IF;
  UPDATE personal_plan_limits SET game_limit = p_game_limit WHERE plan = p_plan;
END;
$$;
