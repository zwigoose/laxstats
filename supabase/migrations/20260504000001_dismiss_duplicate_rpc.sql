-- SECURITY DEFINER RPC so any scorer on a game can dismiss the duplicate flag
-- on any event in that game, bypassing the created_by RLS restriction.
CREATE OR REPLACE FUNCTION dismiss_duplicate_flag(p_game_id uuid, p_group_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT can_score_game(p_game_id) THEN
    RAISE EXCEPTION 'Not authorized to score game %', p_game_id;
  END IF;

  UPDATE game_events
  SET    is_possible_duplicate = false
  WHERE  game_id   = p_game_id
    AND  group_id  = p_group_id
    AND  deleted_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION dismiss_duplicate_flag(uuid, uuid) TO authenticated;
