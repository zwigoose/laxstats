import { supabase as _supabase } from "../lib/supabase";

export async function fetchSavedTeams(db = _supabase) {
  return db
    .from("saved_teams")
    .select("id, name, roster, color, user_id")
    .order("name");
}
