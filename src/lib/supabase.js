import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Keep the Realtime socket connected for the lifetime of the app.
// Without this, removeChannel() on the last active channel disconnects the
// socket, causing the Realtime tenant to stop. The next channel join then
// races against a tenant restart and gets dropped silently.
supabase.channel("__keepalive__").subscribe();
