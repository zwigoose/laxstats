import { entryDisplayInfo, qLabel } from "./stats";

// Momentum engine for the fan-facing tracker. Computed client-side from the
// in-memory event list like every other stat (no DB aggregation, no snapshot
// table) — a game has a few hundred events, so recomputing the full series on
// each realtime update is trivial.
//
// Score sign: positive = home (teamIdx 0) momentum, negative = away.

export const MOMENTUM_WEIGHTS = {
  goal:        5.0,
  shot:        1.5, // non-goal shot attempts (a goal's paired shot entry is skipped)
  faceoff_win: 2.0,
  clear:       1.0,
  forced_to:   1.0,
};
export const PENALTY_WEIGHT = 2.5; // credited to the opposing team (man-up)

// Momentum fades 10% per 30s without a momentum event. Game clock isn't
// recorded on most events, so the scorer's wall clock (client_created_at) is
// the proxy — live scoring tracks real time closely. Gaps are capped so
// halftime or a scoring pause doesn't flatten the line to zero.
const DECAY_PER_30S = 0.9;
const MAX_GAP_SECS = 600;

/**
 * Build the momentum series from a seq-ordered event log.
 * Returns [{ x, score, quarter, entry }] where x lays events out in
 * equal-width quarter bands: x = (quarter - 1) + fraction within quarter.
 */
export function buildMomentumSeries(log) {
  if (!log?.length) return [];

  // A goal commits as a shot + goal pair in one group — only the goal scores
  // momentum, otherwise every goal would also count as a shot.
  const goalGroups = new Set(log.filter(e => e.event === "goal").map(e => e.groupId));

  const points = [];
  let score = 0;
  let lastTime = null;

  for (const e of log) {
    let weight = 0;
    let teamIdx = e.teamIdx;

    if (e.event === "goal") weight = MOMENTUM_WEIGHTS.goal;
    else if (e.event === "shot" && !goalGroups.has(e.groupId)) weight = MOMENTUM_WEIGHTS.shot;
    else if (e.event === "faceoff_win") weight = MOMENTUM_WEIGHTS.faceoff_win;
    else if (e.event === "clear") weight = MOMENTUM_WEIGHTS.clear;
    else if (e.event === "forced_to") weight = MOMENTUM_WEIGHTS.forced_to;
    else if (e.event === "penalty_tech" || e.event === "penalty_min") {
      weight = PENALTY_WEIGHT;
      teamIdx = 1 - e.teamIdx; // a penalty is momentum for the other team
    } else {
      continue; // event type carries no momentum
    }

    const t = e.createdAt ? Date.parse(e.createdAt) : null;
    if (t != null && !Number.isNaN(t) && lastTime != null && t > lastTime) {
      const gapSecs = Math.min((t - lastTime) / 1000, MAX_GAP_SECS);
      score *= Math.pow(DECAY_PER_30S, gapSecs / 30);
    }
    if (t != null && !Number.isNaN(t)) lastTime = t;

    score += teamIdx === 0 ? weight : -weight;
    points.push({ score, quarter: e.quarter ?? 1, entry: e });
  }

  // Lay events out within equal-width quarter bands (entry order within the
  // quarter — most events carry no game clock, so spacing is positional).
  const perQuarter = new Map();
  for (const p of points) perQuarter.set(p.quarter, (perQuarter.get(p.quarter) || 0) + 1);
  const seen = new Map();
  for (const p of points) {
    const i = (seen.get(p.quarter) || 0) + 1;
    seen.set(p.quarter, i);
    p.x = (p.quarter - 1) + i / (perQuarter.get(p.quarter) + 1);
  }
  return points;
}

/** Tooltip text for a momentum point, e.g. "Q3 8:12 · 🥍 Goal — #4 Smith". */
export function momentumPointLabel(point, teams) {
  const e = point.entry;
  const { icon, label, player } = entryDisplayInfo(e);
  const clock = e.goalTime || e.penaltyTime || e.timeoutTime;
  const who = e.teamStat
    ? teams?.[e.teamIdx]?.name
    : player
      ? `#${player.num} ${player.name}`.trim()
      : teams?.[e.teamIdx]?.name;
  return `${qLabel(e.quarter ?? point.quarter)}${clock ? ` ${clock}` : ""} · ${icon} ${label}${who ? ` — ${who}` : ""}`;
}
