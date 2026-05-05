-- Allow scorekeepers from the away org to score cross-org games.
-- Updates both can_score_game() and the gevents_insert_scorekeeper RLS policy.

CREATE OR REPLACE FUNCTION can_score_game(p_game_id uuid)
RETURNS boolean
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN (
    is_platform_admin()
    -- Personal game owner or org game owner
    OR EXISTS (SELECT 1 FROM games WHERE id = p_game_id AND user_id = auth.uid())
    -- Home org member with scoring role
    OR EXISTS (
      SELECT 1 FROM games g
      JOIN org_members om ON om.org_id = g.org_id
      WHERE g.id = p_game_id
        AND om.user_id = auth.uid()
        AND om.role IN ('org_admin','coach','scorekeeper')
    )
    -- Away org member with scoring role (cross-org games)
    OR EXISTS (
      SELECT 1 FROM games g
      JOIN org_members om ON om.org_id = g.away_org_id
      WHERE g.id = p_game_id
        AND g.away_org_id IS NOT NULL
        AND om.user_id = auth.uid()
        AND om.role IN ('org_admin','coach','scorekeeper')
    )
    -- Authenticated user who claimed a still-valid invite token
    OR EXISTS (
      SELECT 1 FROM game_scorekeepers gs
      WHERE gs.game_id = p_game_id
        AND gs.user_id = auth.uid()
        AND gs.expires_at > now()
    )
  );
END;
$$;

DROP POLICY IF EXISTS "gevents_insert_scorekeeper" ON game_events;
CREATE POLICY "gevents_insert_scorekeeper"
  ON game_events FOR INSERT
  WITH CHECK (
    is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM games g WHERE g.id = game_id AND g.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM games g
      JOIN org_members om ON om.org_id = g.org_id
      WHERE g.id = game_id
        AND om.user_id = auth.uid()
        AND om.role IN ('org_admin','coach','scorekeeper')
    )
    OR EXISTS (
      SELECT 1 FROM games g
      JOIN org_members om ON om.org_id = g.away_org_id
      WHERE g.id = game_id
        AND g.away_org_id IS NOT NULL
        AND om.user_id = auth.uid()
        AND om.role IN ('org_admin','coach','scorekeeper')
    )
    OR EXISTS (
      SELECT 1 FROM game_scorekeepers gs
      WHERE gs.game_id = game_id
        AND gs.invite_token = current_setting('app.guest_token', true)
        AND gs.expires_at > now()
    )
  );
