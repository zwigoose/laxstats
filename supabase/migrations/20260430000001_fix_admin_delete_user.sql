-- Fix admin_delete_user FK violations when deleting a user.
-- v2 schema FKs (game_events.created_by/deleted_by, game_scorekeepers, org_members)
-- have no ON DELETE clause so they default to RESTRICT, blocking the auth.users delete.
-- Clear or remove all dependent rows before deleting the user.

CREATE OR REPLACE FUNCTION admin_delete_user(target_id uuid)
RETURNS void
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;

  -- Null out authorship columns on game_events (events belong to the game, not the user)
  UPDATE game_events SET created_by = NULL WHERE created_by = target_id;
  UPDATE game_events SET deleted_by = NULL WHERE deleted_by = target_id;

  -- Remove scorekeeper invite rows — invited_by is NOT NULL so rows must be deleted;
  -- also remove any claimed rows for this user
  DELETE FROM game_scorekeepers WHERE invited_by = target_id OR user_id = target_id;

  -- Remove org memberships
  DELETE FROM org_members WHERE user_id = target_id;

  -- Now safe to delete — v1 FKs (games, saved_teams, profiles, roster_shares)
  -- all have ON DELETE CASCADE so they clean up automatically
  DELETE FROM auth.users WHERE id = target_id;
END;
$$;
