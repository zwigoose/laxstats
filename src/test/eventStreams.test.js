import { describe, it, expect } from "vitest";
import { dbRowToEntry } from "../hooks/useGameLog";
import { getGameInfo } from "../utils/game";
import { reduceGame, computeQuarterFix } from "../domain/reduceGame";
import { isStatEventType } from "../domain/eventTypes";

import emptyPretracking from "./fixtures/eventStreams/empty-pretracking.json";
import basicScoring from "./fixtures/eventStreams/basic-scoring.json";
import fullGame from "./fixtures/eventStreams/full-game.json";
import overtime from "./fixtures/eventStreams/overtime.json";
import quarterAnomalies from "./fixtures/eventStreams/quarter-anomalies.json";
import legacyStateOnly from "./fixtures/eventStreams/legacy-state-only.json";
import stateEvents from "./fixtures/eventStreams/state-events.json";
import overrideDown from "./fixtures/eventStreams/override-down.json";

/**
 * Characterization tests over the shared event-stream fixture corpus
 * (src/test/fixtures/eventStreams/). These lock in TODAY's derivation
 * behavior so the event-sourcing refactor can prove parity:
 *
 *   - Phase 1: the SQL projector (project_game → games.summary) must match
 *     the same `expected` blocks when the fixture rows are inserted into a
 *     local Supabase stack.
 *   - Phase 3: reduceGame() (the projector's JS twin) must match them too.
 *
 * If one of these assertions needs to change, that is a behavior change to
 * the scoring pipeline — call it out explicitly in the PR.
 */

const fixtures = [
  emptyPretracking,
  basicScoring,
  fullGame,
  overtime,
  quarterAnomalies,
  legacyStateOnly,
  stateEvents,
  overrideDown,
];

// Mirrors fetchGameEvents' `.is("deleted_at", null)` filter.
const liveRows = (fixture) => fixture.events.filter((row) => !row.deleted_at);

describe.each(fixtures)("event stream fixture: $name", (fixture) => {
  // (The legacy deriveQuarterState characterization is gone with the function
  // itself — quarter replay is covered by the reduceGame parity block below,
  // which asserts the same expected values via expected.summary.)

  it("derives scores from live events (getGameInfo recompute expression)", () => {
    const entries = liveRows(fixture).map(dbRowToEntry);
    // The exact expression used by Scorekeeper.jsx handleStateChange and the
    // getGameInfo fallback: count non-deleted goal entries per team.
    const score0 = entries.filter((e) => e.event === "goal" && e.teamIdx === 0).length;
    const score1 = entries.filter((e) => e.event === "goal" && e.teamIdx === 1).length;
    expect({ score0, score1 }).toEqual(fixture.expected.eventScores);
  });

  it("renders the expected getGameInfo() display state from games.state", () => {
    expect(getGameInfo(fixture.game)).toMatchObject(fixture.expected.gameInfo);
  });
});

// ── reduceGame ↔ project_game parity ───────────────────────────────────────────
// reduceGame() is the JS twin of the SQL projector. Both consume the same
// stream rows and must produce the fixture's expected.summary exactly — the
// SQL side is checked by scripts/gen-projector-parity-sql.mjs against a real
// database, the JS side here. Legacy metaEvents are mapped into the stream
// the same way the Phase 3 migration copies them (payload shape, appended
// after existing stream rows in per-game seq order).

const legacyMetaToStreamRow = (m, i) => ({
  id:                `stream-copy-${m.id ?? i}`,
  seq:               100000 + i,
  game_id:           m.game_id,
  group_id:          `stream-copy-grp-${m.id ?? i}`,
  event_type:        m.event_type,
  team_idx:          null,
  quarter:           null,
  payload:           { fromQuarter: m.from_quarter, toQuarter: m.to_quarter },
  deleted_at:        null,
  created_by:        m.created_by,
  client_created_at: m.client_created_at,
});

describe("reduceGame parity with expected.summary", () => {
  const projectable = fixtures.filter((f) => f.expected.summary !== null);

  it.each(projectable.map(f => [f.name, f]))("%s", (_name, fixture) => {
    const streamRows = [
      ...fixture.events,
      ...fixture.metaEvents.map(legacyMetaToStreamRow),
    ];
    expect(reduceGame(streamRows, fixture.game.state)).toEqual(fixture.expected.summary);
  });

  it("stat entries exclude state and meta events (log/stats stay clean)", () => {
    const statRows = stateEvents.events.filter(
      (r) => !r.deleted_at && isStatEventType(r.event_type)
    );
    expect(statRows.map((r) => r.event_type)).toEqual(["goal"]);
  });
});

// ── computeQuarterFix — the undo descriptor ────────────────────────────────────

describe("computeQuarterFix", () => {
  const qe = (seq, from, to, deleted = false) => ({
    id: `meta-${seq}`, seq, group_id: `grp-meta-${seq}`, event_type: "quarter_end",
    quarter: null, team_idx: null, payload: { fromQuarter: from, toQuarter: to },
    deleted_at: deleted ? "2026-07-09T00:00:00Z" : null,
  });
  const goal = (seq, quarter) => ({
    id: `goal-${seq}`, seq, group_id: `grp-${seq}`, event_type: "goal",
    quarter, team_idx: 0, deleted_at: null,
  });

  it("returns null when there are no meta events", () => {
    expect(computeQuarterFix([goal(1, 1)])).toBeNull();
  });

  it("describes an accidental quarter_end with the events logged after it", () => {
    const fix = computeQuarterFix([goal(1, 1), qe(2, 1, 2), goal(3, 2), goal(4, 2)]);
    expect(fix).toEqual({
      type: "quarter_end", fromQuarter: 1, toQuarter: 2,
      restoredQuarter: 1, groupId: "grp-meta-2",
      affectedIds: ["goal-3", "goal-4"],
    });
  });

  it("restores to the replayed pre-transition quarter, not just fromQuarter", () => {
    const fix = computeQuarterFix([qe(1, 1, 2), qe(2, 2, 3)]);
    expect(fix.restoredQuarter).toBe(2);
    expect(fix.groupId).toBe("grp-meta-2");
  });

  it("skips tombstoned meta events (an already-undone transition)", () => {
    const fix = computeQuarterFix([qe(1, 1, 2), qe(2, 2, 3, true), goal(3, 2)]);
    expect(fix.type).toBe("quarter_end");
    expect(fix.groupId).toBe("grp-meta-1");
    // goal-3 is in Q2 (= toQuarter of the live transition) and after it
    expect(fix.affectedIds).toEqual(["goal-3"]);
  });

  it("returns null when the last transition is game_over (un-finalizing is out of scope)", () => {
    const rows = [qe(1, 1, 2), {
      id: "meta-2", seq: 2, group_id: "grp-meta-2", event_type: "game_over",
      quarter: null, team_idx: null, payload: { fromQuarter: 4, toQuarter: 4 }, deleted_at: null,
    }];
    expect(computeQuarterFix(rows)).toBeNull();
  });

  it("describes an override, restoring to the pre-override quarter", () => {
    const fix = computeQuarterFix([qe(1, 1, 2), {
      id: "meta-2", seq: 2, group_id: "grp-meta-2", event_type: "quarter_override",
      quarter: null, team_idx: null, payload: { fromQuarter: 2, toQuarter: 4 }, deleted_at: null,
    }, goal(3, 4)]);
    expect(fix.type).toBe("quarter_override");
    expect(fix.restoredQuarter).toBe(2);
    expect(fix.affectedIds).toEqual(["goal-3"]);
  });
});

// ── dbRowToEntry mapping stability ─────────────────────────────────────────────
// The refactor replaces the consumers of this mapping; the mapping itself must
// stay stable so historical rows keep translating identically.

describe("dbRowToEntry over fixture rows", () => {
  it("preserves identity, ordering, and event naming for every fixture row", () => {
    for (const fixture of fixtures) {
      for (const row of fixture.events) {
        const entry = dbRowToEntry(row);
        expect(entry.id).toBe(row.seq);
        expect(entry.seq).toBe(row.seq);
        expect(entry.dbId).toBe(row.id);
        expect(entry.groupId).toBe(row.group_id);
        expect(entry.event).toBe(row.event_type);
        expect(entry.teamIdx).toBe(row.team_idx);
        expect(entry.quarter).toBe(row.quarter);
      }
    }
  });

  it("translates player, time, penalty, and shot context fields", () => {
    const goal = fullGame.events.find((r) => r.seq === 201);
    expect(dbRowToEntry(goal)).toMatchObject({
      event: "goal",
      player: { num: "7", name: "Smith" },
      goalTime: "9:10",
      teamStat: false,
    });

    const penalty = fullGame.events.find((r) => r.event_type === "penalty_min");
    expect(dbRowToEntry(penalty)).toMatchObject({
      event: "penalty_min",
      penaltyTime: "5:12",
      penaltyMin: 1,
      nonReleasable: false,
      foulName: "Slashing",
    });

    const shot = basicScoring.events.find((r) => r.event_type === "shot");
    expect(dbRowToEntry(shot)).toMatchObject({
      event: "shot",
      shotOutcome: "saved",
      zone: "R2",
    });

    const emoGoal = fullGame.events.find((r) => r.is_emo);
    expect(dbRowToEntry(emoGoal).emo).toBe(true);
  });
});
