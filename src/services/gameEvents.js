import { supabase as _supabase } from "../lib/supabase";

export async function fetchGameEvents(gameId, db = _supabase) {
  return db
    .from("game_events")
    .select("*")
    .eq("game_id", gameId)
    .is("deleted_at", null)
    .order("seq");
}

/**
 * Idempotent append: rows carry client-generated ids, so a retried flush
 * (offline sync, reconnect race) is a no-op — duplicates are silently
 * skipped and only newly inserted rows come back.
 */
export async function appendGameEvents(rows, db = _supabase) {
  return db
    .from("game_events")
    .upsert(rows, { onConflict: "id", ignoreDuplicates: true })
    .select();
}

/**
 * Soft-delete via RPC gated by can_score_game — a direct UPDATE would be
 * limited by the creator-or-org-admin policy, so a secondary scorer could
 * not delete the primary scorer's entries.
 */
export async function softDeleteEventGroup(gameId, groupId, db = _supabase) {
  return db.rpc("soft_delete_event_group", { p_game_id: gameId, p_group_id: groupId });
}

export async function dismissDuplicateFlag(gameId, groupId, db = _supabase) {
  return db.rpc("dismiss_duplicate_flag", { p_game_id: gameId, p_group_id: groupId });
}

// Rewrite a player's {num, name} snapshot on all of a game's live events —
// used by the finalization wizard's roster-correction step.
export async function updateGameEventsPlayer(gameId, teamIdx, fromNum, toNum, toName, db = _supabase) {
  return db
    .from("game_events")
    .update({ player_num: toNum, player_name: toName })
    .eq("game_id", gameId)
    .eq("team_idx", teamIdx)
    .eq("player_num", fromNum)
    .is("deleted_at", null);
}
