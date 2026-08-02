import { createClient } from "@supabase/supabase-js";

// Same visibility rule as everywhere else in the app: RLS's can_view_game()
// decides who sees what. We never use the service role here — the caller's
// own Authorization header (if any) is forwarded so an anonymous request
// only ever sees is_public games, exactly like a logged-out fan.
const SUPABASE_URL      = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

// Mirrors src/domain/eventTypes.js: anything not state/meta is a stat event.
// Kept in sync with event_type_registry via a live query below rather than a
// hardcoded list, so new stat types register themselves automatically.
const CLOCK_FIELD = {
  goal:         "goal_time",
  penalty_min:  "penalty_time",
  penalty_tech: "penalty_time",
  timeout:      "timeout_time",
};

const ACTION_CODE = {
  goal: "GOAL", assist: "AST", shot: "SHOT", shot_saved: "SV",
  goal_allowed: "GA", ground_ball: "GB", turnover: "TO", forced_to: "FTO",
  faceoff_win: "FO-W", faceoff_loss: "FO-L", clear: "CLR",
  failed_clear: "CLR-X", timeout: "TIME", penalty_min: "PEN",
  penalty_tech: "PEN-T", goalie_change: "GC",
};

function xmlEscape(v) {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function xmlError(status, message) {
  return {
    status,
    body: `<?xml version="1.0" encoding="UTF-8"?>\n<error status="${status}">${xmlEscape(message)}</error>\n`,
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "GET") {
    const { status, body } = xmlError(405, "Method not allowed");
    res.status(status).setHeader("Content-Type", "application/xml; charset=utf-8").send(body);
    return;
  }

  const gameId = req.query.game_id;
  if (!gameId) {
    const { status, body } = xmlError(400, "game_id is required");
    res.status(status).setHeader("Content-Type", "application/xml; charset=utf-8").send(body);
    return;
  }

  const authHeader = req.headers.authorization;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
  });

  const { data: game, error: gameErr } = await supabase
    .from("games")
    .select("id, name, game_date, created_at, summary, state")
    .eq("id", gameId)
    .single();

  if (gameErr || !game) {
    const { status, body } = xmlError(404, "Game not found, or you don't have access to it");
    res.status(status).setHeader("Content-Type", "application/xml; charset=utf-8").send(body);
    return;
  }

  const { data: registry } = await supabase
    .from("event_type_registry")
    .select("event_type")
    .eq("kind", "stat");
  const statTypes = (registry ?? []).map(r => r.event_type);

  const { data: events, error: eventsErr } = await supabase
    .from("game_events")
    .select("quarter, seq, event_type, team_idx, player_num, player_name, goal_time, penalty_time, timeout_time, penalty_minutes, foul_name, shot_zone, is_emo")
    .eq("game_id", gameId)
    .is("deleted_at", null)
    .in("event_type", statTypes)
    .order("quarter", { ascending: true })
    .order("seq", { ascending: true });

  if (eventsErr) {
    const { status, body } = xmlError(500, eventsErr.message);
    res.status(status).setHeader("Content-Type", "application/xml; charset=utf-8").send(body);
    return;
  }

  const derived = game.summary ?? game.state ?? {};
  const teams = derived.teams ?? [{ name: "Home" }, { name: "Away" }];
  const gameDate = game.game_date ?? derived.gameDate ?? game.created_at;

  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<lacrosse-game id="${xmlEscape(game.id)}" date="${xmlEscape(gameDate)}" source="laxstats" schema="laxstats-statcrew-adjacent-v1">`);
  lines.push("  <!--");
  lines.push("    NOTE ON TIMING: this feed does not carry a game-clock timestamp on every");
  lines.push("    play the way a StatCrew export does. Ordering is authoritative via");
  lines.push("    quarter + seq (a strict, gapless, per-game sequence number assigned at");
  lines.push('    write time); every play below carries a period-relative "pos" ordinal');
  lines.push("    instead of a clock. A real clock time IS captured for goal, penalty, and");
  lines.push("    timeout events specifically (the scorer enters/confirms it live), so");
  lines.push('    those rows carry a clock="MM:SS" attribute; all other event types do not');
  lines.push("    and have no clock attribute at all, so none should be inferred.");
  lines.push("  -->");
  lines.push("  <teams>");
  teams.forEach((team, idx) => {
    const side = idx === 0 ? "home" : "away";
    lines.push(`    <team idx="${idx}" side="${side}" name="${xmlEscape(team?.name ?? (idx === 0 ? "Home" : "Away"))}"/>`);
  });
  lines.push("  </teams>");

  const score = [0, 0];
  lines.push("  <plays>");
  let currentQuarter = null;
  let posInQuarter = 0;
  for (const row of events ?? []) {
    if (row.quarter !== currentQuarter) {
      if (currentQuarter !== null) lines.push("    </period>");
      lines.push(`    <period number="${row.quarter}">`);
      currentQuarter = row.quarter;
      posInQuarter = 0;
    }
    posInQuarter += 1;

    const code = ACTION_CODE[row.event_type] ?? row.event_type.toUpperCase();
    const attrs = [`seq="${row.seq}"`, `pos="${posInQuarter}"`, `action="${code}"`];

    if (row.team_idx !== null && row.team_idx !== undefined) attrs.push(`team="${row.team_idx}"`);

    const clockField = CLOCK_FIELD[row.event_type];
    if (clockField && row[clockField]) attrs.push(`clock="${xmlEscape(row[clockField])}"`);

    if (row.player_num || row.player_name) {
      attrs.push(`player="#${xmlEscape(row.player_num)} ${xmlEscape(row.player_name)}"`);
    }
    if (row.event_type === "penalty_min") {
      attrs.push(`foul="${xmlEscape(row.foul_name)}"`, `minutes="${row.penalty_minutes}"`);
    }
    if (row.event_type === "penalty_tech") {
      attrs.push(`foul="${xmlEscape(row.foul_name)}"`);
    }
    if ((row.event_type === "shot" || row.event_type === "shot_saved") && row.shot_zone) {
      attrs.push(`zone="${xmlEscape(row.shot_zone)}"`);
    }
    if (row.is_emo) attrs.push('emo="true"');

    if (row.event_type === "goal" && row.team_idx !== null && row.team_idx !== undefined) {
      score[row.team_idx] += 1;
      attrs.push(`score="${score[0]}-${score[1]}"`);
    }

    lines.push(`      <play ${attrs.join(" ")} desc="${xmlEscape(row.event_type)}"/>`);
  }
  if (currentQuarter !== null) lines.push("    </period>");
  lines.push("  </plays>");
  lines.push(`  <final score0="${score[0]}" score1="${score[1]}"/>`);
  lines.push("</lacrosse-game>");

  res
    .status(200)
    .setHeader("Content-Type", "application/xml; charset=utf-8")
    .setHeader("Content-Disposition", `inline; filename="${gameId}.xml"`)
    .send(lines.join("\n") + "\n");
}
