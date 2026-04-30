import { supabase } from "../lib/supabase";

export async function fetchGame(id) {
  return supabase
    .from("games")
    .select("id, created_at, name, state, schema_ver, org_id, season_id, user_id, multi_scorer_enabled")
    .eq("id", id)
    .single();
}

export async function fetchGameMeta(id) {
  return supabase.from("games").select("state, name").eq("id", id).single();
}

export async function updateGame(id, payload) {
  return supabase.from("games").update(payload).eq("id", id);
}

export async function deleteGame(id) {
  return supabase.from("games").delete().eq("id", id);
}

export async function fetchOrgContext(orgId, seasonId) {
  const [orgRes, seasonRes] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", orgId).single(),
    seasonId
      ? supabase.from("seasons").select("name").eq("id", seasonId).single()
      : Promise.resolve({ data: null }),
  ]);
  return {
    orgId,
    orgName:    orgRes.data?.name ?? null,
    seasonName: seasonRes.data?.name ?? null,
  };
}

export async function createScorekeeperInvite(gameId) {
  return supabase.rpc("create_scorekeeper_invite", { p_game_id: gameId });
}

export async function claimScorekeeperInvite(token) {
  return supabase.rpc("claim_scorekeeper_invite", { p_token: token });
}

export async function deleteAllGameEvents(gameId, userId) {
  return supabase
    .from("game_events")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("game_id", gameId)
    .is("deleted_at", null);
}
