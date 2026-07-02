import { createClient } from "@supabase/supabase-js";

// In Vite builds import.meta.env is always defined and these resolve to the
// injected values. Outside the app (component previews, foreign bundlers that
// lower import.meta to {}) they fall back to a never-resolving placeholder so
// module init doesn't throw — data calls then fail into each component's own
// loading/empty states.
const ENV = import.meta.env ?? {};
export const SUPABASE_URL      = ENV.VITE_SUPABASE_URL      ?? "https://placeholder.invalid";
export const SUPABASE_ANON_KEY = ENV.VITE_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Keep the Realtime socket connected for the lifetime of the app.
// Without this, removeChannel() on the last active channel disconnects the
// socket, causing the Realtime tenant to stop. The next channel join then
// races against a tenant restart and gets dropped silently.
// Skipped on the placeholder client — there is no tenant to keep alive.
if (ENV.VITE_SUPABASE_URL) supabase.channel("__keepalive__").subscribe();
