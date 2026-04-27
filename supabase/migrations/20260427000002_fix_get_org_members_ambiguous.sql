-- Fix ambiguous column reference in get_org_members.
-- The function RETURNS TABLE (... user_id uuid ...), so the bare "user_id"
-- in the EXISTS subquery is ambiguous between the output column and
-- org_members.user_id. Qualify with a table alias to resolve it.

CREATE OR REPLACE FUNCTION get_org_members(p_org_id uuid)
RETURNS TABLE (member_id uuid, user_id uuid, role text, display_name text, joined_at timestamptz)
STABLE SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT (
    is_platform_admin()
    OR EXISTS (SELECT 1 FROM org_members _om WHERE _om.org_id = p_org_id AND _om.user_id = auth.uid())
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
