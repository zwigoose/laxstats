-- Fix 1: can_score_game — single source of truth for scoring authorization.
-- Mirrors the gevents_insert_scorekeeper INSERT policy exactly so the frontend
-- can gate the UI with the same rules the DB enforces on writes.

CREATE OR REPLACE FUNCTION can_score_game(p_game_id uuid)
RETURNS boolean
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN (
    is_platform_admin()
    -- Personal game owner or org game owner
    OR EXISTS (SELECT 1 FROM games WHERE id = p_game_id AND user_id = auth.uid())
    -- Org member with scoring role
    OR EXISTS (
      SELECT 1 FROM games g
      JOIN org_members om ON om.org_id = g.org_id
      WHERE g.id = p_game_id
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

GRANT EXECUTE ON FUNCTION can_score_game(uuid) TO authenticated, anon;

-- Fix 2: create_scorekeeper_invite must respect multi_scorer_enabled.
-- Previously the RPC had no guard, so a game owner could generate invite tokens
-- even for games where multi-scorer was disabled (UI hid the button but RPC was callable directly).

CREATE OR REPLACE FUNCTION create_scorekeeper_invite(
  p_game_id uuid,
  p_label   text DEFAULT NULL
)
RETURNS text
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_token text;
  v_game  games%ROWTYPE;
BEGIN
  SELECT * INTO v_game FROM games WHERE id = p_game_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'game not found';
  END IF;

  IF NOT v_game.multi_scorer_enabled THEN
    RAISE EXCEPTION 'multi-scorer is not enabled for this game';
  END IF;

  -- Caller must be the game owner, an org scorekeeper+, or platform admin
  IF NOT (
    is_platform_admin()
    OR v_game.user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.org_id = v_game.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('org_admin','coach','scorekeeper')
    )
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  v_token := replace(gen_random_uuid()::text, '-', '')
          || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO game_scorekeepers (game_id, invited_by, label, invite_token, expires_at)
    VALUES (p_game_id, auth.uid(), p_label, v_token, now() + interval '24 hours');

  RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION create_scorekeeper_invite(uuid, text) TO authenticated;
