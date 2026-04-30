// Parse a date string safely — YYYY-MM-DD strings are treated as local noon
// to prevent UTC midnight from rolling back to the previous day.
function parseDate(str) {
  return str.length === 10 ? new Date(str + "T12:00:00") : new Date(str);
}

export function formatDate(str) {
  return parseDate(str).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateLong(str) {
  return parseDate(str).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function formatDateTime(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function getLatestTime(state) {
  if (!state?.log || !state.currentQuarter) return null;
  const q = state.currentQuarter;
  const toS = t => { const [m, s] = t.split(":").map(Number); return m * 60 + s; };
  const timed = (state.log || [])
    .filter(e => e.quarter === q && (e.goalTime || e.timeoutTime || e.penaltyTime))
    .map(e => { const str = e.goalTime || e.timeoutTime || e.penaltyTime; return { str, secs: toS(str) }; });
  if (!timed.length) return null;
  return timed.reduce((min, t) => t.secs < min.secs ? t : min).str;
}

export function getGameInfo(game) {
  const s = game.state;
  if (!s?.teams) return null;
  const t0 = s.teams[0], t1 = s.teams[1];
  // v2 games store log in game_events, not state — use pre-computed scores when present
  const score0 = s.score0 != null ? s.score0 : (s.log || []).filter(e => e.event === "goal" && e.teamIdx === 0).length;
  const score1 = s.score1 != null ? s.score1 : (s.log || []).filter(e => e.event === "goal" && e.teamIdx === 1).length;
  const started = !!s.trackingStarted;
  const latestTime = getLatestTime(s);
  const currentQuarter = s.currentQuarter || 1;
  const gameDate = s.gameDate || game.created_at?.split("T")[0];
  return { t0, t1, score0, score1, gameOver: s.gameOver, started, currentQuarter, latestTime, gameDate };
}
