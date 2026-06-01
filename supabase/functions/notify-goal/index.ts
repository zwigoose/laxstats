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

  const payload = await req.json();

  let game_id: string, title: string, body: string, url: string, tag: string;

  if (payload.record) {
    // ── Supabase database webhook format ──────────────────────────────────────
    const record = payload.record;

    // Only notify for goals; ignore soft-deletes
    if (record.event_type !== "goal" || record.deleted_at) return json({ skipped: true });

    game_id = record.game_id;

    // Look up game name + team names from state
    const { data: game } = await supabase
      .from("games")
      .select("name, state")
      .eq("id", game_id)
      .single();

    const teams: { name: string }[] = game?.state?.teams ?? [{ name: "Home" }, { name: "Away" }];
    const teamName = teams[record.team_idx]?.name ?? "Team";
    const scorer   = record.player_name ?? (record.player_num ? `#${record.player_num}` : null);

    // Tally current score
    const { data: goals } = await supabase
      .from("game_events")
      .select("team_idx")
      .eq("game_id", game_id)
      .eq("event_type", "goal")
      .is("deleted_at", null);

    const score = [0, 0];
    for (const g of goals ?? []) score[g.team_idx as 0 | 1]++;

    title = `Goal — ${teamName}  ${score[0]}–${score[1]}`;
    body  = scorer ? `${scorer} scores` : `${teamName} scores`;
    url   = `/games/${game_id}/view`;
    tag   = `game-${game_id}`;
  } else {
    // ── Direct call format ────────────────────────────────────────────────────
    ({ game_id, title, body, url, tag } = payload);
    if (!game_id) return json({ error: "game_id required" }, 400);
  }

  const { data: subs, error } = await supabase
    .from("game_subscriptions")
    .select("id, push_subscription")
    .eq("game_id", game_id);

  if (error) return json({ error: error.message }, 500);
  if (!subs?.length) return json({ sent: 0 });

  const notifPayload = JSON.stringify({ title, body, url, tag });
  const stale: string[] = [];

  await Promise.allSettled(
    subs.map(async (row) => {
      try {
        await webpush.sendNotification(row.push_subscription, notifPayload);
      } catch (err: unknown) {
        if ((err as { statusCode?: number }).statusCode === 410) stale.push(row.id);
      }
    })
  );

  if (stale.length) {
    await supabase.from("game_subscriptions").delete().in("id", stale);
  }

  return json({ sent: subs.length - stale.length, removed: stale.length });
});
