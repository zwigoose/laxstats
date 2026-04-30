-- =============================================================================
-- Fix "structure of query does not match function result type" errors.
--
-- Converting from LANGUAGE sql to LANGUAGE plpgsql with RETURN QUERY
-- requires the SELECT column types to exactly match the RETURNS TABLE
-- declaration. auth.users.email is character varying(255), not text, causing
-- strict type mismatches in plpgsql. Adding explicit ::text casts fixes this.
-- =============================================================================

-- ── admin_get_users ───────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS admin_get_users();

CREATE OR REPLACE FUNCTION admin_get_users()
RETURNS TABLE (
  id         uuid,
  email      text,
  is_admin   boolean,
  created_at timestamptz
)
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
    SELECT u.id, u.email::text, COALESCE(p.is_admin, false), u.created_at
    FROM auth.users u
    LEFT JOIN profiles p ON p.id = u.id
    ORDER BY u.created_at DESC;
END;
$$;

-- ── admin_get_all_rosters ─────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS admin_get_all_rosters();

CREATE OR REPLACE FUNCTION admin_get_all_rosters()
RETURNS TABLE (
  id         uuid,
  user_id    uuid,
  name       text,
  roster     text,
  color      text,
  created_at timestamptz,
  owner_name text
)
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
    SELECT st.id, st.user_id, st.name, st.roster, st.color, st.created_at,
           u.email::text AS owner_name
    FROM saved_teams st
    LEFT JOIN auth.users u ON u.id = st.user_id
    ORDER BY u.email, st.name;
END;
$$;

-- ── admin_get_org_members ─────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS admin_get_org_members(uuid);

CREATE OR REPLACE FUNCTION admin_get_org_members(p_org_id uuid)
RETURNS TABLE (
  user_id    uuid,
  email      text,
  role       text,
  joined_at  timestamptz
)
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
    SELECT om.user_id, u.email::text, om.role, om.created_at
    FROM org_members om
    JOIN auth.users u ON u.id = om.user_id
    WHERE om.org_id = p_org_id
    ORDER BY om.created_at;
END;
$$;

-- ── get_roster_shares ─────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_roster_shares(uuid);

CREATE OR REPLACE FUNCTION get_roster_shares(p_roster_id uuid)
RETURNS TABLE (
  share_id            uuid,
  shared_with_user_id uuid,
  display_name        text
)
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT (
    is_platform_admin()
    OR EXISTS (SELECT 1 FROM saved_teams WHERE id = p_roster_id AND user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY
    SELECT rs.id, rs.shared_with_user_id, u.email::text AS display_name
    FROM roster_shares rs
    JOIN auth.users u ON u.id = rs.shared_with_user_id
    WHERE rs.roster_id = p_roster_id
    ORDER BY u.email;
END;
$$;
