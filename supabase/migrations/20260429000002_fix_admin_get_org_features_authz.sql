-- Fix missing is_platform_admin() guard on admin_get_org_features.
-- The original was a SQL-language function with no auth check — same pattern
-- as the admin_get_users / admin_get_orgs gap fixed in 20260428000000.
-- Any authenticated user could call it directly to read plan limits and
-- feature overrides for any org.

CREATE OR REPLACE FUNCTION admin_get_org_features(p_org_id uuid)
RETURNS TABLE (
  feature_id       text,
  description      text,
  plan_limit       int,
  override_limit   int,
  override_expires timestamptz
)
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;

  RETURN QUERY
  SELECT
    pf.id AS feature_id,
    pf.description,
    CASE o.plan
      WHEN 'free'       THEN pf.free_limit
      WHEN 'starter'    THEN pf.starter_limit
      WHEN 'pro'        THEN pf.pro_limit
      WHEN 'enterprise' THEN pf.enterprise_limit
    END AS plan_limit,
    ov.override_limit,
    ov.expires_at AS override_expires
  FROM plan_features pf
  CROSS JOIN organizations o
  LEFT JOIN org_feature_overrides ov
    ON ov.org_id = o.id AND ov.feature_id = pf.id
  WHERE o.id = p_org_id
  ORDER BY pf.id;
END;
$$;
