-- =============================================================================
-- Entitlement Phase 5 — Admin panel support
-- 1. admin_get_users includes personal_plan / personal_plan_status
-- 2. admin_set_personal_plan RPC
-- 3. admin_add_org_member handles one-org-per-user (removes from prior org)
-- =============================================================================

-- ── 1. admin_get_users — add personal plan fields ────────────────────────────
DROP FUNCTION IF EXISTS admin_get_users() CASCADE;

CREATE OR REPLACE FUNCTION admin_get_users()
RETURNS TABLE (
  id                   uuid,
  email                text,
  is_admin             boolean,
  personal_plan        text,
  personal_plan_status text,
  created_at           timestamptz
)
SECURITY DEFINER SET search_path = public
LANGUAGE sql AS $$
  SELECT
    u.id,
    u.email,
    COALESCE(p.is_admin, false)              AS is_admin,
    COALESCE(p.personal_plan, 'free')        AS personal_plan,
    COALESCE(p.personal_plan_status, 'active') AS personal_plan_status,
    u.created_at
  FROM auth.users u
  LEFT JOIN profiles p ON p.id = u.id
  ORDER BY u.created_at DESC;
$$;

-- ── 2. admin_set_personal_plan ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_set_personal_plan(
  p_target_id          uuid,
  p_personal_plan      text,
  p_personal_plan_status text DEFAULT 'active'
)
RETURNS void SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF p_personal_plan NOT IN ('free','basic','plus') THEN
    RAISE EXCEPTION 'invalid personal plan: %', p_personal_plan;
  END IF;
  IF p_personal_plan_status NOT IN ('active','trialing','past_due','canceled') THEN
    RAISE EXCEPTION 'invalid plan status: %', p_personal_plan_status;
  END IF;
  UPDATE profiles
    SET personal_plan = p_personal_plan, personal_plan_status = p_personal_plan_status
    WHERE id = p_target_id;
END;
$$;

-- ── 3. admin_add_org_member — handle one-org-per-user ────────────────────────
-- Admins explicitly moving a user to a new org removes them from their current
-- org first (the UNIQUE(user_id) constraint requires this).
CREATE OR REPLACE FUNCTION admin_add_org_member(
  p_org_id  uuid,
  p_user_id uuid,
  p_role    text DEFAULT 'viewer'
)
RETURNS void SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;

  -- Remove from any other org first (one-org invariant)
  DELETE FROM org_members
    WHERE user_id = p_user_id AND org_id <> p_org_id;

  INSERT INTO org_members (org_id, user_id, role)
    VALUES (p_org_id, p_user_id, p_role)
    ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role;
END;
$$;
