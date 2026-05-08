-- Fix personal_game_limit() for giga org members.
-- Previously: if org bonus was NULL (giga = unlimited), returned NULL (unlimited) regardless of personal plan.
-- Now: only return NULL if the personal plan itself is unlimited. A NULL org bonus contributes 0.
-- Result: giga org member on Basic still sees their 10-game personal cap.

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

  -- Personal plan is unlimited — no cap needed.
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

    -- NULL org bonus (giga unlimited) contributes 0 to the additive cap.
    RETURN v_personal + COALESCE(v_org, 0);
  END IF;

  RETURN v_personal;
END;
$$;
