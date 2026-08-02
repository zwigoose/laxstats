/**
 * Pure reducer over the unified game_events stream — the JS twin of the
 * project_game() SQL projector (event-sourcing Phase 3). Both must produce
 * identical snapshots from the same rows; the shared fixtures in
 * src/test/fixtures/eventStreams/ enforce parity (expected.summary blocks).
 *
 * Rows are raw game_events DB rows (snake_case). Deleted rows are ignored.
 * legacyState is the games.state blob; every field composes over it so games
 * that predate state events keep rendering forever.
 */
import { isStateEventType, isMetaEventType, isStatEventType } from "./eventTypes";

const liveRows = (rows) => (rows ?? []).filter((r) => !r.deleted_at);
const bySeq    = (a, b) => a.seq - b.seq;

/**
 * Replay meta-kind stream rows into quarter state. Mirrors the legacy
 * deriveQuarterState() contract: returns null when there are no meta events
 * (callers fall back to games.state), quirks preserved (duplicate
 * quarter_end rows double-append completedQuarters).
 */
export function deriveQuarterFromStream(rows) {
  const metas = liveRows(rows).filter((r) => isMetaEventType(r.event_type)).sort(bySeq);
  if (!metas.length) return null;

  let currentQuarter    = 1;
  let completedQuarters = [];
  let gameOver          = false;

  for (const row of metas) {
    const p = row.payload ?? {};
    if (row.event_type === "quarter_end") {
      completedQuarters = [...completedQuarters, p.fromQuarter];
      currentQuarter    = p.toQuarter;
    } else if (row.event_type === "game_over") {
      completedQuarters = [...completedQuarters, p.fromQuarter];
      gameOver          = true;
      currentQuarter    = p.fromQuarter;
    } else if (row.event_type === "quarter_override") {
      currentQuarter = p.toQuarter;
      // Reconcile: quarters at or beyond the override target un-complete, so
      // a downward override cannot leave a quarter both current and done.
      completedQuarters = completedQuarters.filter((q) => q < currentQuarter);
    }
  }

  return { currentQuarter, completedQuarters, gameOver };
}

/**
 * Describe the most recent quarter transition so the scorekeeper can offer a
 * real undo: which meta event to tombstone, and which stat events were logged
 * after it into the quarter it created (candidates to move back).
 * Returns null when there is nothing undoable (no live meta events, or the
 * last transition is game_over — un-finalizing is out of scope).
 */
export function computeQuarterFix(rows) {
  const live  = liveRows(rows).sort(bySeq);
  const metas = live.filter((r) => isMetaEventType(r.event_type));
  const last  = metas[metas.length - 1] ?? null;
  if (!last || last.event_type === "game_over") return null;

  const p = last.payload ?? {};
  // Undoing the transition restores the quarter machine to its state just
  // before `last` — replay everything up to (not including) it.
  const before = deriveQuarterFromStream(live.filter((r) => r.seq < last.seq));
  const restoredQuarter = before ? before.currentQuarter : 1;

  const affected = live.filter(
    (r) => isStatEventType(r.event_type) && r.seq > last.seq && r.quarter === p.toQuarter
  );

  return {
    type:            last.event_type,           // "quarter_end" | "quarter_override"
    fromQuarter:     p.fromQuarter ?? null,
    toQuarter:       p.toQuarter ?? null,
    restoredQuarter,                             // where undo lands the game
    groupId:         last.group_id,
    affectedIds:     affected.map((r) => r.id),  // events to relabel back
  };
}

// Latest live register payloads keyed "type:teamIdx" ("-" for game-scoped),
// matching the projector's keying.
function latestRegisters(rows) {
  const regs = {};
  for (const row of liveRows(rows).filter((r) => isStateEventType(r.event_type)).sort(bySeq)) {
    regs[`${row.event_type}:${row.team_idx ?? "-"}`] = row.payload ?? {};
  }
  return regs;
}

// Mirrors summary_team_slot(): legacy state team overlaid with register
// values, so unknown state fields (e.g. orgTeamId) survive.
function teamSlot(base, profile, roster) {
  let overlay = {};
  if (profile) {
    overlay = {
      name:    profile.name    ?? null,
      color:   profile.color   ?? null,
      logoUrl: profile.logoUrl ?? null,
    };
  }
  if (roster) overlay = { ...overlay, roster: roster.rosterText ?? null };
  if (base == null && Object.keys(overlay).length === 0) return null;
  return { ...(base ?? {}), ...overlay };
}

// Mirrors `COALESCE(payload -> 'field', fallback)`: a key present with an
// explicit null wins over the fallback; an absent key falls through.
function regField(reg, field, fallback) {
  if (reg && field in reg) return reg[field];
  return fallback;
}

export function reduceGame(rows, legacyState = null) {
  const live  = liveRows(rows).sort(bySeq);
  const state = legacyState ?? {};

  // Quarter machine (fallback to client-written state when no meta events)
  const derived           = deriveQuarterFromStream(live);
  const currentQuarter    = derived ? derived.currentQuarter : (state.currentQuarter ?? 1);
  const completedQuarters = derived ? derived.completedQuarters : [];
  const gameOver          = derived ? derived.gameOver : (state.gameOver ?? false);

  const regs = latestRegisters(live);
  const stats = live.filter((r) => isStatEventType(r.event_type));

  const score0 = stats.filter((r) => r.event_type === "goal" && r.team_idx === 0).length;
  const score1 = stats.filter((r) => r.event_type === "goal" && r.team_idx === 1).length;

  const trackingStarted =
    !!state.trackingStarted ||
    derived != null ||
    "tracking_started:-" in regs ||
    stats.length > 0;

  const team0 = teamSlot(state.teams?.[0] ?? null, regs["team_profile_set:0"], regs["roster_set:0"]);
  const team1 = teamSlot(state.teams?.[1] ?? null, regs["team_profile_set:1"], regs["roster_set:1"]);
  const teams = team0 == null && team1 == null ? (state.teams ?? null) : [team0, team1];

  const activeGoalies =
    !regs["goalie_set:0"] && !regs["goalie_set:1"]
      ? (state.activeGoalies ?? null)
      : [
          regField(regs["goalie_set:0"], "player", state.activeGoalies?.[0] ?? null),
          regField(regs["goalie_set:1"], "player", state.activeGoalies?.[1] ?? null),
        ];

  const logistics = regs["logistics_set:-"];

  return {
    score0,
    score1,
    currentQuarter,
    completedQuarters,
    gameOver,
    trackingStarted,
    teams,
    activeGoalies,
    goalieDecisions:   regField(regs["goalie_decisions_set:-"], "decisions", state.goalieDecisions ?? null),
    gameDate:          regField(logistics, "gameDate",          state.gameDate          ?? null),
    refereeNames:      regField(logistics, "refereeNames",      state.refereeNames      ?? null),
    weatherConditions: regField(logistics, "weatherConditions", state.weatherConditions ?? null),
    fieldLocation:     regField(logistics, "fieldLocation",     state.fieldLocation     ?? null),
  };
}
