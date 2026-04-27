-- Activate guest/invited scorekeeper functionality.
-- 1. Grant execute on invite RPCs so authenticated users can call them.
-- 2. Extend game_events INSERT policy to allow users who claimed an invite token.
-- 3. Extend game_scorekeepers SELECT/INSERT to also cover personal-game owners.

-- ── 1. GRANT RPCs ─────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION create_scorekeeper_invite(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION claim_scorekeeper_invite(text)         TO authenticated;

-- ── 2. game_events INSERT — add claimed-invite branch ─────────────────────────
DROP POLICY IF EXISTS "gevents_insert_scorekeeper" ON game_events;

CREATE POLICY "gevents_insert_scorekeeper"
  ON game_events FOR INSERT
  WITH CHECK (
    is_platform_admin()
    -- Personal game owner
    OR EXISTS (SELECT 1 FROM games g WHERE g.id = game_id AND g.user_id = auth.uid())
    -- Org member with scoring role
    OR EXISTS (
      SELECT 1 FROM games g
      JOIN org_members om ON om.org_id = g.org_id
      WHERE g.id = game_id
        AND om.user_id = auth.uid()
        AND om.role IN ('org_admin','coach','scorekeeper')
    )
    -- Token-only guest (session-level setting, future use)
    OR EXISTS (
      SELECT 1 FROM game_scorekeepers gs
      WHERE gs.game_id = game_id
        AND gs.invite_token = current_setting('app.guest_token', true)
        AND gs.expires_at > now()
    )
    -- Authenticated user who claimed an invite token
    OR EXISTS (
      SELECT 1 FROM game_scorekeepers gs
      WHERE gs.game_id = game_id
        AND gs.user_id = auth.uid()
        AND gs.expires_at > now()
    )
  );

-- ── 3. game_scorekeepers — also allow personal game owner ─────────────────────
DROP POLICY IF EXISTS "gsk_select_coach_or_self" ON game_scorekeepers;

CREATE POLICY "gsk_select_coach_or_self"
  ON game_scorekeepers FOR SELECT
  USING (
    is_platform_admin()
    OR user_id = auth.uid()
    -- Personal game owner
    OR EXISTS (SELECT 1 FROM games g WHERE g.id = game_id AND g.user_id = auth.uid())
    -- Org coach+
    OR EXISTS (
      SELECT 1 FROM games g
      JOIN org_members om ON om.org_id = g.org_id
      WHERE g.id = game_id
        AND om.user_id = auth.uid()
        AND om.role IN ('org_admin','coach')
    )
  );
