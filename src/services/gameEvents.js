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

export async function softDeleteGameEvents(gameId, groupId, userId, db = _supabase) {
  return db
    .from("game_events")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("game_id", gameId)
    .eq("group_id", groupId)
    .is("deleted_at", null);
}

/**
 * Soft-delete via RPC gated by can_score_game — unlike the direct UPDATE
 * above, this lets a secondary scorer delete the primary scorer's entries.
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

// ── game_meta_events ──────────────────────────────────────────────────────────

export async function fetchMetaEvents(gameId, db = _supabase) {
  return db
    .from("game_meta_events")
    .select("*")
    .eq("game_id", gameId)
    .order("seq");
}

export async function insertMetaEvent(row, db = _supabase) {
  return db.from("game_meta_events").insert(row).select().single();
}

/**
 * Pure function: replay game_meta_events rows to derive quarter state.
 * Returns { currentQuarter, completedQuarters, gameOver }.
 */
export function deriveQuarterState(metaRows) {
  if (!metaRows?.length) return null;

  let currentQuarter    = 1;
  let completedQuarters = [];
  let gameOver          = false;

  for (const row of metaRows) {
    if (row.event_type === "quarter_end") {
      completedQuarters = [...completedQuarters, row.from_quarter];
      currentQuarter    = row.to_quarter;
    } else if (row.event_type === "game_over") {
      completedQuarters = [...completedQuarters, row.from_quarter];
      gameOver          = true;
      currentQuarter    = row.from_quarter;
    } else if (row.event_type === "quarter_override") {
      currentQuarter = row.to_quarter;
    }
  }

  return { currentQuarter, completedQuarters, gameOver };
}
