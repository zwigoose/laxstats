import { createClient } from "@supabase/supabase-js";

export function displayName(email) {
  return email ?? "Unknown";
}

export function makeTempClient() {
  return createClient(
    (import.meta.env ?? {}).VITE_SUPABASE_URL ?? "https://placeholder.invalid",
    (import.meta.env ?? {}).VITE_SUPABASE_ANON_KEY ?? "placeholder-anon-key",
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
