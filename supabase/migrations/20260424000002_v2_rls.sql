-- =============================================================================
-- LaxStats v2 — Phase 1: RLS Policies for new tables
-- Existing games table policies are left untouched.
-- =============================================================================

ALTER TABLE organizations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members           ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons               ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE players               ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_season_roster    ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_features         ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_feature_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_scorekeepers     ENABLE ROW LEVEL SECURITY;

-- ── organizations ─────────────────────────────────────────────────────────────
CREATE POLICY "org_select_public"
  ON organizations FOR SELECT USING (true);

CREATE POLICY "org_insert_authenticated"
  ON organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "org_update_admin"
  ON organizations FOR UPDATE
  USING (
    is_platform_admin()
    OR get_org_role(id) = 'org_admin'
  );

CREATE POLICY "org_delete_platform_admin"
  ON organizations FOR DELETE
  USING (is_platform_admin());

-- ── org_members ───────────────────────────────────────────────────────────────
-- Only org members can see membership rows for their org
CREATE POLICY "orgmem_select_members"
  ON org_members FOR SELECT
  USING (
    is_platform_admin()
    OR org_id IN (
      SELECT om.org_id FROM org_members om WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "orgmem_insert_admin"
  ON org_members FOR INSERT
  WITH CHECK (
    is_platform_admin()
    OR get_org_role(org_id) = 'org_admin'
  );

CREATE POLICY "orgmem_update_admin"
  ON org_members FOR UPDATE
  USING (
    is_platform_admin()
    OR get_org_role(org_id) = 'org_admin'
  );

-- Org admin can remove members; users can leave their own org
CREATE POLICY "orgmem_delete_admin_or_self"
  ON org_members FOR DELETE
  USING (
    is_platform_admin()
    OR get_org_role(org_id) = 'org_admin'
    OR user_id = auth.uid()
  );

-- ── seasons ───────────────────────────────────────────────────────────────────
CREATE POLICY "seasons_select_public"
  ON seasons FOR SELECT USING (true);

CREATE POLICY "seasons_insert_org_admin"
  ON seasons FOR INSERT
  WITH CHECK (
    is_platform_admin()
    OR get_org_role(org_id) = 'org_admin'
  );

CREATE POLICY "seasons_update_org_admin"
  ON seasons FOR UPDATE
  USING (
    is_platform_admin()
    OR get_org_role(org_id) = 'org_admin'
  );

CREATE POLICY "seasons_delete_org_admin"
  ON seasons FOR DELETE
  USING (
    is_platform_admin()
    OR get_org_role(org_id) = 'org_admin'
  );

-- ── teams ─────────────────────────────────────────────────────────────────────
CREATE POLICY "teams_select_public"
  ON teams FOR SELECT USING (true);

CREATE POLICY "teams_insert_coach"
  ON teams FOR INSERT
  WITH CHECK (
    is_platform_admin()
    OR get_org_role(org_id) IN ('org_admin','coach')
  );

CREATE POLICY "teams_update_coach"
  ON teams FOR UPDATE
  USING (
    is_platform_admin()
    OR get_org_role(org_id) IN ('org_admin','coach')
  );

CREATE POLICY "teams_delete_coach"
  ON teams FOR DELETE
  USING (
    is_platform_admin()
    OR get_org_role(org_id) IN ('org_admin','coach')
  );

-- ── players ───────────────────────────────────────────────────────────────────
CREATE POLICY "players_select_public"
  ON players FOR SELECT USING (true);

CREATE POLICY "players_insert_coach"
  ON players FOR INSERT
  WITH CHECK (
    is_platform_admin()
    OR get_org_role(org_id) IN ('org_admin','coach')
  );

CREATE POLICY "players_update_coach"
  ON players FOR UPDATE
  USING (
    is_platform_admin()
    OR get_org_role(org_id) IN ('org_admin','coach')
  );

CREATE POLICY "players_delete_coach"
  ON players FOR DELETE
  USING (
    is_platform_admin()
    OR get_org_role(org_id) IN ('org_admin','coach')
  );

-- ── team_season_roster ────────────────────────────────────────────────────────
CREATE POLICY "roster_select_public"
  ON team_season_roster FOR SELECT USING (true);

CREATE POLICY "roster_insert_coach"
  ON team_season_roster FOR INSERT
  WITH CHECK (
    is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_id
        AND get_org_role(t.org_id) IN ('org_admin','coach')
    )
  );

CREATE POLICY "roster_update_coach"
  ON team_season_roster FOR UPDATE
  USING (
    is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_id
        AND get_org_role(t.org_id) IN ('org_admin','coach')
    )
  );

CREATE POLICY "roster_delete_coach"
  ON team_season_roster FOR DELETE
  USING (
    is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_id
        AND get_org_role(t.org_id) IN ('org_admin','coach')
    )
  );

-- ── plan_features ─────────────────────────────────────────────────────────────
CREATE POLICY "plan_features_select_public"
  ON plan_features FOR SELECT USING (true);

CREATE POLICY "plan_features_write_platform_admin"
  ON plan_features FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- ── org_feature_overrides ─────────────────────────────────────────────────────
CREATE POLICY "overrides_select_org_admin"
  ON org_feature_overrides FOR SELECT
  USING (
    is_platform_admin()
    OR get_org_role(org_id) = 'org_admin'
  );

CREATE POLICY "overrides_write_platform_admin"
  ON org_feature_overrides FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- ── game_events ───────────────────────────────────────────────────────────────
-- All events are publicly readable (powers Live View and Press Box)
CREATE POLICY "gevents_select_public"
  ON game_events FOR SELECT USING (true);

-- Insert: org member (scorekeeper+), game owner, or valid guest token
CREATE POLICY "gevents_insert_scorekeeper"
  ON game_events FOR INSERT
  WITH CHECK (
    is_platform_admin()
    -- Game owner (personal games, org games where owner is also a scorer)
    OR EXISTS (
      SELECT 1 FROM games g WHERE g.id = game_id AND g.user_id = auth.uid()
    )
    -- Org member with scorekeeper role or above
    OR EXISTS (
      SELECT 1 FROM games g
      JOIN org_members om ON om.org_id = g.org_id
      WHERE g.id = game_id
        AND om.user_id = auth.uid()
        AND om.role IN ('org_admin','coach','scorekeeper')
    )
    -- Valid guest scorekeeper invite token
    OR EXISTS (
      SELECT 1 FROM game_scorekeepers gs
      WHERE gs.game_id = game_id
        AND gs.invite_token = current_setting('app.guest_token', true)
        AND gs.expires_at > now()
    )
  );

-- Update (soft deletes, duplicate dismissal): event creator or org admin
CREATE POLICY "gevents_update_creator_or_admin"
  ON game_events FOR UPDATE
  USING (
    is_platform_admin()
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM games g
      JOIN org_members om ON om.org_id = g.org_id
      WHERE g.id = game_id
        AND om.user_id = auth.uid()
        AND om.role = 'org_admin'
    )
  );

-- ── game_scorekeepers ─────────────────────────────────────────────────────────
-- Coaches and above can manage invite links; invited users can see their own row
CREATE POLICY "gsk_select_coach_or_self"
  ON game_scorekeepers FOR SELECT
  USING (
    is_platform_admin()
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM games g
      JOIN org_members om ON om.org_id = g.org_id
      WHERE g.id = game_id
        AND om.user_id = auth.uid()
        AND om.role IN ('org_admin','coach')
    )
  );

CREATE POLICY "gsk_insert_coach"
  ON game_scorekeepers FOR INSERT
  WITH CHECK (
    is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM games g
      JOIN org_members om ON om.org_id = g.org_id
      WHERE g.id = game_id
        AND om.user_id = auth.uid()
        AND om.role IN ('org_admin','coach')
    )
  );

CREATE POLICY "gsk_delete_coach"
  ON game_scorekeepers FOR DELETE
  USING (
    is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM games g
      JOIN org_members om ON om.org_id = g.org_id
      WHERE g.id = game_id
        AND om.user_id = auth.uid()
        AND om.role IN ('org_admin','coach')
    )
  );
