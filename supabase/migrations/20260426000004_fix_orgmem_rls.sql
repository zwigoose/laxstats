-- =============================================================================
-- Fix org_members RLS
-- =============================================================================
-- Problem 1: orgmem_select_members queries org_members from within the
--   org_members SELECT policy → infinite recursion → orgMemberships always empty.
-- Problem 2: orgmem_insert_admin calls get_org_role() which returns NULL
--   for the org creator (not yet a member) → org creation fails for non-admins.
-- =============================================================================

-- SECURITY DEFINER function bypasses RLS when checking membership,
-- breaking the recursion loop.
CREATE OR REPLACE FUNCTION get_my_org_ids()
RETURNS TABLE (org_id uuid)
STABLE SECURITY DEFINER SET search_path = public
LANGUAGE sql AS $$
  SELECT org_id FROM org_members WHERE user_id = auth.uid();
$$;

-- Fix SELECT policy
DROP POLICY IF EXISTS "orgmem_select_members" ON org_members;
CREATE POLICY "orgmem_select_members"
  ON org_members FOR SELECT
  USING (
    is_platform_admin()
    OR org_id IN (SELECT om.org_id FROM get_my_org_ids() om)
  );

-- Fix INSERT policy: also allow the org creator to add themselves as org_admin
DROP POLICY IF EXISTS "orgmem_insert_admin" ON org_members;
CREATE POLICY "orgmem_insert_admin"
  ON org_members FOR INSERT
  WITH CHECK (
    is_platform_admin()
    OR get_org_role(org_id) = 'org_admin'
    -- Org creator bootstrapping their own membership
    OR (
      user_id = auth.uid()
      AND role = 'org_admin'
      AND EXISTS (
        SELECT 1 FROM organizations WHERE id = org_id AND created_by = auth.uid()
      )
    )
  );
