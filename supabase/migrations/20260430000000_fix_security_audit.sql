-- Fix four vulnerabilities identified in issue #14.
-- =============================================================================

-- ── 1. Unauthorized Plan Elevation ───────────────────────────────────────────
-- org_update_admin allowed any org_admin to UPDATE all columns including plan.
-- Revoke column-level UPDATE privilege on plan from authenticated; admin_set_org_plan
-- (SECURITY DEFINER) remains the only valid path for plan changes.

REVOKE UPDATE (plan) ON organizations FROM authenticated;


-- ── 2. Unauthorized Game Association ─────────────────────────────────────────
-- games_insert_authenticated only checked auth.uid() IS NOT NULL, letting any
-- authenticated user inject games into any org by supplying an arbitrary org_id.
-- Tighten to require org membership with a scoring-capable role when org_id is set.

DROP POLICY IF EXISTS "games_insert_authenticated" ON games;

CREATE POLICY "games_insert_authenticated"
  ON games FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      -- Personal game — no org association required
      org_id IS NULL
      OR is_platform_admin()
      -- Must be an org member with a role that can create games
      OR EXISTS (
        SELECT 1 FROM org_members om
        WHERE om.org_id = org_id
          AND om.user_id = auth.uid()
          AND om.role IN ('org_admin', 'coach', 'scorekeeper')
      )
    )
  );


-- ── 3. Global User Enumeration via find_user_by_username ─────────────────────
-- The function had no caller check — any authenticated user could probe usernames.
-- Restrict to platform admins and org admins (the only legitimate callers).

CREATE OR REPLACE FUNCTION find_user_by_username(p_username text)
RETURNS TABLE (id uuid, display_name text)
STABLE SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT (
    is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM org_members
      WHERE user_id = auth.uid() AND role = 'org_admin'
    )
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    COALESCE(
      CASE WHEN u.email LIKE '%@laxstats.app'
           THEN split_part(u.email, '@', 1)
           ELSE u.email::text
      END,
      u.id::text
    )::text AS display_name
  FROM auth.users u
  WHERE lower(u.email) = lower(
          CASE WHEN p_username LIKE '%@%'
               THEN p_username
               ELSE p_username || '@laxstats.app'
          END
        )
     OR (
          p_username NOT LIKE '%@%'
          AND lower(split_part(u.email, '@', 1)) = lower(p_username)
          AND lower(u.email) <> lower(p_username || '@laxstats.app')
        )
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION find_user_by_username(text) TO authenticated;


-- ── 4. PII Leakage in get_org_members ────────────────────────────────────────
-- The function returned full real emails (e.g. john@gmail.com) to any org member
-- regardless of role. For non-platform-admin callers, mask to the local part only
-- (consistent with how @laxstats.app usernames are already displayed).
-- Must DROP first — return column was renamed to member_user_id in a prior migration
-- and CREATE OR REPLACE cannot change the return type.

DROP FUNCTION IF EXISTS get_org_members(uuid);

CREATE FUNCTION get_org_members(p_org_id uuid)
RETURNS TABLE (member_id uuid, member_user_id uuid, role text, display_name text, joined_at timestamptz)
STABLE SECURITY DEFINER SET search_path = public
LANGUAGE sql AS $$
  SELECT
    om.id          AS member_id,
    om.user_id     AS member_user_id,
    om.role,
    COALESCE(
      CASE
        -- Platform admins see full emails; everyone else gets the local part only
        WHEN is_platform_admin() THEN
          CASE WHEN u.email LIKE '%@laxstats.app'
               THEN split_part(u.email, '@', 1)
               ELSE u.email
          END
        ELSE
          split_part(u.email, '@', 1)
      END,
      om.user_id::text
    )              AS display_name,
    om.created_at  AS joined_at
  FROM org_members om
  JOIN auth.users u ON u.id = om.user_id
  WHERE om.org_id = p_org_id
    AND (
      is_platform_admin()
      OR EXISTS (
        SELECT 1 FROM org_members _m
        WHERE _m.org_id = p_org_id AND _m.user_id = auth.uid()
      )
    )
  ORDER BY om.created_at;
$$;

GRANT EXECUTE ON FUNCTION get_org_members(uuid) TO authenticated;
