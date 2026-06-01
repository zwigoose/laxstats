import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const VAPID_PUBLIC_KEY  = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT     = Deno.env.get("VAPID_SUBJECT") ?? "mailto:support@laxstats.app";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const { game_id, title, body, url, tag } = await req.json();
  if (!game_id) return json({ error: "game_id required" }, 400);

  const { data: subs, error } = await supabase
    .from("game_subscriptions")
    .select("id, push_subscription")
    .eq("game_id", game_id);

  if (error) return json({ error: error.message }, 500);
  if (!subs?.length) return json({ sent: 0 });

  const payload = JSON.stringify({ title, body, url, tag });
  const stale: string[] = [];

  await Promise.allSettled(
    subs.map(async (row) => {
      try {
        await webpush.sendNotification(row.push_subscription, payload);
      } catch (err: unknown) {
        // 410 Gone = subscription expired; remove it
        if ((err as { statusCode?: number }).statusCode === 410) stale.push(row.id);
      }
    })
  );

  if (stale.length) {
    await supabase.from("game_subscriptions").delete().in("id", stale);
  }

  return json({ sent: subs.length - stale.length, removed: stale.length });
});
