import { supabase as _supabase } from "../lib/supabase";

export async function fetchGameEvents(gameId, db = _supabase) {
  return db
    .from("game_events")
    .select("*")
    .eq("game_id", gameId)
    .is("deleted_at", null)
    .order("seq");
}

export async function insertGameEvents(rows, db = _supabase) {
  return db.from("game_events").insert(rows).select();
}

export async function softDeleteGameEvents(gameId, groupId, userId, db = _supabase) {
  return db
    .from("game_events")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("game_id", gameId)
    .eq("group_id", groupId)
    .is("deleted_at", null);
}
