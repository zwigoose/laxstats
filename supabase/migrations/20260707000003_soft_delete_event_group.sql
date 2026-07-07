-- Event-sourcing refactor, Phase 2: soft-delete via RPC.
--
-- The client previously soft-deleted groups with a direct UPDATE, which is
-- gated by the creator-or-org-admin UPDATE policy — so a secondary scorer
-- silently updated 0 rows when deleting the primary scorer's entries. Route
-- the operation through a SECURITY DEFINER function gated by can_score_game
-- instead: anyone allowed to score the game may soft-delete its groups, and
-- the delete is attributed via deleted_by.

CREATE OR REPLACE FUNCTION soft_delete_event_group(p_game_id uuid, p_group_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT can_score_game(p_game_id) THEN
    RAISE EXCEPTION 'not authorized to modify this game';
  END IF;
  UPDATE game_events
     SET deleted_at = now(),
         deleted_by = auth.uid()
   WHERE game_id  = p_game_id
     AND group_id = p_group_id
     AND deleted_at IS NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION soft_delete_event_group(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION soft_delete_event_group(uuid, uuid) TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
