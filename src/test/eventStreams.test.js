import { describe, it, expect } from "vitest";
import { deriveQuarterState } from "../services/gameEvents";
import { dbRowToEntry } from "../hooks/useGameLog";
import { getGameInfo } from "../utils/game";

import emptyPretracking from "./fixtures/eventStreams/empty-pretracking.json";
import basicScoring from "./fixtures/eventStreams/basic-scoring.json";
import fullGame from "./fixtures/eventStreams/full-game.json";
import overtime from "./fixtures/eventStreams/overtime.json";
import quarterAnomalies from "./fixtures/eventStreams/quarter-anomalies.json";
import legacyStateOnly from "./fixtures/eventStreams/legacy-state-only.json";

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
];

// Mirrors fetchGameEvents' `.is("deleted_at", null)` filter.
const liveRows = (fixture) => fixture.events.filter((row) => !row.deleted_at);

describe.each(fixtures)("event stream fixture: $name", (fixture) => {
  it("replays meta events to the expected quarter state", () => {
    const derived = deriveQuarterState(fixture.metaEvents);
    expect(derived).toEqual(fixture.expected.quarterState);
  });

  it("derives scores from live events (Scorekeeper save / getGameInfo recompute expression)", () => {
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
