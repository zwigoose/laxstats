-- =============================================================================
-- Fix missing is_platform_admin() guards on admin read RPCs.
--
-- admin_get_users, admin_get_orgs, admin_get_all_rosters, and
-- admin_get_org_members were SECURITY DEFINER SQL functions that joined
-- auth.users but omitted the is_platform_admin() check present on every
-- destructive admin function. Any authenticated user could invoke them via
-- supabase.rpc() and enumerate all user emails, org data, and org membership.
--
-- get_roster_shares() had its auth check silently removed when
-- 20260426000002_admin_rpcs.sql replaced the baseline definition with a
-- version that had no caller restriction.
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
    SELECT u.id, u.email, COALESCE(p.is_admin, false) AS is_admin, u.created_at
    FROM auth.users u
    LEFT JOIN profiles p ON p.id = u.id
    ORDER BY u.created_at DESC;
END;
$$;

-- ── admin_get_orgs ────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS admin_get_orgs();

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
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
    SELECT
      o.id, o.name, o.slug, o.plan, o.plan_status, o.created_at,
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
           u.email AS owner_name
    FROM saved_teams st
    LEFT JOIN auth.users u ON u.id = st.user_id
    ORDER BY u.email, st.name;
END;
$$;

-- ── admin_get_org_members ─────────────────────────────────────────────────────
-- Drop all known signatures (arity changed across migrations).
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
    SELECT om.user_id, u.email, om.role, om.created_at AS joined_at
    FROM org_members om
    JOIN auth.users u ON u.id = om.user_id
    WHERE om.org_id = p_org_id
    ORDER BY om.created_at;
END;
$$;

-- ── get_roster_shares ─────────────────────────────────────────────────────────
-- Restore the caller check that was dropped by 20260426000002_admin_rpcs.sql.
-- Roster owner or platform admin may see who a roster is shared with.
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
    SELECT rs.id AS share_id, rs.shared_with_user_id,
      u.email AS display_name
    FROM roster_shares rs
    JOIN auth.users u ON u.id = rs.shared_with_user_id
    WHERE rs.roster_id = p_roster_id
    ORDER BY u.email;
END;
$$;
