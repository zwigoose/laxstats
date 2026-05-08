-- Change personal_game_limit() from GREATEST to additive:
-- effective cap = personal_plan_limit + org_member_personal_games benefit.
-- Also set concrete org_member_personal_games limits (pro=10, max=20)
-- and grant public read on plan_features for the pricing page.

-- ── 1. Update org_member_personal_games limits ────────────────────────────────
UPDATE plan_features
SET pro_limit = 10, max_limit = 20
WHERE id = 'org_member_personal_games';

-- ── 2. Rewrite personal_game_limit() as additive ─────────────────────────────
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

  SELECT ppl.game_limit INTO v_personal
  FROM personal_plan_limits ppl
  JOIN profiles p ON p.personal_plan = ppl.plan
  WHERE p.id = auth.uid();

  SELECT EXISTS (SELECT 1 FROM org_members WHERE user_id = auth.uid()) INTO v_has_org;

  IF v_has_org THEN
    SELECT
      CASE o.plan
        WHEN 'pro'  THEN pf.pro_limit
        WHEN 'max'  THEN pf.max_limit
        WHEN 'giga' THEN pf.giga_limit
      END INTO v_org
    FROM org_members om
    JOIN organizations o ON o.id = om.org_id
    JOIN plan_features pf ON pf.id = 'org_member_personal_games'
    WHERE om.user_id = auth.uid()
    LIMIT 1;

    -- Either side NULL means unlimited
    IF v_personal IS NULL OR v_org IS NULL THEN RETURN NULL; END IF;
    RETURN v_personal + v_org;
  END IF;

  RETURN v_personal;
END;
$$;

-- ── 3. Public read on plan_features for pricing page ─────────────────────────
GRANT SELECT ON plan_features TO anon, authenticated;
