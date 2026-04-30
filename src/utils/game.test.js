import { describe, it, expect } from "vitest";
import { formatDate, formatDateLong, formatDateTime, getLatestTime, getGameInfo } from "./game";

// ── formatDate ─────────────────────────────────────────────────────────────────

describe("formatDate", () => {
  it("formats a YYYY-MM-DD string as short date", () => {
    expect(formatDate("2026-04-29")).toBe("Apr 29, 2026");
  });

  it("formats the first of January correctly", () => {
    expect(formatDate("2026-01-01")).toBe("Jan 1, 2026");
  });

  it("does not roll back a day for YYYY-MM-DD input (UTC midnight trap)", () => {
    // Without the T12:00:00 fix, "2026-04-01" parsed as UTC midnight would
    // show March 31 in timezones behind UTC.
    const result = formatDate("2026-04-01");
    expect(result).toBe("Apr 1, 2026");
  });

  it("handles ISO string with time component", () => {
    const result = formatDate("2026-06-15T20:00:00.000Z");
    expect(result).toMatch(/Jun|15|2026/);
  });
});

// ── formatDateLong ─────────────────────────────────────────────────────────────

describe("formatDateLong", () => {
  it("formats a YYYY-MM-DD string with full month name", () => {
    expect(formatDateLong("2026-04-29")).toBe("April 29, 2026");
  });

  it("formats January with full month name", () => {
    expect(formatDateLong("2026-01-01")).toBe("January 1, 2026");
  });

  it("does not roll back a day for YYYY-MM-DD input", () => {
    expect(formatDateLong("2026-03-01")).toBe("March 1, 2026");
  });
});

// ── formatDateTime ─────────────────────────────────────────────────────────────

describe("formatDateTime", () => {
  it("includes month, day, year in output", () => {
    const result = formatDateTime("2026-04-29T15:30:00.000Z");
    expect(result).toMatch(/2026/);
    expect(result).toMatch(/29/);
  });

  it("includes time component in output", () => {
    const result = formatDateTime("2026-04-29T15:30:00.000Z");
    expect(result).toMatch(/:/);
  });
});

// ── getLatestTime ──────────────────────────────────────────────────────────────

describe("getLatestTime", () => {
  it("returns null for null state", () => {
    expect(getLatestTime(null)).toBeNull();
  });

  it("returns null when log is empty", () => {
    expect(getLatestTime({ log: [], currentQuarter: 1 })).toBeNull();
  });

  it("returns null when no timed entries in current quarter", () => {
    const state = {
      currentQuarter: 2,
      log: [{ event: "goal", quarter: 1, goalTime: "10:00" }],
    };
    expect(getLatestTime(state)).toBeNull();
  });

  it("returns the single timed entry in the current quarter", () => {
    const state = {
      currentQuarter: 1,
      log: [{ event: "goal", quarter: 1, goalTime: "8:30" }],
    };
    expect(getLatestTime(state)).toBe("8:30");
  });

  it("returns the minimum time (most elapsed) among multiple timed entries", () => {
    const state = {
      currentQuarter: 1,
      log: [
        { event: "goal",    quarter: 1, goalTime:    "10:00" },
        { event: "goal",    quarter: 1, goalTime:    "6:00"  },
        { event: "timeout", quarter: 1, timeoutTime: "3:00"  },
      ],
    };
    // "3:00" has the fewest seconds remaining → most elapsed time
    expect(getLatestTime(state)).toBe("3:00");
  });

  it("uses goalTime, timeoutTime, and penaltyTime as time sources", () => {
    const state = {
      currentQuarter: 1,
      log: [
        { event: "penalty_min", quarter: 1, penaltyTime: "5:00" },
        { event: "timeout",     quarter: 1, timeoutTime: "7:00" },
      ],
    };
    expect(getLatestTime(state)).toBe("5:00");
  });

  it("ignores entries from other quarters", () => {
    const state = {
      currentQuarter: 2,
      log: [
        { event: "goal", quarter: 1, goalTime: "2:00" },
        { event: "goal", quarter: 2, goalTime: "9:00" },
      ],
    };
    expect(getLatestTime(state)).toBe("9:00");
  });

  it("ignores entries without time fields", () => {
    const state = {
      currentQuarter: 1,
      log: [
        { event: "clear", quarter: 1 },
        { event: "goal",  quarter: 1, goalTime: "5:00" },
      ],
    };
    expect(getLatestTime(state)).toBe("5:00");
  });

  it("returns null when currentQuarter is missing", () => {
    expect(getLatestTime({ log: [{ event: "goal", quarter: 1, goalTime: "5:00" }] })).toBeNull();
  });
});

// ── getGameInfo ────────────────────────────────────────────────────────────────

describe("getGameInfo", () => {
  function makeGame(stateOverrides = {}) {
    return {
      created_at: "2026-01-15T00:00:00.000Z",
      state: {
        teams: [
          { name: "Home", roster: "", color: "#1a6bab" },
          { name: "Away", roster: "", color: "#b84e1a" },
        ],
        log: [],
        currentQuarter: 1,
        trackingStarted: true,
        gameOver: false,
        gameDate: "2026-01-15",
        ...stateOverrides,
      },
    };
  }

  it("returns null when state has no teams", () => {
    expect(getGameInfo({ state: null })).toBeNull();
    expect(getGameInfo({ state: {} })).toBeNull();
  });

  it("maps team objects correctly", () => {
    const info = getGameInfo(makeGame());
    expect(info.t0.name).toBe("Home");
    expect(info.t1.name).toBe("Away");
  });

  it("counts goals per team", () => {
    const info = getGameInfo(makeGame({
      log: [
        { event: "goal", teamIdx: 0 },
        { event: "goal", teamIdx: 0 },
        { event: "goal", teamIdx: 1 },
      ],
    }));
    expect(info.score0).toBe(2);
    expect(info.score1).toBe(1);
  });

  it("ignores non-goal events in score count", () => {
    const info = getGameInfo(makeGame({
      log: [
        { event: "shot",  teamIdx: 0 },
        { event: "clear", teamIdx: 0 },
        { event: "goal",  teamIdx: 1 },
      ],
    }));
    expect(info.score0).toBe(0);
    expect(info.score1).toBe(1);
  });

  it("reports started as true when trackingStarted is truthy", () => {
    expect(getGameInfo(makeGame({ trackingStarted: true })).started).toBe(true);
    expect(getGameInfo(makeGame({ trackingStarted: false })).started).toBe(false);
  });

  it("reports gameOver correctly", () => {
    expect(getGameInfo(makeGame({ gameOver: true })).gameOver).toBe(true);
    expect(getGameInfo(makeGame({ gameOver: false })).gameOver).toBe(false);
  });

  it("reports currentQuarter from state", () => {
    expect(getGameInfo(makeGame({ currentQuarter: 3 })).currentQuarter).toBe(3);
  });

  it("defaults currentQuarter to 1 when missing", () => {
    const game = makeGame();
    delete game.state.currentQuarter;
    expect(getGameInfo(game).currentQuarter).toBe(1);
  });

  it("reports gameDate from state", () => {
    expect(getGameInfo(makeGame({ gameDate: "2026-05-01" })).gameDate).toBe("2026-05-01");
  });

  it("falls back to created_at date when gameDate is absent", () => {
    const game = makeGame();
    delete game.state.gameDate;
    expect(getGameInfo(game).gameDate).toBe("2026-01-15");
  });

  it("returns latestTime from timed entries in current quarter", () => {
    const info = getGameInfo(makeGame({
      currentQuarter: 1,
      log: [{ event: "goal", quarter: 1, goalTime: "6:30" }],
    }));
    expect(info.latestTime).toBe("6:30");
  });

  it("returns null latestTime when log has no timed entries", () => {
    expect(getGameInfo(makeGame()).latestTime).toBeNull();
  });
});
