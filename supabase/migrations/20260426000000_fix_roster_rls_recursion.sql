-- =============================================================================
-- Fix infinite RLS recursion between saved_teams and roster_shares
-- =============================================================================
-- saved_teams_select  → queries roster_shares (triggers roster_shares RLS)
-- roster_shares_select → queries saved_teams  (triggers saved_teams RLS)
-- → infinite loop
--
-- Fix: replace the direct saved_teams lookup in roster_shares policies with a
-- SECURITY DEFINER function, which bypasses RLS and breaks the cycle.
-- =============================================================================

CREATE OR REPLACE FUNCTION user_owns_saved_team(p_id uuid)
RETURNS boolean STABLE SECURITY DEFINER SET search_path = public
LANGUAGE sql AS $$
  SELECT EXISTS (SELECT 1 FROM saved_teams WHERE id = p_id AND user_id = auth.uid());
$$;

DROP POLICY IF EXISTS roster_shares_select ON roster_shares;
DROP POLICY IF EXISTS roster_shares_insert ON roster_shares;
DROP POLICY IF EXISTS roster_shares_delete ON roster_shares;

CREATE POLICY roster_shares_select ON roster_shares FOR SELECT USING (
  shared_with_user_id = auth.uid()
  OR user_owns_saved_team(roster_id)
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin)
);

CREATE POLICY roster_shares_insert ON roster_shares FOR INSERT WITH CHECK (
  user_owns_saved_team(roster_id)
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin)
);

CREATE POLICY roster_shares_delete ON roster_shares FOR DELETE USING (
  user_owns_saved_team(roster_id)
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin)
);
