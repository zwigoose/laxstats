import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const supabaseUrl     = Deno.env.get("SUPABASE_URL")!;
    const anonKey         = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ── Auth: verify caller is a platform admin ─────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Not authenticated" }, 401);

    const { data: profile } = await userClient
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();
    if (!profile?.is_admin) return json({ error: "Platform admin only" }, 403);

    // ── Service role client — bypasses RLS ──────────────────────────
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // ── Options ─────────────────────────────────────────────────────
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const dryRun:   boolean  = body.dry_run  ?? false;
    const gameIds:  string[] = body.game_ids ?? null; // optional filter

    // ── Load v1 games ───────────────────────────────────────────────
    let query = admin
      .from("games")
      .select("id, user_id, org_id, season_id, home_team_id, away_team_id, game_date, state, created_at, name, schema_ver")
      .eq("schema_ver", 1)
      .not("state", "is", null);

    if (gameIds?.length) query = query.in("id", gameIds);

    const { data: games, error: gErr } = await query;
    if (gErr) throw gErr;

    const results = {
      dry_run: dryRun,
      total: (games ?? []).length,
      migrated: 0,
      skipped: 0,
      errors: 0,
      details: [] as object[],
    };

    for (const game of (games ?? [])) {
      const log: unknown[] = game.state?.log ?? [];

      if (!log.length) {
        results.skipped++;
        results.details.push({ game_id: game.id, name: game.name, status: "skipped", reason: "empty log" });
        continue;
      }

      // Idempotency: skip if game_events rows already exist
      const { count } = await admin
        .from("game_events")
        .select("id", { count: "exact", head: true })
        .eq("game_id", game.id)
        .is("deleted_at", null);

      if ((count ?? 0) > 0) {
        results.skipped++;
        results.details.push({ game_id: game.id, name: game.name, status: "skipped", reason: "already migrated" });
        continue;
      }

      // ── Build game_events rows ────────────────────────────────────
      // Map v1 integer groupId → stable UUID for this migration run
      const groupIdMap = new Map<number, string>();

      // deno-lint-ignore no-explicit-any
      const rows = (log as any[]).map((entry) => {
        if (!groupIdMap.has(entry.groupId)) {
          groupIdMap.set(entry.groupId, crypto.randomUUID());
        }
        return {
          game_id:           game.id,
          group_id:          groupIdMap.get(entry.groupId)!,
          quarter:           entry.quarter,
          event_type:        entry.event,
          team_idx:          entry.teamIdx,
          is_team_stat:      entry.teamStat      ?? false,
          player_num:        entry.player?.num    ?? null,
          player_name:       entry.player?.name   ?? null,
          goal_time:         entry.goalTime       ?? null,
          penalty_time:      entry.penaltyTime    ?? null,
          timeout_time:      entry.timeoutTime    ?? null,
          is_non_releasable: entry.nonReleasable  ?? false,
          penalty_minutes:   entry.penaltyMin     ?? null,
          shot_outcome:      entry.shotOutcome    ?? null,
          foul_name:         entry.foulName       ?? null,
          created_by:        game.user_id,
        };
      });

      if (dryRun) {
        results.migrated++;
        results.details.push({ game_id: game.id, name: game.name, status: "dry_run", events: rows.length });
        continue;
      }

      // ── Insert ───────────────────────────────────────────────────
      const { error: insertErr } = await admin.from("game_events").insert(rows);
      if (insertErr) {
        results.errors++;
        await admin.from("migration_errors").insert({ game_id: game.id, phase: "insert", error_message: insertErr.message });
        results.details.push({ game_id: game.id, name: game.name, status: "error", phase: "insert", error: insertErr.message });
        continue;
      }

      // ── Verify: goal counts JS vs DB ─────────────────────────────
      // deno-lint-ignore no-explicit-any
      const jsGoals = [0, 1].map(ti => (log as any[]).filter(e => e.event === "goal" && e.teamIdx === ti).length);

      const { data: dbTotals } = await admin
        .from("v_game_team_totals")
        .select("team_idx, goals")
        .eq("game_id", game.id);

      const dbGoals = [0, 1].map(ti => (dbTotals ?? []).find((r: { team_idx: number }) => r.team_idx === ti)?.goals ?? 0);

      if (jsGoals[0] !== dbGoals[0] || jsGoals[1] !== dbGoals[1]) {
        // Rollback: hard-delete the just-inserted rows
        await admin.from("game_events").delete().eq("game_id", game.id);
        const msg = `Goal mismatch: JS=[${jsGoals}] DB=[${dbGoals}]`;
        await admin.from("migration_errors").insert({ game_id: game.id, phase: "verify", error_message: msg });
        results.errors++;
        results.details.push({ game_id: game.id, name: game.name, status: "error", phase: "verify", error: msg });
        continue;
      }

      // ── Update game row ───────────────────────────────────────────
      // deno-lint-ignore no-explicit-any
      const update: Record<string, any> = { schema_ver: 2 };

      // Set game_date from created_at if missing
      if (!game.game_date && game.created_at) {
        update.game_date = game.created_at.slice(0, 10);
      }

      // Strip log from JSONB state; keep teams/quarters/meta
      if (game.state) {
        // deno-lint-ignore no-explicit-any
        const { log: _log, ...meta } = game.state as any;
        update.state = Object.keys(meta).length > 0 ? meta : null;
      }

      // For org games: try to link teams by name if not already linked
      if (game.org_id && !game.home_team_id && game.state?.teams) {
        const t0name = game.state.teams[0]?.name;
        const t1name = game.state.teams[1]?.name;
        if (t0name) {
          const { data: homeTeam } = await admin
            .from("teams")
            .select("id")
            .eq("org_id", game.org_id)
            .ilike("name", t0name)
            .maybeSingle();
          if (homeTeam) update.home_team_id = homeTeam.id;
        }
        if (t1name) {
          const { data: awayTeam } = await admin
            .from("teams")
            .select("id")
            .eq("org_id", game.org_id)
            .ilike("name", t1name)
            .maybeSingle();
          if (awayTeam) update.away_team_id = awayTeam.id;
        }
      }

      const { error: updateErr } = await admin.from("games").update(update).eq("id", game.id);
      if (updateErr) {
        results.errors++;
        await admin.from("migration_errors").insert({ game_id: game.id, phase: "update", error_message: updateErr.message });
        results.details.push({ game_id: game.id, name: game.name, status: "error", phase: "update", error: updateErr.message });
        continue;
      }

      results.migrated++;
      results.details.push({ game_id: game.id, name: game.name, status: "migrated", events: rows.length });
    }

    return json(results);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
