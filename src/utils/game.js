import { EVENTS } from '../constants/lacrosse';

export function parseRoster(text) {
  if (!text) return [];
  return text.split("\n").map(l => l.trim()).filter(Boolean).map(line => {
    const m = line.match(/^#?(\d+)\s+(.+)$/) || line.match(/^(.+)\s+#?(\d+)$/);
    if (m) { if (/^\d+$/.test(m[1])) return { num: m[1], name: m[2].trim() }; return { num: m[2], name: m[1].trim() }; }
    const n = line.match(/^#?(\d+)$/);
    if (n) return { num: n[1], name: `#${n[1]}` };
    return { num: "", name: line };
  }).filter(p => p.name).sort((a, b) => parseInt(a.num, 10) - parseInt(b.num, 10));
}

export function findDuplicateNums(rosterText) {
  const players = parseRoster(rosterText);
  const seen = new Set(), dupes = new Set();
  players.forEach(p => {
    if (!p.num) return;
    if (seen.has(p.num)) dupes.add(`#${p.num}`);
    else seen.add(p.num);
  });
  return [...dupes];
}

export function qLabel(q) { return q <= 4 ? `Q${q}` : `OT${q - 4}`; }
export function isOT(q) { return q > 4; }

export function absSecsToQtrTime(absSeconds) {
  const qLenSecs = q => q <= 4 ? 720 : 240;
  let q = 1, elapsed = 0;
  while (q <= 20) {
    const ql = qLenSecs(q);
    if (absSeconds <= elapsed + ql) return { q, remainSecs: Math.max(0, elapsed + ql - absSeconds) };
    elapsed += ql;
    q++;
  }
  return { q: 20, remainSecs: 0 };
}

export function getTimeoutsLeft(log, currentQuarter) {
  let periodQuarters, allowed;
  if (currentQuarter <= 2)      { periodQuarters = [1, 2]; allowed = 2; }
  else if (currentQuarter <= 4) { periodQuarters = [3, 4]; allowed = 2; }
  else                          { periodQuarters = [currentQuarter]; allowed = 1; }
  return [0, 1].map(ti =>
    Math.max(0, allowed - (log || []).filter(e => e.event === "timeout" && e.teamIdx === ti && periodQuarters.includes(e.quarter)).length)
  );
}

export function entryDisplayInfo(entry) {
  let icon = EVENTS.find(e => e.id === entry.event)?.icon || "•";
  let label = EVENTS.find(e => e.id === entry.event)?.label || entry.event;
  if (entry.event === "shot_saved") { icon = "🧤"; label = "Save"; }
  if (entry.event === "penalty_tech") { icon = "🟨"; label = entry.foulName ? `${entry.foulName} (Technical)` : "Technical foul"; }
  if (entry.event === "penalty_min") { icon = "🟥"; label = entry.foulName ? `${entry.foulName} (${entry.penaltyMin}min)` : `Personal foul (${entry.penaltyMin}min)`; }
  if (entry.event === "goal" && entry.emo) label = "Goal (EMO)";
  return { icon, label, player: entry.teamStat ? null : entry.player };
}

export function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function getLatestTime(log, quarter) {
  if (!log || !quarter) return null;
  const toS = t => { const [m, s] = t.split(":").map(Number); return m * 60 + s; };
  const timed = log
    .filter(e => e.quarter === quarter && (e.goalTime || e.timeoutTime || e.penaltyTime))
    .map(e => { const str = e.goalTime || e.timeoutTime || e.penaltyTime; return { str, secs: toS(str) }; });
  if (!timed.length) return null;
  return timed.reduce((min, t) => t.secs < min.secs ? t : min).str;
}

export function getGameInfo(game) {
  const s = game.state;
  if (!s?.teams) return null;
  const t0 = s.teams[0], t1 = s.teams[1];
  const score0 = (s.log || []).filter(e => e.event === "goal" && e.teamIdx === 0).length;
  const score1 = (s.log || []).filter(e => e.event === "goal" && e.teamIdx === 1).length;
  return { t0, t1, score0, score1 };
}