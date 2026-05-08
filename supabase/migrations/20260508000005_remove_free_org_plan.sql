-- Remove the 'free' org plan tier. Personal plans (free/basic/plus) are unaffected.

-- 1. Migrate any existing free orgs to pro.
UPDATE organizations SET plan = 'pro' WHERE plan = 'free';

-- 2. Update the CHECK constraint on organizations.plan.
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_plan_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_plan_check
  CHECK (plan IN ('pro', 'max', 'giga'));

-- 3. Update admin_set_plan_limit to disallow 'free'.
CREATE OR REPLACE FUNCTION admin_set_plan_limit(
  p_feature_id text,
  p_plan       text,
  p_limit      int
)
RETURNS void SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF p_plan NOT IN ('pro', 'max', 'giga') THEN
    RAISE EXCEPTION 'invalid plan: %', p_plan;
  END IF;
  EXECUTE format('UPDATE plan_features SET %I = $1 WHERE id = $2', p_plan || '_limit')
    USING p_limit, p_feature_id;
END;
$$;

-- 4. Update org_feature_limit: remove WHEN 'free' branch.
CREATE OR REPLACE FUNCTION org_feature_limit(p_org_id uuid, p_feature_id text)
RETURNS int STABLE SECURITY DEFINER SET search_path = public
LANGUAGE sql AS $$
  SELECT
    CASE WHEN (SELECT COALESCE(is_admin, false) FROM profiles WHERE id = auth.uid()) THEN
      NULL
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

-- 5. Update admin_get_org_features: remove WHEN 'free' branch.
CREATE OR REPLACE FUNCTION admin_get_org_features(p_org_id uuid)
RETURNS TABLE (
  feature_id       text,
  description      text,
  plan_limit       int,
  override_limit   int,
  override_expires timestamptz
)
SECURITY DEFINER SET search_path = public
LANGUAGE sql AS $$
  SELECT
    pf.id AS feature_id,
    pf.description,
    CASE o.plan
      WHEN 'pro'  THEN pf.pro_limit
      WHEN 'max'  THEN pf.max_limit
      WHEN 'giga' THEN pf.giga_limit
    END AS plan_limit,
    ov.override_limit,
    ov.expires_at AS override_expires
  FROM plan_features pf
  CROSS JOIN organizations o
  LEFT JOIN org_feature_overrides ov
    ON ov.org_id = o.id AND ov.feature_id = pf.id
  WHERE o.id = p_org_id
  ORDER BY pf.id;
$$;
