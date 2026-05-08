-- Revert create_scorekeeper_invite to require multi_scorer_enabled (Max org only).
-- Away org members can score directly via can_score_game() org membership check —
-- they do not need invite tokens and should not generate them.

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
