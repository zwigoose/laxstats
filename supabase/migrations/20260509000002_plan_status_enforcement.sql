-- Enforce plan_status in entitlement checks.
-- canceled org    → all feature limits return 0 (blocks new creates; existing data intact)
-- past_due org    → grace period; plan limits still apply
-- canceled personal plan → falls back to free tier limits

-- ── 1. org_feature_limit() ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION org_feature_limit(p_org_id uuid, p_feature_id text)
RETURNS int STABLE SECURITY DEFINER SET search_path = public
LANGUAGE sql AS $$
  SELECT
    CASE WHEN (SELECT COALESCE(is_admin, false) FROM profiles WHERE id = auth.uid()) THEN
      NULL
    WHEN (SELECT plan_status FROM organizations WHERE id = p_org_id) = 'canceled' THEN
      0
    ELSE
      COALESCE(
        (SELECT override_limit FROM org_feature_overrides
         WHERE org_id = p_org_id AND feature_id = p_feature_id
           AND (expires_at IS NULL OR expires_at > now())),
        (SELECT
           CASE o.plan
             WHEN 'pro'  THEN pf.pro_limit
             WHEN 'max'  THEN pf.max_limit
             WHEN 'giga' THEN pf.giga_limit
           END
         FROM organizations o
         JOIN plan_features pf ON pf.id = p_feature_id
         WHERE o.id = p_org_id)
      )
    END;
$$;

-- ── 2. personal_game_limit() ──────────────────────────────────────────────────
-- Canceled personal plan → use free tier limit instead of the subscribed plan.
CREATE OR REPLACE FUNCTION personal_game_limit()
RETURNS int STABLE SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_personal int;
  v_org      int;
  v_has_org  boolean;
  v_plan     text;
  v_status   text;
BEGIN
  IF (SELECT COALESCE(is_admin, false) FROM profiles WHERE id = auth.uid()) THEN
    RETURN NULL;
  END IF;

  SELECT personal_plan, personal_plan_status INTO v_plan, v_status
  FROM profiles WHERE id = auth.uid();

  -- Canceled subscription falls back to free tier
  IF v_status = 'canceled' THEN v_plan := 'free'; END IF;

  SELECT ppl.game_limit INTO v_personal
  FROM personal_plan_limits ppl
  WHERE ppl.plan = COALESCE(v_plan, 'free');

  IF v_personal IS NULL THEN RETURN NULL; END IF;

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

    -- Canceled org contributes 0 bonus (not unlimited)
    IF (SELECT plan_status FROM organizations o JOIN org_members om ON o.id = om.org_id WHERE om.user_id = auth.uid() LIMIT 1) = 'canceled' THEN
      v_org := 0;
    END IF;

    IF v_personal IS NULL OR v_org IS NULL THEN RETURN NULL; END IF;
    RETURN v_personal + v_org;
  END IF;

  RETURN v_personal;
END;
$$;
