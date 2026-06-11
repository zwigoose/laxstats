import { supabase as _supabase } from "../lib/supabase";

export async function fetchSavedTeams(db = _supabase) {
  return db
    .from("saved_teams")
    .select("id, name, roster, color, user_id, logo_url")
    .order("name");
}

/**
 * Apply a game-day roster correction to a stored org team.
 * change: { num, name, origNum } — origNum is the player's pre-game jersey
 * number (used to find the existing org roster entry); null means the player
 * was added during the game and gets a new org player record.
 */
export async function upsertOrgTeamPlayer(teamId, { num, name, origNum }, db = _supabase) {
  const jersey = /^\d+$/.test(num) ? parseInt(num, 10) : null;

  if (origNum != null) {
    const { data: rows, error: fetchErr } = await db
      .from("team_players")
      .select("player_id, jersey_num, player:players!inner(id, name, number)")
      .eq("team_id", teamId);
    if (fetchErr) throw fetchErr;
    const match = (rows || []).find(tp =>
      String(tp.jersey_num ?? tp.player?.number) === String(origNum));
    if (match) {
      if (name) {
        const { error } = await db.from("players").update({ name }).eq("id", match.player_id);
        if (error) throw error;
      }
      const { error } = await db.from("team_players")
        .update({ jersey_num: jersey })
        .eq("team_id", teamId)
        .eq("player_id", match.player_id);
      if (error) throw error;
      return;
    }
    // No org entry under the old number — fall through and create one.
  }

  const { data: team, error: teamErr } = await db
    .from("teams").select("org_id").eq("id", teamId).single();
  if (teamErr) throw teamErr;
  const { data: player, error: insErr } = await db
    .from("players")
    .insert({ org_id: team.org_id, name: name || `#${num}`, number: jersey })
    .select("id")
    .single();
  if (insErr) throw insErr;
  const { error: tpErr } = await db
    .from("team_players")
    .insert({ team_id: teamId, player_id: player.id, jersey_num: jersey });
  if (tpErr) throw tpErr;
}
