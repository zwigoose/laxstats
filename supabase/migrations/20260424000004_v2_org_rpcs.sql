-- =============================================================================
-- LaxStats v2 — Phase 3: Org management RPCs
-- Needed by OrgDashboard for member listing, invite, and removal.
-- =============================================================================

-- List members of an org with display names (org members or platform admins only)
CREATE OR REPLACE FUNCTION get_org_members(p_org_id uuid)
RETURNS TABLE (member_id uuid, user_id uuid, role text, display_name text, joined_at timestamptz)
STABLE SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT (
    is_platform_admin()
    OR EXISTS (SELECT 1 FROM org_members WHERE org_id = p_org_id AND user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
    SELECT om.id, om.user_id, om.role,
      COALESCE(
        CASE WHEN u.email LIKE '%@laxstats.app' THEN split_part(u.email,'@',1) ELSE u.email END,
        om.user_id::text
      ) AS display_name,
      om.created_at
    FROM org_members om
    JOIN auth.users u ON u.id = om.user_id
    WHERE om.org_id = p_org_id
    ORDER BY om.created_at;
END;
$$;

-- Invite a user to an org by username (org_admin+)
CREATE OR REPLACE FUNCTION invite_org_member(p_org_id uuid, p_username text, p_role text)
RETURNS void SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_email   text;
  v_user_id uuid;
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

  INSERT INTO org_members (org_id, user_id, role)
    VALUES (p_org_id, v_user_id, p_role)
    ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role;
END;
$$;

-- Remove a member from an org (org_admin+, or self-leave)
CREATE OR REPLACE FUNCTION remove_org_member(p_org_id uuid, p_user_id uuid)
RETURNS void SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT (
    is_platform_admin()
    OR get_org_role(p_org_id) = 'org_admin'
    OR p_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  DELETE FROM org_members WHERE org_id = p_org_id AND user_id = p_user_id;
END;
$$;
