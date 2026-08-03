import { describe, it, expect } from "vitest";
import {
  buildMomentumSeries, momentumControlStats, momentumBiggestRun, momentumQuarterControl,
  momentumStoryline, momentumPointLabel, MOMENTUM_WEIGHTS, PENALTY_WEIGHT,
} from "./momentum";

let seq = 0;
function ev(teamIdx, event, overrides = {}) {
  seq++;
  return {
    id: seq, seq, groupId: `g${seq}`, teamIdx, event,
    player: { num: "1", name: "P" }, quarter: 1, ...overrides,
  };
}

describe("buildMomentumSeries", () => {
  it("returns an empty series for an empty log", () => {
    expect(buildMomentumSeries([])).toEqual([]);
    expect(buildMomentumSeries(null)).toEqual([]);
  });

  it("scores home events positive and away events negative", () => {
    const pts = buildMomentumSeries([ev(0, "goal"), ev(1, "goal")]);
    expect(pts[0].score).toBe(MOMENTUM_WEIGHTS.goal);
    expect(pts[1].score).toBe(0); // +5 then −5
  });

  it("applies the weighting matrix", () => {
    const pts = buildMomentumSeries([
      ev(0, "shot"),
      ev(0, "faceoff_win"),
      ev(0, "clear", { teamStat: true, player: null }),
      ev(0, "forced_to"),
    ]);
    expect(pts.map(p => p.score)).toEqual([1.5, 3.5, 4.5, 5.5]);
  });

  it("credits penalties to the opposing team", () => {
    const pts = buildMomentumSeries([ev(1, "penalty_min", { penaltyMin: 1 })]);
    expect(pts[0].score).toBe(PENALTY_WEIGHT); // away penalty → home momentum
    const pts2 = buildMomentumSeries([ev(0, "penalty_tech")]);
    expect(pts2[0].score).toBe(-PENALTY_WEIGHT);
  });

  it("does not double-count a goal's paired shot entry", () => {
    const shot = ev(0, "shot");
    const goal = ev(0, "goal", { groupId: shot.groupId });
    const pts = buildMomentumSeries([shot, goal]);
    expect(pts).toHaveLength(1);
    expect(pts[0].score).toBe(MOMENTUM_WEIGHTS.goal);
  });

  it("ignores non-momentum event types", () => {
    const pts = buildMomentumSeries([
      ev(0, "ground_ball"),
      ev(0, "turnover"),
      ev(0, "failed_clear", { teamStat: true, player: null }),
      ev(1, "faceoff_loss"),
      ev(0, "shot_saved"),
      ev(0, "goal_allowed"),
      ev(0, "assist"),
      ev(0, "goalie_change"),
      ev(0, "timeout", { teamStat: true, player: null }),
    ]);
    expect(pts).toEqual([]);
  });

  it("decays 10% per 30 seconds of wall-clock gap between events", () => {
    const t0 = "2026-06-11T19:00:00.000Z";
    const t1 = "2026-06-11T19:00:30.000Z"; // 30s later
    const pts = buildMomentumSeries([
      ev(0, "goal", { createdAt: t0 }),
      ev(0, "shot", { createdAt: t1 }),
    ]);
    // 5 decayed by 10% → 4.5, then +1.5
    expect(pts[1].score).toBeCloseTo(6.0, 5);
  });

  it("caps decay gaps so halftime doesn't flatten the line to zero", () => {
    const pts = buildMomentumSeries([
      ev(0, "goal", { createdAt: "2026-06-11T19:00:00.000Z" }),
      ev(0, "shot", { createdAt: "2026-06-11T21:00:00.000Z", quarter: 3 }), // 2h gap
    ]);
    // gap capped at 600s → 5 * 0.9^20 ≈ 0.608, not ~0
    expect(pts[1].score).toBeGreaterThan(1.5);
    expect(pts[1].score).toBeLessThan(1.5 + 5 * Math.pow(0.9, 20) + 0.001);
  });

  it("skips decay when timestamps are missing (legacy entries)", () => {
    const pts = buildMomentumSeries([ev(0, "goal"), ev(0, "shot")]);
    expect(pts[1].score).toBe(6.5);
  });

  it("lays points out in quarter bands", () => {
    const pts = buildMomentumSeries([
      ev(0, "goal", { quarter: 1 }),
      ev(0, "goal", { quarter: 1 }),
      ev(1, "goal", { quarter: 3 }),
    ]);
    // Q1 events sit in [0,1), Q3 event in [2,3)
    expect(pts[0].x).toBeGreaterThan(0); expect(pts[0].x).toBeLessThan(1);
    expect(pts[1].x).toBeGreaterThan(pts[0].x); expect(pts[1].x).toBeLessThan(1);
    expect(pts[2].x).toBeGreaterThan(2); expect(pts[2].x).toBeLessThan(3);
  });

  it("keeps x monotonic when seq order diverges from quarter order", () => {
    // A play entered into Q1 after Q2 was already scored (e.g. quarter_override
    // or a late correction) gets a higher seq but an earlier quarter. The series
    // must re-seat it into the Q1 band so the line never runs backward.
    const pts = buildMomentumSeries([
      ev(0, "goal", { quarter: 1 }),
      ev(0, "goal", { quarter: 2 }),
      ev(1, "goal", { quarter: 1 }), // later seq, earlier quarter
    ]);
    for (let i = 1; i < pts.length; i++) {
      expect(pts[i].x).toBeGreaterThanOrEqual(pts[i - 1].x);
    }
    // The two Q1 goals sit in band [0,1); the Q2 goal in [1,2).
    expect(pts.filter(p => p.quarter === 1).every(p => p.x < 1)).toBe(true);
    expect(pts.find(p => p.quarter === 2).x).toBeGreaterThan(1);
  });
});

describe("momentumControlStats", () => {
  it("returns a neutral 50/50 split with no lead changes for an empty series", () => {
    expect(momentumControlStats([], 4)).toEqual({ pctHome: 50, pctAway: 50, leadChanges: 0 });
    expect(momentumControlStats(null, 4)).toEqual({ pctHome: 50, pctAway: 50, leadChanges: 0 });
  });

  it("credits 100% control to the only team scoring momentum", () => {
    const pts = buildMomentumSeries([ev(0, "goal", { quarter: 1 })]);
    const stats = momentumControlStats(pts, 4);
    expect(stats.pctHome).toBe(100);
    expect(stats.pctAway).toBe(0);
    expect(stats.leadChanges).toBe(0);
  });

  it("splits control by time on each side of zero, including a zero-crossing segment", () => {
    // home goal (+5) → away goal (0) → away goal (−5), all in Q1 → x = .25, .5, .75
    const pts = buildMomentumSeries([
      ev(0, "goal", { quarter: 1 }),
      ev(1, "goal", { quarter: 1 }),
      ev(1, "goal", { quarter: 1 }),
    ]);
    const stats = momentumControlStats(pts, 4);
    // home: [0,.25] + [.25,.5] = .5 of 4 total → 12.5% → rounds to 13
    expect(stats.pctHome).toBe(13);
    expect(stats.pctAway).toBe(87);
  });

  it("counts lead changes only across genuine sign flips, skipping exact-zero points", () => {
    const pts = buildMomentumSeries([
      ev(0, "goal", { quarter: 1 }),  // score  5  (home)
      ev(1, "goal", { quarter: 1 }),  // score  0  (neutral — skipped)
      ev(1, "shot", { quarter: 1 }),  // score -1.5 (away)
      ev(0, "goal", { quarter: 1 }),  // score  3.5 (home)
    ]);
    expect(momentumControlStats(pts, 4).leadChanges).toBe(2);
  });
});

describe("momentumBiggestRun", () => {
  it("returns null for an empty series", () => {
    expect(momentumBiggestRun([])).toBeNull();
    expect(momentumBiggestRun(null)).toBeNull();
  });

  it("finds the biggest fall (away run) over the biggest rise", () => {
    // home goal (+5) → away goal (0) → away goal (−5) → away shot (−6.5),
    // all Q1. Away's fall (5 → −6.5, delta 11.5) beats home's opening
    // run (0 → 5, delta 5).
    const pts = buildMomentumSeries([
      ev(0, "goal", { quarter: 1 }),
      ev(1, "goal", { quarter: 1 }),
      ev(1, "goal", { quarter: 1 }),
      ev(1, "shot", { quarter: 1 }),
    ]);
    const run = momentumBiggestRun(pts);
    expect(run.teamIdx).toBe(1);
    expect(run.goalsFor).toBe(2);
    expect(run.goalsAgainst).toBe(0);
    expect(run.startQuarter).toBe(1);
    expect(run.endQuarter).toBe(1);
    expect(run.startX).toBe(pts[0].x);
    expect(run.endX).toBe(pts[3].x);
  });

  it("finds the biggest rise (home run) over a smaller fall", () => {
    // away goal (−5) → home goal (0) → home goal (+5) → home goal (+10).
    // Home's run (−5 → 10, delta 15) beats away's opening dip (0 → −5, delta 5).
    const pts = buildMomentumSeries([
      ev(1, "goal", { quarter: 1 }),
      ev(0, "goal", { quarter: 1 }),
      ev(0, "goal", { quarter: 1 }),
      ev(0, "goal", { quarter: 1 }),
    ]);
    const run = momentumBiggestRun(pts);
    expect(run.teamIdx).toBe(0);
    expect(run.goalsFor).toBe(3);
    expect(run.goalsAgainst).toBe(0);
  });
});

describe("momentumQuarterControl", () => {
  it("returns an empty array for an empty series", () => {
    expect(momentumQuarterControl([], 4)).toEqual([]);
  });

  it("carries control through quiet quarters with no events", () => {
    const pts = buildMomentumSeries([ev(0, "goal", { quarter: 1 })]);
    expect(momentumQuarterControl(pts, 4)).toEqual([
      { quarter: 1, leader: 0 }, { quarter: 2, leader: 0 },
      { quarter: 3, leader: 0 }, { quarter: 4, leader: 0 },
    ]);
  });

  it("splits leadership per quarter when control flips mid-game", () => {
    // Home goal in Q1, then an away barrage in Q3 that flips control for
    // the rest of the game.
    const pts = buildMomentumSeries([
      ev(0, "goal", { quarter: 1 }),
      ev(1, "goal", { quarter: 3 }),
      ev(1, "goal", { quarter: 3 }),
      ev(1, "shot", { quarter: 3 }),
    ]);
    expect(momentumQuarterControl(pts, 4)).toEqual([
      { quarter: 1, leader: 0 }, { quarter: 2, leader: 0 },
      { quarter: 3, leader: 1 }, { quarter: 4, leader: 1 },
    ]);
  });
});

describe("momentumStoryline", () => {
  it("returns null for an empty series", () => {
    expect(momentumStoryline([], 0)).toBeNull();
  });

  it("credits wire-to-wire when control never changed hands", () => {
    const pts = buildMomentumSeries([ev(0, "goal", { quarter: 1 })]);
    expect(momentumStoryline(pts, 0)).toEqual({ type: "wireToWire", teamIdx: 0 });
  });

  it("credits a comeback when the game ends on the opposite side it started", () => {
    const pts = buildMomentumSeries([
      ev(1, "goal", { quarter: 1 }),   // score −5 (away)
      ev(0, "goal", { quarter: 1 }),   // score  0
      ev(0, "goal", { quarter: 1 }),   // score  5 (home)
    ]);
    expect(momentumStoryline(pts, 1)).toEqual({ type: "comeback", teamIdx: 0 });
  });

  it("returns null when the lead flips but ends back where it started", () => {
    const pts = buildMomentumSeries([
      ev(0, "goal", { quarter: 1 }),   // score  5 (home)
      ev(1, "goal", { quarter: 1 }),   // score  0
      ev(1, "goal", { quarter: 1 }),   // score −5 (away)
      ev(0, "goal", { quarter: 1 }),   // score  0
      ev(0, "goal", { quarter: 1 }),   // score  5 (home again)
    ]);
    expect(momentumStoryline(pts, 2)).toBeNull();
  });
});

describe("momentumPointLabel", () => {
  const teams = [{ name: "Home" }, { name: "Away" }];

  it("includes quarter, clock, event, and player", () => {
    const pts = buildMomentumSeries([
      ev(0, "goal", { quarter: 3, goalTime: "8:12", player: { num: "4", name: "Smith" } }),
    ]);
    expect(momentumPointLabel(pts[0], teams)).toBe("Q3 8:12 · 🥍 Goal — #4 Smith");
  });

  it("falls back to the team name for team stats", () => {
    const pts = buildMomentumSeries([ev(0, "clear", { teamStat: true, player: null })]);
    expect(momentumPointLabel(pts[0], teams)).toBe("Q1 · ⬆️ Successful Clear — Home");
  });
});
