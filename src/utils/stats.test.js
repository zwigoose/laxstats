import { describe, it, expect } from "vitest";
import {
  qLabel, isOT, toSecs, qLenSecs,
  absElapsedSecs, absSecsToQtrTime,
  penaltyDurSecs,
  parseRoster, findDuplicateNums,
  buildPlayerStats, buildTeamTotals,
  computePenaltyWindows,
  getTimeoutsLeft,
  entryDisplayInfo,
} from "./stats";

// ── Helpers ───────────────────────────────────────────────────────────────────

function mkEntry(teamIdx, event, num = "1", name = "Player", groupId = "g1", extra = {}) {
  return { teamIdx, event, player: { num, name }, groupId, teamStat: false, ...extra };
}

function mkPenalty(teamIdx, event, quarter, penaltyTime, num = "1", extra = {}) {
  return mkEntry(teamIdx, event, num, `P${num}`, `g-pen-${num}`, {
    quarter, penaltyTime,
    penaltyMin: event === "penalty_min" ? (extra.penaltyMin ?? 1) : undefined,
    ...extra,
  });
}

// ── qLabel ────────────────────────────────────────────────────────────────────

describe("qLabel", () => {
  it("labels regular quarters Q1–Q4", () => {
    expect(qLabel(1)).toBe("Q1");
    expect(qLabel(4)).toBe("Q4");
  });

  it("labels overtime periods OT1, OT2, OT3", () => {
    expect(qLabel(5)).toBe("OT1");
    expect(qLabel(6)).toBe("OT2");
    expect(qLabel(7)).toBe("OT3");
  });
});

// ── isOT ──────────────────────────────────────────────────────────────────────

describe("isOT", () => {
  it("returns false for regulation quarters", () => {
    expect(isOT(1)).toBe(false);
    expect(isOT(4)).toBe(false);
  });

  it("returns true for OT quarters", () => {
    expect(isOT(5)).toBe(true);
    expect(isOT(6)).toBe(true);
  });
});

// ── toSecs ────────────────────────────────────────────────────────────────────

describe("toSecs", () => {
  it("converts MM:SS to total seconds", () => {
    expect(toSecs("0:00")).toBe(0);
    expect(toSecs("1:30")).toBe(90);
    expect(toSecs("12:00")).toBe(720);
    expect(toSecs("3:45")).toBe(225);
  });
});

// ── qLenSecs ──────────────────────────────────────────────────────────────────

describe("qLenSecs", () => {
  it("returns 720 for regulation quarters", () => {
    expect(qLenSecs(1)).toBe(720);
    expect(qLenSecs(4)).toBe(720);
  });

  it("returns 240 for OT periods", () => {
    expect(qLenSecs(5)).toBe(240);
    expect(qLenSecs(6)).toBe(240);
  });
});

// ── absElapsedSecs / absSecsToQtrTime ─────────────────────────────────────────

describe("absElapsedSecs", () => {
  it("returns 0 at start of Q1 (12:00 remaining)", () => {
    expect(absElapsedSecs(1, 720)).toBe(0);
  });

  it("returns 720 at end of Q1 (0:00 remaining)", () => {
    expect(absElapsedSecs(1, 0)).toBe(720);
  });

  it("returns 720 at start of Q2", () => {
    expect(absElapsedSecs(2, 720)).toBe(720);
  });

  it("returns 2880 at start of Q5 / OT1", () => {
    expect(absElapsedSecs(5, 240)).toBe(2880);
  });

  it("returns 3120 at end of OT1", () => {
    expect(absElapsedSecs(5, 0)).toBe(3120);
  });
});

describe("absSecsToQtrTime", () => {
  it("maps 0 abs seconds to start of Q1", () => {
    expect(absSecsToQtrTime(0)).toEqual({ q: 1, remainSecs: 720 });
  });

  it("maps 720 abs seconds to end of Q1 (boundary belongs to current quarter)", () => {
    expect(absSecsToQtrTime(720)).toEqual({ q: 1, remainSecs: 0 });
  });

  it("maps 2880 to end of Q4 (boundary belongs to current quarter)", () => {
    expect(absSecsToQtrTime(2880)).toEqual({ q: 4, remainSecs: 0 });
  });
});

describe("absElapsedSecs / absSecsToQtrTime roundtrip", () => {
  const cases = [
    { q: 1, remain: 600 },
    { q: 2, remain: 360 },
    { q: 3, remain: 0 },
    { q: 4, remain: 180 },
    { q: 5, remain: 120 },
  ];

  cases.forEach(({ q, remain }) => {
    it(`roundtrips Q${q} remain=${remain}`, () => {
      const abs = absElapsedSecs(q, remain);
      expect(absSecsToQtrTime(abs)).toEqual({ q, remainSecs: remain });
    });
  });
});

// ── penaltyDurSecs ────────────────────────────────────────────────────────────

describe("penaltyDurSecs", () => {
  it("returns 30s for technical fouls", () => {
    expect(penaltyDurSecs({ event: "penalty_tech" })).toBe(30);
  });

  it("returns 60s for 1-minute personal foul", () => {
    expect(penaltyDurSecs({ event: "penalty_min", penaltyMin: 1 })).toBe(60);
  });

  it("returns 120s for 2-minute personal foul", () => {
    expect(penaltyDurSecs({ event: "penalty_min", penaltyMin: 2 })).toBe(120);
  });

  it("defaults to 60s when penaltyMin is missing", () => {
    expect(penaltyDurSecs({ event: "penalty_min" })).toBe(60);
  });
});

// ── parseRoster ───────────────────────────────────────────────────────────────

describe("parseRoster", () => {
  it("parses '#num name' format", () => {
    expect(parseRoster("#22 John Smith")).toEqual([{ num: "22", name: "John Smith" }]);
  });

  it("parses 'num name' format without #", () => {
    expect(parseRoster("7 Alice Jones")).toEqual([{ num: "7", name: "Alice Jones" }]);
  });

  it("parses 'name #num' format", () => {
    expect(parseRoster("Bob Clark #10")).toEqual([{ num: "10", name: "Bob Clark" }]);
  });

  it("parses number-only line as name=#num", () => {
    expect(parseRoster("5")).toEqual([{ num: "5", name: "#5" }]);
  });

  it("parses name-only line with empty num", () => {
    expect(parseRoster("GoalieNoNumber")).toEqual([{ num: "", name: "GoalieNoNumber" }]);
  });

  it("ignores blank lines", () => {
    expect(parseRoster("1 Alice\n\n3 Bob")).toHaveLength(2);
  });

  it("sorts by jersey number ascending", () => {
    const result = parseRoster("22 Alice\n3 Bob\n10 Carol");
    expect(result.map(p => p.num)).toEqual(["3", "10", "22"]);
  });

  it("returns empty array for empty string", () => {
    expect(parseRoster("")).toEqual([]);
  });
});

// ── findDuplicateNums ─────────────────────────────────────────────────────────

describe("findDuplicateNums", () => {
  it("returns empty array when no duplicates", () => {
    expect(findDuplicateNums("1 Alice\n2 Bob")).toEqual([]);
  });

  it("detects a single duplicate number", () => {
    expect(findDuplicateNums("5 Alice\n5 Bob")).toContain("#5");
  });

  it("returns empty array for null/undefined input", () => {
    expect(findDuplicateNums(null)).toEqual([]);
    expect(findDuplicateNums(undefined)).toEqual([]);
  });

  it("ignores number-less entries", () => {
    expect(findDuplicateNums("GoalieA\nGoalieB")).toEqual([]);
  });
});

// ── buildPlayerStats ──────────────────────────────────────────────────────────

describe("buildPlayerStats", () => {
  it("counts goals and increments sog", () => {
    const entries = [mkEntry(0, "goal", "7", "Alice", "g1")];
    const stats = buildPlayerStats(entries);
    expect(stats).toHaveLength(1);
    expect(stats[0].goal).toBe(1);
    expect(stats[0].sog).toBe(1);
  });

  it("counts EMO goals separately", () => {
    const entries = [mkEntry(0, "goal", "7", "Alice", "g1", { emo: true })];
    const stats = buildPlayerStats(entries);
    expect(stats[0].emo_goal).toBe(1);
    expect(stats[0].goal).toBe(1);
  });

  it("increments sog for shot that was saved (group contains shot_saved)", () => {
    const entries = [
      mkEntry(0, "shot", "7", "Alice", "g1"),
      mkEntry(1, "shot_saved", "99", "Goalie", "g1"),
    ];
    const stats = buildPlayerStats(entries);
    const shooter = stats.find(s => s.player.num === "7");
    expect(shooter.shot).toBe(1);
    expect(shooter.sog).toBe(1);
  });

  it("does NOT increment sog for shot with no save in group", () => {
    const entries = [mkEntry(0, "shot", "7", "Alice", "g1")];
    const stats = buildPlayerStats(entries);
    expect(stats[0].sog).toBe(0);
  });

  it("counts ground balls", () => {
    const entries = [mkEntry(0, "ground_ball", "7", "Alice", "g1")];
    const stats = buildPlayerStats(entries);
    expect(stats[0].ground_ball).toBe(1);
  });

  it("accumulates penalty_min minutes (not count)", () => {
    const entries = [
      mkEntry(0, "penalty_min", "7", "Alice", "g1", { penaltyMin: 2 }),
      mkEntry(0, "penalty_min", "7", "Alice", "g2", { penaltyMin: 1 }),
    ];
    const stats = buildPlayerStats(entries);
    expect(stats[0].penalty_min).toBe(3);
  });

  it("counts penalty_tech", () => {
    const entries = [mkEntry(0, "penalty_tech", "7", "Alice", "g1")];
    const stats = buildPlayerStats(entries);
    expect(stats[0].penalty_tech).toBe(1);
  });

  it("skips teamStat entries", () => {
    const entries = [{ ...mkEntry(0, "clear", "0", "Team", "g1"), teamStat: true }];
    expect(buildPlayerStats(entries)).toHaveLength(0);
  });

  it("aggregates multiple events for same player", () => {
    const entries = [
      mkEntry(0, "goal", "7", "Alice", "g1"),
      mkEntry(0, "goal", "7", "Alice", "g2"),
      mkEntry(0, "ground_ball", "7", "Alice", "g3"),
    ];
    const stats = buildPlayerStats(entries);
    expect(stats).toHaveLength(1);
    expect(stats[0].goal).toBe(2);
    expect(stats[0].ground_ball).toBe(1);
  });

  it("separates stats by team", () => {
    const entries = [
      mkEntry(0, "goal", "7", "Alice", "g1"),
      mkEntry(1, "goal", "7", "Bob", "g2"),
    ];
    const stats = buildPlayerStats(entries);
    expect(stats).toHaveLength(2);
    expect(stats.filter(s => s.teamIdx === 0)).toHaveLength(1);
    expect(stats.filter(s => s.teamIdx === 1)).toHaveLength(1);
  });
});

// ── buildTeamTotals ───────────────────────────────────────────────────────────

describe("buildTeamTotals", () => {
  it("returns two totals objects", () => {
    expect(buildTeamTotals([])).toHaveLength(2);
  });

  it("counts goals per team", () => {
    const entries = [
      mkEntry(0, "goal"), mkEntry(0, "goal"),
      mkEntry(1, "goal"),
    ];
    const [t0, t1] = buildTeamTotals(entries);
    expect(t0.goal).toBe(2);
    expect(t1.goal).toBe(1);
  });

  it("computes sog = own goals + opponent saves", () => {
    const entries = [
      mkEntry(0, "goal", "1", "A", "g1"),
      mkEntry(1, "shot_saved", "99", "GK", "g2"),
    ];
    const [t0] = buildTeamTotals(entries);
    expect(t0.sog).toBe(2);
  });

  it("maps successful_ride to opponent failed_clear", () => {
    const entries = [mkEntry(1, "failed_clear", "1", "A", "g1")];
    const [t0] = buildTeamTotals(entries);
    expect(t0.successful_ride).toBe(1);
  });

  it("maps failed_ride to opponent clear", () => {
    const entries = [mkEntry(1, "clear", "1", "A", "g1")];
    const [t0] = buildTeamTotals(entries);
    expect(t0.failed_ride).toBe(1);
  });

  it("counts mdd_fail as opponent emo goals", () => {
    const entries = [mkEntry(1, "goal", "1", "A", "g1", { emo: true })];
    const [t0] = buildTeamTotals(entries);
    expect(t0.mdd_fail).toBe(1);
  });

  it("counts emo_fail as opponent mdd_success", () => {
    const entries = [
      { ...mkEntry(1, "mdd_success", "1", "A", "g1"), teamStat: true },
    ];
    const [t0] = buildTeamTotals(entries);
    expect(t0.emo_fail).toBe(1);
  });

  it("accumulates penalty_min minutes", () => {
    const entries = [
      mkEntry(0, "penalty_min", "1", "A", "g1", { penaltyMin: 2 }),
      mkEntry(0, "penalty_min", "2", "B", "g2", { penaltyMin: 1 }),
    ];
    const [t0] = buildTeamTotals(entries);
    expect(t0.penalty_min).toBe(3);
  });
});

// ── computePenaltyWindows ─────────────────────────────────────────────────────

describe("computePenaltyWindows", () => {
  it("returns empty array for no penalties", () => {
    expect(computePenaltyWindows([])).toEqual([]);
  });

  it("creates a single window for a solo technical", () => {
    const log = [mkPenalty(0, "penalty_tech", 1, "6:00")];
    const windows = computePenaltyWindows(log);
    expect(windows).toHaveLength(1);
    const w = windows[0];
    expect(w.absEnd - w.absStart).toBe(30);
  });

  it("creates a window of correct duration for 1-min personal", () => {
    const log = [mkPenalty(0, "penalty_min", 1, "6:00", "1", { penaltyMin: 1 })];
    const windows = computePenaltyWindows(log);
    expect(windows[0].absEnd - windows[0].absStart).toBe(60);
  });

  it("nrEnd equals absEnd when no simultaneous opposing penalty", () => {
    const log = [mkPenalty(0, "penalty_min", 1, "6:00", "1", { penaltyMin: 1 })];
    const [w] = computePenaltyWindows(log);
    expect(w.nrEnd).toBe(w.absStart);
  });

  it("extends nrEnd to overlap end when opposing teams have simultaneous penalties", () => {
    const log = [
      mkPenalty(0, "penalty_min", 1, "6:00", "1", { penaltyMin: 1 }),
      mkPenalty(1, "penalty_min", 1, "6:00", "2", { penaltyMin: 1 }),
    ];
    const windows = computePenaltyWindows(log);
    const w0 = windows.find(w => w.entry.teamIdx === 0);
    const w1 = windows.find(w => w.entry.teamIdx === 1);
    expect(w0.nrEnd).toBe(w0.absEnd);
    expect(w1.nrEnd).toBe(w1.absEnd);
  });

  it("does not extend nrEnd for non-releasable base penalties", () => {
    const log = [
      mkPenalty(0, "penalty_min", 1, "6:00", "1", { penaltyMin: 2, nonReleasable: true }),
      mkPenalty(1, "penalty_min", 1, "6:00", "2", { penaltyMin: 1 }),
    ];
    const windows = computePenaltyWindows(log);
    const nrWindow = windows.find(w => w.entry.nonReleasable);
    expect(nrWindow.isNRBase).toBe(true);
    expect(nrWindow.nrEnd).toBe(nrWindow.absEnd);
  });

  it("sequences stacked penalties for the same player", () => {
    const p1 = mkPenalty(0, "penalty_min", 1, "6:00", "1", { penaltyMin: 1 });
    const p2 = { ...mkPenalty(0, "penalty_tech", 1, "6:00", "1"), groupId: "g-pen-1b" };
    const log = [p1, p2];
    const windows = computePenaltyWindows(log);
    const sorted = windows
      .filter(w => w.entry.teamIdx === 0)
      .sort((a, b) => a.absStart - b.absStart);
    expect(sorted[1].absStart).toBe(sorted[0].absEnd);
  });
});

// ── getTimeoutsLeft ───────────────────────────────────────────────────────────

describe("getTimeoutsLeft", () => {
  it("starts at 2 for each team in Q1–Q2 period with no timeouts used", () => {
    expect(getTimeoutsLeft([], 1)).toEqual([2, 2]);
    expect(getTimeoutsLeft([], 2)).toEqual([2, 2]);
  });

  it("starts at 2 for each team in Q3–Q4 period", () => {
    expect(getTimeoutsLeft([], 3)).toEqual([2, 2]);
    expect(getTimeoutsLeft([], 4)).toEqual([2, 2]);
  });

  it("starts at 1 per team in OT", () => {
    expect(getTimeoutsLeft([], 5)).toEqual([1, 1]);
  });

  it("decrements correctly for team 0 timeout in Q1", () => {
    const log = [{ event: "timeout", teamIdx: 0, quarter: 1 }];
    expect(getTimeoutsLeft(log, 1)).toEqual([1, 2]);
  });

  it("timeout used in Q1 counts against Q2 period", () => {
    const log = [{ event: "timeout", teamIdx: 0, quarter: 1 }];
    expect(getTimeoutsLeft(log, 2)).toEqual([1, 2]);
  });

  it("timeout used in Q1 does NOT count against Q3–Q4 period", () => {
    const log = [{ event: "timeout", teamIdx: 0, quarter: 1 }];
    expect(getTimeoutsLeft(log, 3)).toEqual([2, 2]);
  });

  it("never goes below 0", () => {
    const log = [
      { event: "timeout", teamIdx: 0, quarter: 1 },
      { event: "timeout", teamIdx: 0, quarter: 2 },
      { event: "timeout", teamIdx: 0, quarter: 2 },
    ];
    const [t0] = getTimeoutsLeft(log, 2);
    expect(t0).toBe(0);
  });
});

// ── entryDisplayInfo ──────────────────────────────────────────────────────────

describe("entryDisplayInfo", () => {
  it("returns icon and label for known event types", () => {
    const info = entryDisplayInfo({ event: "goal", player: { num: "7", name: "Alice" } });
    expect(info.icon).toBe("🥍");
    expect(info.label).toBe("Goal");
    expect(info.player).toEqual({ num: "7", name: "Alice" });
  });

  it("returns save label for shot_saved", () => {
    const info = entryDisplayInfo({ event: "shot_saved", player: { num: "99", name: "GK" } });
    expect(info.icon).toBe("🧤");
    expect(info.label).toBe("Save");
  });

  it("formats penalty_tech with foul name when present", () => {
    const info = entryDisplayInfo({ event: "penalty_tech", foulName: "Holding", player: {} });
    expect(info.label).toBe("Holding (Technical)");
  });

  it("formats penalty_tech without foul name as generic", () => {
    const info = entryDisplayInfo({ event: "penalty_tech", player: {} });
    expect(info.label).toBe("Technical foul");
  });

  it("formats penalty_min with foul name and minutes", () => {
    const info = entryDisplayInfo({ event: "penalty_min", foulName: "Slashing", penaltyMin: 2, player: {} });
    expect(info.label).toBe("Slashing (2min)");
  });

  it("formats penalty_min without foul name as generic", () => {
    const info = entryDisplayInfo({ event: "penalty_min", penaltyMin: 1, player: {} });
    expect(info.label).toBe("Personal foul (1min)");
  });

  it("labels EMO goals correctly", () => {
    const info = entryDisplayInfo({ event: "goal", emo: true, player: {} });
    expect(info.label).toBe("Goal (EMO)");
  });

  it("returns null player for teamStat entries", () => {
    const info = entryDisplayInfo({ event: "clear", teamStat: true, player: { num: "0", name: "Team" } });
    expect(info.player).toBeNull();
  });

  it("falls back to bullet icon for unknown event types", () => {
    const info = entryDisplayInfo({ event: "unknown_event", player: {} });
    expect(info.icon).toBe("•");
  });
});
