/**
 * Event type registry mirror (event-sourcing Phase 3).
 *
 * The unified game_events stream carries three kinds of events, classified
 * server-side by the event_type_registry table and mirrored here:
 *
 *   stat  — scored actions (goal, shot, …). Feed the log UI and stats.
 *   state — LWW registers (full-snapshot payloads; latest by seq wins):
 *           roster/team setup, goalies, logistics, tracking flag.
 *   meta  — quarter machine transitions with {fromQuarter, toQuarter}.
 *
 * Anything not listed below is a stat event. Builders return entries in the
 * LaxStats/outbox format expected by useGameLog.commitGroup — each state/meta
 * event is its own group so it can be soft-deleted individually.
 */

export const STATE_EVENT_TYPES = new Set([
  "team_profile_set",
  "roster_set",
  "goalie_set",
  "goalie_decisions_set",
  "logistics_set",
  "tracking_started",
]);

export const META_EVENT_TYPES = new Set([
  "quarter_end",
  "game_over",
  "quarter_override",
]);

export const isStateEventType = (t) => STATE_EVENT_TYPES.has(t);
export const isMetaEventType  = (t) => META_EVENT_TYPES.has(t);
export const isStatEventType  = (t) => !STATE_EVENT_TYPES.has(t) && !META_EVENT_TYPES.has(t);

// ── Builders ──────────────────────────────────────────────────────────────────

function mk(event, payload, teamIdx = null) {
  return {
    event,
    payload,
    teamIdx,
    quarter: null,
    player:  null,
    groupId: crypto.randomUUID(),
  };
}

export const mkTeamProfileSet = (teamIdx, { name, color, logoUrl }) =>
  mk("team_profile_set", {
    name:    name    ?? null,
    color:   color   ?? null,
    logoUrl: logoUrl ?? null,
  }, teamIdx);

export const mkRosterSet = (teamIdx, rosterText, players) =>
  mk("roster_set", { rosterText: rosterText ?? "", players: players ?? [] }, teamIdx);

export const mkGoalieSet = (teamIdx, player) =>
  mk("goalie_set", { player: player ?? null }, teamIdx);

export const mkGoalieDecisionsSet = (decisions) =>
  mk("goalie_decisions_set", { decisions: decisions ?? null });

export const mkLogisticsSet = ({ gameDate, refereeNames, weatherConditions, fieldLocation }) =>
  mk("logistics_set", {
    gameDate:          gameDate          ?? null,
    refereeNames:      refereeNames      ?? null,
    weatherConditions: weatherConditions ?? null,
    fieldLocation:     fieldLocation     ?? null,
  });

export const mkTrackingStarted = () => mk("tracking_started", {});

export const mkQuarterEnd = (fromQuarter, toQuarter) =>
  mk("quarter_end", { fromQuarter, toQuarter });

export const mkGameOver = (quarter) =>
  mk("game_over", { fromQuarter: quarter, toQuarter: quarter });

export const mkQuarterOverride = (fromQuarter, toQuarter) =>
  mk("quarter_override", { fromQuarter, toQuarter });

// ── Register extraction (for diff-based dispatch) ─────────────────────────────

/**
 * Canonical register payloads for a full LaxStats state snapshot, keyed the
 * same way the projector keys them ("type:teamIdx", "-" for game-scoped).
 * Scorekeeper diffs consecutive snapshots against this to dispatch only the
 * registers that actually changed.
 */
export function registersFromState(state, parseRoster) {
  const regs = {};
  (state?.teams ?? []).forEach((team, i) => {
    if (!team) return;
    regs[`team_profile_set:${i}`] = {
      name:    team.name    ?? null,
      color:   team.color   ?? null,
      logoUrl: team.logoUrl ?? null,
    };
    regs[`roster_set:${i}`] = {
      rosterText: team.roster ?? "",
      players:    parseRoster ? parseRoster(team.roster ?? "") : [],
    };
  });
  (state?.activeGoalies ?? []).forEach((player, i) => {
    if (player !== undefined) regs[`goalie_set:${i}`] = { player: player ?? null };
  });
  if (state?.goalieDecisions) {
    regs["goalie_decisions_set:-"] = { decisions: state.goalieDecisions };
  }
  regs["logistics_set:-"] = {
    gameDate:          state?.gameDate          ?? null,
    refereeNames:      state?.refereeNames      ?? null,
    weatherConditions: state?.weatherConditions ?? null,
    fieldLocation:     state?.fieldLocation     ?? null,
  };
  if (state?.trackingStarted) regs["tracking_started:-"] = {};
  return regs;
}

/** Build the entries for every register in `next` that differs from `prev`. */
export function diffRegisters(prev, next) {
  const entries = [];
  for (const [key, payload] of Object.entries(next)) {
    if (JSON.stringify(prev?.[key]) === JSON.stringify(payload)) continue;
    const [type, teamKey] = key.split(":");
    const teamIdx = teamKey === "-" ? null : Number(teamKey);
    entries.push({
      event:   type,
      payload,
      teamIdx,
      quarter: null,
      player:  null,
      groupId: crypto.randomUUID(),
    });
  }
  return entries;
}
