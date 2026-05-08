-- Cross-org games (away_org_id IS NOT NULL) implicitly allow one scorer per org.
-- 1. create_scorekeeper_invite: bypass multi_scorer_enabled check for cross-org games;
--    also allow away org members to generate invite links.
-- 2. can_score_game: add away org membership check (mirrors 20260504000003).

CREATE OR REPLACE FUNCTION create_scorekeeper_invite(
  p_game_id uuid,
  p_label   text DEFAULT NULL
)
RETURNS text
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_token      text;
  v_game       games%ROWTYPE;
  v_cross_org  boolean;
BEGIN
  SELECT * INTO v_game FROM games WHERE id = p_game_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'game not found';
  END IF;

  v_cross_org := v_game.away_org_id IS NOT NULL;

  -- Cross-org games always allow invites; single-org games require multi_scorer_enabled.
  IF NOT v_cross_org AND NOT v_game.multi_scorer_enabled THEN
    RAISE EXCEPTION 'multi-scorer is not enabled for this game';
  END IF;

  -- Caller must be game owner, home org member, away org member (cross-org), or platform admin
  IF NOT (
    is_platform_admin()
    OR v_game.user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.org_id = v_game.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('org_admin','coach','scorekeeper')
    )
    OR (v_cross_org AND EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.org_id = v_game.away_org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('org_admin','coach','scorekeeper')
    ))
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

-- Ensure can_score_game includes away org membership (idempotent re-apply of 20260504000003).
CREATE OR REPLACE FUNCTION can_score_game(p_game_id uuid)
RETURNS boolean
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN (
    is_platform_admin()
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
    -- Claimed invite token
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
