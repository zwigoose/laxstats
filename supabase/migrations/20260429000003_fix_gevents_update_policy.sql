-- Tighten game_events UPDATE policy.
-- Previously a user could soft-delete their own events via created_by = auth.uid()
-- even after their invite expired or their org membership was revoked.
-- Now UPDATE requires current game access (same conditions as INSERT) in addition
-- to being the event creator. Org admins and platform admins are unrestricted.

DROP POLICY IF EXISTS "gevents_update_creator_or_admin" ON game_events;

CREATE POLICY "gevents_update_creator_or_admin"
  ON game_events FOR UPDATE
  USING (
    is_platform_admin()
    -- Org admin of this game's org (can correct any event)
    OR EXISTS (
      SELECT 1 FROM games g
      JOIN org_members om ON om.org_id = g.org_id
      WHERE g.id = game_id
        AND om.user_id = auth.uid()
        AND om.role = 'org_admin'
    )
    -- Event creator who still has active access to the game
    OR (
      created_by = auth.uid()
      AND (
        -- Personal game owner
        EXISTS (SELECT 1 FROM games g WHERE g.id = game_id AND g.user_id = auth.uid())
        -- Org member with scoring role
        OR EXISTS (
          SELECT 1 FROM games g
          JOIN org_members om ON om.org_id = g.org_id
          WHERE g.id = game_id
            AND om.user_id = auth.uid()
            AND om.role IN ('org_admin','coach','scorekeeper')
        )
        -- Claimed invite that has not yet expired
        OR EXISTS (
          SELECT 1 FROM game_scorekeepers gs
          WHERE gs.game_id = game_id
            AND gs.user_id = auth.uid()
            AND gs.expires_at > now()
        )
      )
    )
  );
