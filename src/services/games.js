import { supabase as _supabase } from "../lib/supabase";

export async function fetchGame(id, db = _supabase) {
  return db
    .from("games")
    .select("id, created_at, name, state, schema_ver, org_id, away_org_id, season_id, away_season_id, user_id, multi_scorer_enabled, shot_location_enabled")
    .eq("id", id)
    .single();
}

export async function fetchGameMeta(id, db = _supabase) {
  return db.from("games").select("state, name").eq("id", id).single();
}

export async function updateGame(id, payload, db = _supabase) {
  return db.from("games").update(payload).eq("id", id);
}

export async function deleteGame(id, db = _supabase) {
  return db.from("games").delete().eq("id", id);
}

export async function fetchOrgContext(orgId, seasonId, db = _supabase) {
  const [orgRes, seasonRes] = await Promise.all([
    db.from("organizations").select("name").eq("id", orgId).single(),
    seasonId
      ? db.from("seasons").select("name").eq("id", seasonId).single()
      : Promise.resolve({ data: null }),
  ]);
  return {
    orgId,
    orgName:    orgRes.data?.name ?? null,
    seasonName: seasonRes.data?.name ?? null,
  };
}

export async function canScoreGame(gameId, db = _supabase) {
  return db.rpc("can_score_game", { p_game_id: gameId });
}

export async function createScorekeeperInvite(gameId, db = _supabase) {
  return db.rpc("create_scorekeeper_invite", { p_game_id: gameId });
}

export async function claimScorekeeperInvite(token, db = _supabase) {
  return db.rpc("claim_scorekeeper_invite", { p_token: token });
}

export async function linkGameToAwaySeason(gameId, seasonId, db = _supabase) {
  return db.rpc("link_game_to_away_season", { p_game_id: gameId, p_season_id: seasonId });
}

export async function deleteAllGameEvents(gameId, userId, db = _supabase) {
  return db
    .from("game_events")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("game_id", gameId)
    .is("deleted_at", null);
}

/**
 * Write only the teams/roster fields of a game's state, independent of quarter
 * or score data. Used by the Setup tab so a mid-game roster edit cannot race
 * against event or quarter writes.
 */
export async function updateGameTeams(id, teams, db = _supabase) {
  const existing = await db.from("games").select("state, name").eq("id", id).single();
  if (existing.error) return existing;
  const merged = { ...(existing.data?.state ?? {}), teams };
  const payload = { state: merged };
  if (teams?.[0]?.name && teams?.[1]?.name) {
    payload.name = `${teams[0].name} vs ${teams[1].name}`;
  }
  return db.from("games").update(payload).eq("id", id);
}
