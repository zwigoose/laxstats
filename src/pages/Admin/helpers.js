import { createClient } from "@supabase/supabase-js";

export function displayName(email) {
  return email ?? "Unknown";
}

export function makeTempClient() {
  return createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
