-- Rewrite get_org_members as a SQL function to eliminate the plpgsql
-- variable-scope conflict between the RETURNS TABLE output column "user_id"
-- and org_members.user_id in the query body.
-- Auth check is embedded in the WHERE clause (returns 0 rows if unauthorized).

CREATE OR REPLACE FUNCTION get_org_members(p_org_id uuid)
RETURNS TABLE (member_id uuid, user_id uuid, role text, display_name text, joined_at timestamptz)
STABLE SECURITY DEFINER SET search_path = public
LANGUAGE sql AS $$
  SELECT
    om.id        AS member_id,
    om.user_id,
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
      -- platform admin
      COALESCE((SELECT is_admin FROM profiles WHERE id = auth.uid()), false)
      -- or any member of this org
      OR EXISTS (
        SELECT 1 FROM org_members _m
        WHERE _m.org_id = p_org_id AND _m.user_id = auth.uid()
      )
    )
  ORDER BY om.created_at;
$$;
