import { supabase } from "../lib/supabase";

export async function fetchSavedTeams() {
  return supabase
    .from("saved_teams")
    .select("id, name, roster, color, user_id")
    .order("name");
}
