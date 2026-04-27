-- Admin-only SECURITY DEFINER function to delete a game and all its child rows.
-- Bypasses RLS so child deletes (game_events, game_scorekeepers) succeed even
-- when no DELETE policy exists for those tables.
-- Checks is_platform_admin() before proceeding.

CREATE OR REPLACE FUNCTION admin_delete_game(p_game_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only platform admins may call this
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  DELETE FROM game_scorekeepers WHERE game_id = p_game_id;
  DELETE FROM game_events       WHERE game_id = p_game_id;
  DELETE FROM games              WHERE id      = p_game_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_delete_game(uuid) TO authenticated;
