-- =============================================================================
-- Admin org-management RPCs
-- =============================================================================

-- ── admin_get_orgs ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_orgs()
RETURNS TABLE (
  id           uuid,
  name         text,
  slug         text,
  plan         text,
  plan_status  text,
  created_at   timestamptz,
  member_count bigint,
  game_count   bigint,
  season_count bigint,
  team_count   bigint
)
SECURITY DEFINER SET search_path = public
LANGUAGE sql AS $$
  SELECT
    o.id,
    o.name,
    o.slug,
    o.plan,
    o.plan_status,
    o.created_at,
    COUNT(DISTINCT om.id)  AS member_count,
    COUNT(DISTINCT g.id)   AS game_count,
    COUNT(DISTINCT s.id)   AS season_count,
    COUNT(DISTINCT t.id)   AS team_count
  FROM organizations o
  LEFT JOIN org_members om ON om.org_id = o.id
  LEFT JOIN games g         ON g.org_id  = o.id
  LEFT JOIN seasons s       ON s.org_id  = o.id
  LEFT JOIN teams t         ON t.org_id  = o.id
  GROUP BY o.id
  ORDER BY o.created_at DESC;
$$;

-- ── admin_get_org_members ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_org_members(p_org_id uuid)
RETURNS TABLE (
  user_id    uuid,
  email      text,
  role       text,
  joined_at  timestamptz
)
SECURITY DEFINER SET search_path = public
LANGUAGE sql AS $$
  SELECT om.user_id, u.email, om.role, om.created_at AS joined_at
  FROM org_members om
  JOIN auth.users u ON u.id = om.user_id
  WHERE om.org_id = p_org_id
  ORDER BY om.created_at;
$$;

-- ── admin_set_org_plan ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_set_org_plan(
  p_org_id      uuid,
  p_plan        text,
  p_plan_status text DEFAULT 'active'
)
RETURNS void
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE organizations
    SET plan = p_plan, plan_status = p_plan_status
    WHERE id = p_org_id;
END;
$$;

-- ── admin_set_org_member_role ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_set_org_member_role(
  p_org_id  uuid,
  p_user_id uuid,
  p_role    text
)
RETURNS void
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE org_members SET role = p_role
    WHERE org_id = p_org_id AND user_id = p_user_id;
END;
$$;

-- ── admin_add_org_member ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_add_org_member(
  p_org_id  uuid,
  p_user_id uuid,
  p_role    text DEFAULT 'viewer'
)
RETURNS void
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  INSERT INTO org_members (org_id, user_id, role)
    VALUES (p_org_id, p_user_id, p_role)
    ON CONFLICT (org_id, user_id) DO UPDATE SET role = p_role;
END;
$$;

-- ── admin_remove_org_member ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_remove_org_member(p_org_id uuid, p_user_id uuid)
RETURNS void
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  DELETE FROM org_members WHERE org_id = p_org_id AND user_id = p_user_id;
END;
$$;

-- ── admin_get_org_features ────────────────────────────────────────────────────
-- Returns all plan_features with the current org's effective limits and any override.
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
$$;

-- ── admin_set_feature_override ────────────────────────────────────────────────
-- Pass p_override_limit = NULL to remove the override.
CREATE OR REPLACE FUNCTION admin_set_feature_override(
  p_org_id         uuid,
  p_feature_id     text,
  p_override_limit int    DEFAULT NULL,
  p_expires_at     timestamptz DEFAULT NULL
)
RETURNS void
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF p_override_limit IS NULL THEN
    DELETE FROM org_feature_overrides
      WHERE org_id = p_org_id AND feature_id = p_feature_id;
  ELSE
    INSERT INTO org_feature_overrides (org_id, feature_id, override_limit, expires_at)
      VALUES (p_org_id, p_feature_id, p_override_limit, p_expires_at)
      ON CONFLICT (org_id, feature_id)
      DO UPDATE SET override_limit = p_override_limit, expires_at = p_expires_at;
  END IF;
END;
$$;

-- ── admin_delete_org ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_delete_org(p_org_id uuid)
RETURNS void
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  DELETE FROM organizations WHERE id = p_org_id;
END;
$$;
