-- Rename the "user_id" return column of get_org_members to "member_user_id"
-- to eliminate any possible column-name ambiguity that PostgREST may introduce
-- when building its wrapper query around the function result set.
-- The client code will be updated to match.

DROP FUNCTION IF EXISTS get_org_members(uuid);

CREATE FUNCTION get_org_members(p_org_id uuid)
RETURNS TABLE (member_id uuid, member_user_id uuid, role text, display_name text, joined_at timestamptz)
STABLE SECURITY DEFINER SET search_path = public
LANGUAGE sql AS $$
  SELECT
    om.id        AS member_id,
    om.user_id   AS member_user_id,
    om.role,
    COALESCE(
      CASE WHEN u.email LIKE '%@laxstats.app'
           THEN split_part(u.email, '@', 1)
           ELSE u.email
      END,
      om.user_id::text
    )            AS display_name,
    om.created_at AS joined_at
  FROM org_members om
  JOIN auth.users u ON u.id = om.user_id
  WHERE om.org_id = p_org_id
    AND (
      COALESCE((SELECT is_admin FROM profiles WHERE id = auth.uid()), false)
      OR EXISTS (
        SELECT 1 FROM org_members _m
        WHERE _m.org_id = p_org_id AND _m.user_id = auth.uid()
      )
    )
  ORDER BY om.created_at;
$$;

GRANT EXECUTE ON FUNCTION get_org_members(uuid) TO authenticated;
