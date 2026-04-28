import { createClient } from "@supabase/supabase-js";

export const FAKE_DOMAIN = "@laxstats.app";

export function toEmail(username) {
  const u = username.trim().toLowerCase();
  return u.includes("@") ? u : u + FAKE_DOMAIN;
}

export function displayName(email) {
  if (!email) return "Unknown";
  return email.endsWith("@laxstats.app") ? email.replace("@laxstats.app", "") : email;
}

export function makeTempClient() {
  return createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
