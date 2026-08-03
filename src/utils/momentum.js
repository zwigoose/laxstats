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

  // The x-axis is game time laid out in quarter bands, so the series must be
  // built in game-time order: quarter first, then seq within the quarter.
  // seq (logging order) usually matches, but diverges when the scorer backs up
  // the period (quarter_override) or enters a play into an earlier quarter late
  // — those events get a higher seq but an earlier quarter. Iterating raw seq
  // order then places an earlier-band point after a later-band one, and the
  // line drawn through them runs leftward (the "goes back in time" jag). A
  // stable sort by (quarter, seq) keeps normal games untouched and re-seats the
  // out-of-order events into their correct band.
  const ordered = log
    .map((e, i) => [e, i])
    .sort(([a, ai], [b, bi]) => {
      const q = (a.quarter ?? 1) - (b.quarter ?? 1);
      if (q !== 0) return q;
      const s = (a.seq ?? ai) - (b.seq ?? bi);
      return s !== 0 ? s : ai - bi;
    })
    .map(([e]) => e);

  const points = [];
  let score = 0;
  let lastTime = null;

  for (const e of ordered) {
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

/**
 * Fan-facing summary stats derived from a momentum series — how much of the
 * game (by x-axis width, i.e. game time) each team spent "in control," and
 * how many times control changed hands. `maxQ` should match whatever the
 * chart uses as its x-axis extent (the series is assumed to run from x=0 to
 * x=maxQ, flat at the last score past the final point, mirroring the drawn
 * line). Returns { pctHome, pctAway, leadChanges }.
 */
export function momentumControlStats(points, maxQ) {
  if (!points?.length) return { pctHome: 50, pctAway: 50, leadChanges: 0 };

  const signOf = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
  const series = [{ x: 0, score: 0 }, ...points, { x: maxQ, score: points.at(-1).score }];

  let homeWidth = 0;
  let awayWidth = 0;
  for (let i = 1; i < series.length; i++) {
    const a = series[i - 1];
    const b = series[i];
    const dx = b.x - a.x;
    if (dx <= 0) continue;

    const sa = signOf(a.score);
    const sb = signOf(b.score);
    if (sa === sb || sa === 0 || sb === 0) {
      // Whole segment on one side — a linear path to/from zero never
      // actually crosses it, so no split needed even when one end is 0.
      const s = sa || sb;
      if (s > 0) homeWidth += dx;
      else if (s < 0) awayWidth += dx;
    } else {
      // Genuine crossing: sa and sb are nonzero and opposite. Split the
      // segment's width at the interpolated zero crossing.
      const t = Math.abs(a.score) / (Math.abs(a.score) + Math.abs(b.score));
      const crossX = a.x + dx * t;
      if (sa > 0) { homeWidth += crossX - a.x; awayWidth += b.x - crossX; }
      else { awayWidth += crossX - a.x; homeWidth += b.x - crossX; }
    }
  }

  const total = homeWidth + awayWidth;
  const pctHome = total > 0 ? Math.round((homeWidth / total) * 100) : 50;

  let leadChanges = 0;
  let lastSign = 0;
  for (const p of points) {
    const sign = signOf(p.score);
    if (sign === 0) continue;
    if (lastSign !== 0 && sign !== lastSign) leadChanges++;
    lastSign = sign;
  }

  return { pctHome, pctAway: 100 - pctHome, leadChanges };
}

/**
 * The single biggest momentum swing in the game — the largest net rise or
 * fall between some earlier low/high point and a later point (a "run," in
 * broadcast terms). Anchors at the implicit kickoff (x=0, score=0) as a
 * valid start, same as the chart's own leading segment. Returns
 * { teamIdx, goalsFor, goalsAgainst, startQuarter, endQuarter, startX, endX }
 * or null if there's no real swing (empty series, or a single flat point).
 */
export function momentumBiggestRun(points) {
  if (!points?.length) return null;

  let riseMin = 0, riseMinIdx = -1, riseBest = { delta: 0, startIdx: -1, endIdx: -1 };
  let fallMax = 0, fallMaxIdx = -1, fallBest = { delta: 0, startIdx: -1, endIdx: -1 };

  for (let i = 0; i < points.length; i++) {
    const s = points[i].score;
    if (s - riseMin > riseBest.delta) riseBest = { delta: s - riseMin, startIdx: riseMinIdx, endIdx: i };
    if (s < riseMin) { riseMin = s; riseMinIdx = i; }

    if (fallMax - s > fallBest.delta) fallBest = { delta: fallMax - s, startIdx: fallMaxIdx, endIdx: i };
    if (s > fallMax) { fallMax = s; fallMaxIdx = i; }
  }

  const useRise = riseBest.delta >= fallBest.delta;
  const best = useRise ? riseBest : fallBest;
  if (best.delta <= 0 || best.endIdx === best.startIdx) return null;

  const teamIdx = useRise ? 0 : 1;
  const windowPoints = points.slice(best.startIdx + 1, best.endIdx + 1);

  let goalsFor = 0, goalsAgainst = 0;
  for (const p of windowPoints) {
    if (p.entry?.event !== "goal") continue;
    if (p.entry.teamIdx === teamIdx) goalsFor++; else goalsAgainst++;
  }

  return {
    teamIdx,
    goalsFor,
    goalsAgainst,
    startQuarter: best.startIdx === -1 ? 1 : points[best.startIdx].quarter,
    endQuarter: points[best.endIdx].quarter,
    startX: best.startIdx === -1 ? 0 : points[best.startIdx].x,
    endX: points[best.endIdx].x,
  };
}

/**
 * Which team held momentum within each quarter band, by the same
 * time-on-each-side method as momentumControlStats but bucketed per
 * quarter instead of totaled across the whole game. Returns an array of
 * { quarter, leader } (leader: 0, 1, or null for an even/quiet quarter).
 */
export function momentumQuarterControl(points, maxQ) {
  if (!points?.length) return [];

  const signOf = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
  const series = [{ x: 0, score: 0 }, ...points, { x: maxQ, score: points.at(-1).score }];
  const quarters = Array.from({ length: maxQ }, (_, i) => ({ quarter: i + 1, homeWidth: 0, awayWidth: 0 }));

  function addWidth(x1, x2, sign) {
    let cx = x1;
    while (cx < x2) {
      const qIdx = Math.floor(cx);
      const qEnd = Math.min(qIdx + 1, x2);
      const w = qEnd - cx;
      if (quarters[qIdx]) {
        if (sign > 0) quarters[qIdx].homeWidth += w;
        else if (sign < 0) quarters[qIdx].awayWidth += w;
      }
      cx = qEnd;
    }
  }

  for (let i = 1; i < series.length; i++) {
    const a = series[i - 1];
    const b = series[i];
    const dx = b.x - a.x;
    if (dx <= 0) continue;

    const sa = signOf(a.score);
    const sb = signOf(b.score);
    if (sa === sb || sa === 0 || sb === 0) {
      addWidth(a.x, b.x, sa || sb);
    } else {
      const t = Math.abs(a.score) / (Math.abs(a.score) + Math.abs(b.score));
      const crossX = a.x + dx * t;
      addWidth(a.x, crossX, sa);
      addWidth(crossX, b.x, sb);
    }
  }

  return quarters.map(q => ({
    quarter: q.quarter,
    leader: q.homeWidth === q.awayWidth ? null : q.homeWidth > q.awayWidth ? 0 : 1,
  }));
}

/**
 * The game's momentum "storyline": did one team hold it the whole way
 * (wire-to-wire), or did the team currently in control have to come back
 * after trailing earlier? Returns { type: 'wireToWire' | 'comeback', teamIdx }
 * or null when neither headline fits cleanly (e.g. it flipped several times
 * but ended back on the side it started).
 */
export function momentumStoryline(points, leadChanges) {
  if (!points?.length) return null;
  const signOf = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
  const firstSign = signOf(points[0].score);
  const lastSign = signOf(points.at(-1).score);

  if (leadChanges === 0 && firstSign !== 0) return { type: "wireToWire", teamIdx: firstSign > 0 ? 0 : 1 };
  if (lastSign !== 0 && lastSign !== firstSign) return { type: "comeback", teamIdx: lastSign > 0 ? 0 : 1 };
  return null;
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
