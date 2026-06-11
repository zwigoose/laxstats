import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import LaxStats from "./index";

// ── Helpers shared across suites ─────────────────────────────────────────────

function trackingInitialState(logOverrides = []) {
  return {
    version: 1,
    teams: [
      { name: "Home", roster: Array.from({ length: 10 }, (_, i) => `#${i + 1} Player${i + 1}`).join("\n"), color: "#1a6bab" },
      { name: "Away", roster: Array.from({ length: 10 }, (_, i) => `#${i + 11} Player${i + 11}`).join("\n"), color: "#b84e1a" },
    ],
    log: logOverrides,
    currentQuarter: 1,
    completedQuarters: [],
    gameOver: false,
    trackingStarted: true,
    gameDate: "2026-01-01",
  };
}

// ── Supabase mock ──────────────────────────────────────────────────────────────

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order:  vi.fn().mockResolvedValue({ data: [] }),
      eq:     vi.fn().mockReturnThis(),
    }),
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function roster(n = 10) {
  return Array.from({ length: n }, (_, i) => `#${i + 1} Player${i + 1}`).join("\n");
}

function renderLaxStats(props = {}) {
  return render(<LaxStats {...props} />);
}

async function fillRosters(home = roster(), away = roster()) {
  const textareas = screen.getAllByPlaceholderText(/First Last/);
  fireEvent.change(textareas[0], { target: { value: home } });
  fireEvent.change(textareas[1], { target: { value: away } });
}

async function startTracking() {
  await fillRosters();
  await waitFor(() => expect(screen.getByText("Start Tracking →")).not.toBeDisabled());
  fireEvent.click(screen.getByText("Start Tracking →"));
}

// Distinct away roster (#11–#20) so cross-team selections are unambiguous
async function startTrackingDistinct() {
  const away = Array.from({ length: 10 }, (_, i) => `#${i + 11} Player${i + 11}`).join("\n");
  await fillRosters(roster(), away);
  await waitFor(() => expect(screen.getByText("Start Tracking →")).not.toBeDisabled());
  fireEvent.click(screen.getByText("Start Tracking →"));
}

// ── Setup screen ───────────────────────────────────────────────────────────────

describe("LaxStats — setup screen", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders setup screen by default", async () => {
    renderLaxStats();
    await waitFor(() => expect(screen.getByText("Start Tracking →")).toBeInTheDocument());
  });

  it("shows Home and Away team name inputs", async () => {
    renderLaxStats();
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Home team name")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Away team name")).toBeInTheDocument();
    });
  });

  it("shows roster textareas", async () => {
    renderLaxStats();
    await waitFor(() => {
      const textareas = screen.getAllByPlaceholderText(/First Last/);
      expect(textareas).toHaveLength(2);
    });
  });

  it("Start Tracking button is disabled with empty rosters", async () => {
    renderLaxStats();
    await waitFor(() => expect(screen.getByText("Start Tracking →")).toBeDisabled());
  });

  it("Start Tracking button is disabled with fewer than 10 players per team", async () => {
    renderLaxStats();
    await waitFor(() => screen.getAllByPlaceholderText(/First Last/));
    await fillRosters(roster(9), roster(9));
    expect(screen.getByText("Start Tracking →")).toBeDisabled();
  });

  it("shows 'Both teams need at least 10 players' when partially filled", async () => {
    renderLaxStats();
    await waitFor(() => screen.getAllByPlaceholderText(/First Last/));
    await fillRosters(roster(5), roster(5));
    await waitFor(() =>
      expect(screen.getByText(/Both teams need at least 10 players/)).toBeInTheDocument()
    );
  });

  it("Start Tracking button enabled when both rosters have 10+ players", async () => {
    renderLaxStats();
    await waitFor(() => screen.getAllByPlaceholderText(/First Last/));
    await fillRosters(roster(10), roster(10));
    await waitFor(() => expect(screen.getByText("Start Tracking →")).not.toBeDisabled());
  });

  it("shows duplicate number warning when roster has dupes", async () => {
    renderLaxStats();
    await waitFor(() => screen.getAllByPlaceholderText(/First Last/));
    const dupeRoster = "#1 Alice\n#1 Bob\n" + roster(10);
    await fillRosters(dupeRoster, roster(10));
    await waitFor(() => {
      const warnings = screen.getAllByText(/Duplicate number/i);
      expect(warnings.length).toBeGreaterThan(0);
    });
  });
});

// ── Track screen ───────────────────────────────────────────────────────────────

describe("LaxStats — track screen", () => {
  beforeEach(() => vi.clearAllMocks());

  it("navigates to track screen after clicking Start Tracking", async () => {
    renderLaxStats();
    await waitFor(() => screen.getAllByPlaceholderText(/First Last/));
    await act(async () => { await startTracking(); });
    expect(screen.getByText(/Who scored \/ acted\?/)).toBeInTheDocument();
  });

  it("shows both team buttons on team select step", async () => {
    renderLaxStats();
    await waitFor(() => screen.getAllByPlaceholderText(/First Last/));
    await act(async () => { await startTracking(); });
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Away")).toBeInTheDocument();
  });

  it("shows End Quarter button for primary scorer", async () => {
    renderLaxStats();
    await waitFor(() => screen.getAllByPlaceholderText(/First Last/));
    await act(async () => { await startTracking(); });
    expect(screen.getByText(/End Q1/)).toBeInTheDocument();
  });

  it("shows 'Primary controls quarter' for secondary scorer", async () => {
    renderLaxStats({ scorekeeperRole: "secondary" });
    await waitFor(() => screen.getAllByPlaceholderText(/First Last/));
    await act(async () => { await startTracking(); });
    expect(screen.getByText(/Primary controls quarter/)).toBeInTheDocument();
  });

  it("navigates to event step after selecting a team", async () => {
    renderLaxStats();
    await waitFor(() => screen.getAllByPlaceholderText(/First Last/));
    await act(async () => { await startTracking(); });
    fireEvent.click(screen.getByText("Home"));
    expect(screen.getByText(/Recording event for/)).toBeInTheDocument();
  });

  it("shows Back button on event step", async () => {
    renderLaxStats();
    await waitFor(() => screen.getAllByPlaceholderText(/First Last/));
    await act(async () => { await startTracking(); });
    fireEvent.click(screen.getByText("Home"));
    expect(screen.getByText("← Back")).toBeInTheDocument();
  });

  it("Back button from event step returns to team step", async () => {
    renderLaxStats();
    await waitFor(() => screen.getAllByPlaceholderText(/First Last/));
    await act(async () => { await startTracking(); });
    fireEvent.click(screen.getByText("Home"));
    fireEvent.click(screen.getByText("← Back"));
    expect(screen.getByText(/Who scored \/ acted\?/)).toBeInTheDocument();
  });

  it("navigates to player step after selecting a non-team-stat event", async () => {
    renderLaxStats();
    await waitFor(() => screen.getAllByPlaceholderText(/First Last/));
    await act(async () => { await startTracking(); });
    fireEvent.click(screen.getByText("Home"));
    fireEvent.click(screen.getByText("Goal"));
    expect(screen.getByText(/Goal — Which player\?/)).toBeInTheDocument();
  });

  it("shows player list for selected team on player step", async () => {
    renderLaxStats();
    await waitFor(() => screen.getAllByPlaceholderText(/First Last/));
    await act(async () => { await startTracking(); });
    fireEvent.click(screen.getByText("Home"));
    fireEvent.click(screen.getByText("Goal"));
    expect(screen.getByText("#1")).toBeInTheDocument();
  });
});

// ── Faceoff flow (both participants → winner → GB follow-up) ─────────────────

describe("LaxStats — faceoff flow", () => {
  beforeEach(() => vi.clearAllMocks());

  // Walk: team step → 🔄 Faceoff → home #1 → away #11 → winner = home
  async function navigateToFaceoffGB() {
    const utils = renderLaxStats({ onStateChange: vi.fn() });
    await waitFor(() => screen.getAllByPlaceholderText(/First Last/));
    await act(async () => { await startTrackingDistinct(); });
    fireEvent.click(screen.getByText("🔄 Faceoff"));
    expect(screen.getByText(/Faceoff — Home player/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("#1"));
    expect(screen.getByText(/Faceoff — Away player/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("#11"));
    expect(screen.getByText(/Who won the faceoff/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Player1")); // home participant button
    return utils;
  }

  it("removed Faceoff W from the team → event grid", async () => {
    renderLaxStats();
    await waitFor(() => screen.getAllByPlaceholderText(/First Last/));
    await act(async () => { await startTrackingDistinct(); });
    fireEvent.click(screen.getByText("Home"));
    expect(screen.queryByText("Faceoff W")).not.toBeInTheDocument();
  });

  it("captures both participants then shows GB prompt", async () => {
    await navigateToFaceoffGB();
    expect(screen.getByText(/Who came up with the GB/i)).toBeInTheDocument();
  });

  it("commits paired win + loss entries when 'Nobody' is chosen", async () => {
    const onStateChange = vi.fn();
    renderLaxStats({ onStateChange });
    await waitFor(() => screen.getAllByPlaceholderText(/First Last/));
    await act(async () => { await startTrackingDistinct(); });
    fireEvent.click(screen.getByText("🔄 Faceoff"));
    fireEvent.click(screen.getByText("#1"));
    fireEvent.click(screen.getByText("#11"));
    fireEvent.click(screen.getByText("Player1"));
    await act(async () => { fireEvent.click(screen.getByText(/Nobody/i)); });
    await waitFor(() => expect(screen.getByText(/Last entry:/)).toBeInTheDocument());
    const lastCall = onStateChange.mock.calls[onStateChange.mock.calls.length - 1][0];
    expect(lastCall.log).toHaveLength(2);
    const [win, loss] = lastCall.log;
    expect(win.event).toBe("faceoff_win");
    expect(win.teamIdx).toBe(0);
    expect(win.player.num).toBe("1");
    expect(loss.event).toBe("faceoff_loss");
    expect(loss.teamIdx).toBe(1);
    expect(loss.player.num).toBe("11");
    expect(win.groupId).toBe(loss.groupId);
  });

  it("commits faceoff pair + GB when same player is chosen", async () => {
    const onStateChange = vi.fn();
    renderLaxStats({ onStateChange });
    await waitFor(() => screen.getAllByPlaceholderText(/First Last/));
    await act(async () => { await startTrackingDistinct(); });
    fireEvent.click(screen.getByText("🔄 Faceoff"));
    fireEvent.click(screen.getByText("#1"));
    fireEvent.click(screen.getByText("#11"));
    fireEvent.click(screen.getByText("Player1"));
    await act(async () => { fireEvent.click(screen.getByText(/— same player/i)); });
    await waitFor(() => expect(screen.getByText(/Last entry:/)).toBeInTheDocument());
    const lastCall = onStateChange.mock.calls[onStateChange.mock.calls.length - 1][0];
    expect(lastCall.log).toHaveLength(3);
    expect(lastCall.log.map(e => e.event).sort()).toEqual(["faceoff_loss", "faceoff_win", "ground_ball"]);
    expect(new Set(lastCall.log.map(e => e.groupId)).size).toBe(1);
  });

  it("shows roster picker when 'Someone else' is chosen", async () => {
    await navigateToFaceoffGB();
    fireEvent.click(screen.getByText(/Someone else/i));
    await waitFor(() => expect(screen.getByText(/Which player/i)).toBeInTheDocument());
  });
});

// ── Undo / last entry banner ───────────────────────────────────────────────────

describe("LaxStats — undo banner", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows undo banner after committing a successful clear", async () => {
    renderLaxStats();
    await waitFor(() => screen.getAllByPlaceholderText(/First Last/));
    await act(async () => { await startTrackingDistinct(); });
    fireEvent.click(screen.getByText("Home"));
    fireEvent.click(screen.getByText("Clear"));
    fireEvent.click(screen.getByText("Successful"));
    await waitFor(() => expect(screen.getByText(/Last entry:/)).toBeInTheDocument());
  });

  it("undo button removes the last entry and hides banner", async () => {
    renderLaxStats();
    await waitFor(() => screen.getAllByPlaceholderText(/First Last/));
    await act(async () => { await startTrackingDistinct(); });
    fireEvent.click(screen.getByText("Home"));
    fireEvent.click(screen.getByText("Clear"));
    fireEvent.click(screen.getByText("Successful"));
    await waitFor(() => expect(screen.getByText("undo")).toBeInTheDocument());
    fireEvent.click(screen.getByText("undo"));
    await waitFor(() => expect(screen.queryByText(/Last entry:/)).not.toBeInTheDocument());
  });

  it("calls onEventSoftDelete with the groupId when undo is clicked", async () => {
    const onEventSoftDelete = vi.fn().mockResolvedValue(undefined);
    renderLaxStats({ onEventSoftDelete });
    await waitFor(() => screen.getAllByPlaceholderText(/First Last/));
    await act(async () => { await startTrackingDistinct(); });
    fireEvent.click(screen.getByText("Home"));
    fireEvent.click(screen.getByText("Clear"));
    fireEvent.click(screen.getByText("Successful"));
    await waitFor(() => expect(screen.getByText("undo")).toBeInTheDocument());
    fireEvent.click(screen.getByText("undo"));
    expect(onEventSoftDelete).toHaveBeenCalledWith(expect.anything());
  });
});

// ── initialState hydration ─────────────────────────────────────────────────────

describe("LaxStats — initialState hydration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders track screen when initialState has trackingStarted=true", async () => {
    const initialState = {
      version: 1,
      teams: [
        { name: "Home", roster: roster(10), color: "#1a6bab" },
        { name: "Away", roster: roster(10), color: "#b84e1a" },
      ],
      log: [],
      currentQuarter: 1,
      completedQuarters: [],
      gameOver: false,
      trackingStarted: true,
      gameDate: "2026-01-01",
    };
    renderLaxStats({ initialState });
    await waitFor(() => expect(screen.getByText(/Who scored \/ acted\?/)).toBeInTheDocument());
  });

  it("renders stats screen when initialState has gameOver=true", async () => {
    const initialState = {
      version: 1,
      teams: [
        { name: "Home", roster: roster(10), color: "#1a6bab" },
        { name: "Away", roster: roster(10), color: "#b84e1a" },
      ],
      log: [],
      currentQuarter: 1,
      completedQuarters: [1, 2, 3, 4],
      gameOver: true,
      trackingStarted: true,
      gameDate: "2026-01-01",
    };
    renderLaxStats({ initialState });
    await waitFor(() => expect(screen.getByText("Final")).toBeInTheDocument());
  });

  it("calls onStateChange when log changes", async () => {
    const onStateChange = vi.fn();
    const initialState = {
      version: 1,
      teams: [
        { name: "Home", roster: roster(10), color: "#1a6bab" },
        { name: "Away", roster: roster(10), color: "#b84e1a" },
      ],
      log: [],
      currentQuarter: 1,
      completedQuarters: [],
      gameOver: false,
      trackingStarted: true,
      gameDate: "2026-01-01",
    };
    renderLaxStats({ initialState, onStateChange });
    await waitFor(() => screen.getByText(/Who scored \/ acted\?/));
    onStateChange.mockClear();
    fireEvent.click(screen.getByText("Home"));
    fireEvent.click(screen.getByText("Clear"));
    fireEvent.click(screen.getByText("Successful"));
    await waitFor(() => expect(onStateChange).toHaveBeenCalled());
    const lastCall = onStateChange.mock.calls[onStateChange.mock.calls.length - 1][0];
    expect(lastCall.log).toHaveLength(1);
    expect(lastCall.log[0].event).toBe("clear");
  });
});

// ── remoteEntries merge ────────────────────────────────────────────────────────

describe("LaxStats — remoteEntries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("merges remote entries into the log", async () => {
    const initialState = {
      version: 1,
      teams: [
        { name: "Home", roster: roster(10), color: "#1a6bab" },
        { name: "Away", roster: roster(10), color: "#b84e1a" },
      ],
      log: [],
      currentQuarter: 1,
      completedQuarters: [],
      gameOver: false,
      trackingStarted: true,
      gameDate: "2026-01-01",
    };
    const remoteEntry = {
      id: 1, seq: 1, groupId: "remote-grp-1", teamIdx: 0,
      event: "goal", player: { num: "7", name: "Alice" },
      quarter: 1, teamStat: false,
    };
    const { rerender } = render(
      <LaxStats initialState={initialState} remoteEntries={null} />
    );
    await waitFor(() => screen.getByText(/Who scored \/ acted\?/));
    rerender(
      <LaxStats initialState={initialState} remoteEntries={[remoteEntry]} />
    );
    // Home score should now be 1; find the score display specifically
    await waitFor(() => {
      const scoreSpans = screen.getAllByText("1");
      expect(scoreSpans.length).toBeGreaterThan(0);
    });
  });

  it("does not add duplicate remote groups", async () => {
    const remoteEntry = {
      id: 1, seq: 1, groupId: "remote-grp-1", teamIdx: 0,
      event: "goal", player: { num: "7", name: "Alice" },
      quarter: 1, teamStat: false,
    };
    const initialState = {
      version: 1,
      teams: [
        { name: "Home", roster: roster(10), color: "#1a6bab" },
        { name: "Away", roster: roster(10), color: "#b84e1a" },
      ],
      log: [remoteEntry],
      currentQuarter: 1,
      completedQuarters: [],
      gameOver: false,
      trackingStarted: true,
      gameDate: "2026-01-01",
    };
    const onStateChange = vi.fn();
    const { rerender } = render(
      <LaxStats initialState={initialState} remoteEntries={null} onStateChange={onStateChange} />
    );
    await waitFor(() => screen.getByText(/Who scored \/ acted\?/));
    onStateChange.mockClear();
    rerender(
      <LaxStats initialState={initialState} remoteEntries={[remoteEntry]} onStateChange={onStateChange} />
    );
    // log should still be length 1 — no duplicate added
    await new Promise(r => setTimeout(r, 50));
    const calls = onStateChange.mock.calls;
    if (calls.length > 0) {
      expect(calls[calls.length - 1][0].log).toHaveLength(1);
    }
  });
});

// ── Penalty display ────────────────────────────────────────────────────────────

describe("LaxStats — penalty box display", () => {
  beforeEach(() => vi.clearAllMocks());

  // A minimal 2-min personal foul entry active at start of Q1 (penaltyTime="12:00")
  function penaltyEntry(overrides = {}) {
    return {
      id: 1, seq: 1, groupId: "grp-pen-1",
      teamIdx: 0,
      event: "penalty_min",
      player: { num: "7", name: "Alice" },
      quarter: 1,
      penaltyTime: "12:00",
      penaltyMin: 2,
      nonReleasable: false,
      teamStat: false,
      ...overrides,
    };
  }

  it("shows Penalty Box when an active penalty exists", async () => {
    const initialState = trackingInitialState([penaltyEntry()]);
    render(<LaxStats initialState={initialState} />);
    await waitFor(() => expect(screen.getByText("Penalty Box")).toBeInTheDocument());
  });

  it("does not show Penalty Box when log is empty", async () => {
    const initialState = trackingInitialState([]);
    render(<LaxStats initialState={initialState} />);
    await waitFor(() => screen.getByText(/Who scored \/ acted\?/));
    expect(screen.queryByText("Penalty Box")).not.toBeInTheDocument();
  });

  it("shows the penalized player's number in the penalty box", async () => {
    const initialState = trackingInitialState([penaltyEntry({ player: { num: "7", name: "Alice" } })]);
    render(<LaxStats initialState={initialState} />);
    await waitFor(() => expect(screen.getByText("Penalty Box")).toBeInTheDocument());
    expect(screen.getByText("#7")).toBeInTheDocument();
  });

  it("shows two separate rows for two players with active penalties", async () => {
    const initialState = trackingInitialState([
      penaltyEntry({ id: 1, groupId: "grp-1", player: { num: "7",  name: "Alice" } }),
      penaltyEntry({ id: 2, groupId: "grp-2", player: { num: "14", name: "Bob"   }, teamIdx: 1 }),
    ]);
    render(<LaxStats initialState={initialState} />);
    await waitFor(() => expect(screen.getByText("Penalty Box")).toBeInTheDocument());
    expect(screen.getByText("#7")).toBeInTheDocument();
    expect(screen.getByText("#14")).toBeInTheDocument();
  });

  it("shows NR badge for non-releasable penalties", async () => {
    const initialState = trackingInitialState([
      penaltyEntry({ nonReleasable: true }),
    ]);
    render(<LaxStats initialState={initialState} />);
    await waitFor(() => expect(screen.getByText("Penalty Box")).toBeInTheDocument());
    expect(screen.getByText("NR")).toBeInTheDocument();
  });

  it("hides Penalty Box when the penalty time has fully expired", async () => {
    // Penalty called at 12:00 Q1 with 2 min duration expires at 10:00.
    // If currentQuarter=2 (well past Q1 end), the penalty has expired.
    const initialState = trackingInitialState([penaltyEntry()]);
    initialState.currentQuarter = 2;
    initialState.completedQuarters = [1];
    render(<LaxStats initialState={initialState} />);
    await waitFor(() => screen.getByText(/Who scored \/ acted\?/));
    expect(screen.queryByText("Penalty Box")).not.toBeInTheDocument();
  });
});


// ── Turnover chain (TO → caused-by → optional GB) ─────────────────────────────

describe("LaxStats — turnover chain", () => {
  beforeEach(() => vi.clearAllMocks());

  async function startTOFlow(onStateChange) {
    renderLaxStats({ onStateChange });
    await waitFor(() => screen.getAllByPlaceholderText(/First Last/));
    await act(async () => { await startTrackingDistinct(); });
    fireEvent.click(screen.getByText("Home"));
    fireEvent.click(screen.getByText("Turnover"));
    fireEvent.click(screen.getByText("#1")); // Home player who turned it over
  }

  it("asks who caused it on the opposing team's grid, with a skip control", async () => {
    await startTOFlow(vi.fn());
    expect(screen.getByText(/Who caused it\?/)).toBeInTheDocument();
    expect(screen.getByText(/Skip — unforced/)).toBeInTheDocument();
    expect(screen.getByText("#11")).toBeInTheDocument(); // Away roster shown
  });

  it("skip-unforced still offers the ground ball, then commits a 1-entry group on Skip GB", async () => {
    const onStateChange = vi.fn();
    await startTOFlow(onStateChange);
    fireEvent.click(screen.getByText(/Skip — unforced/));
    // Skipping the caused-TO still progresses to the GB prompt
    expect(screen.getByText(/Ground ball\?/)).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByText(/Skip GB/)); });
    await waitFor(() => expect(screen.getByText(/Last entry:/)).toBeInTheDocument());
    const log = onStateChange.mock.calls.at(-1)[0].log;
    expect(log).toHaveLength(1);
    expect(log[0].event).toBe("turnover");
    expect(log[0].teamIdx).toBe(0);
  });

  it("skip-unforced + GB commits a 2-entry group without a forced_to", async () => {
    const onStateChange = vi.fn();
    await startTOFlow(onStateChange);
    fireEvent.click(screen.getByText(/Skip — unforced/));
    await act(async () => { fireEvent.click(screen.getByText("#11")); }); // Away GB
    await waitFor(() => expect(screen.getByText(/Last entry:/)).toBeInTheDocument());
    const log = onStateChange.mock.calls.at(-1)[0].log;
    expect(log.map(e => e.event)).toEqual(["turnover", "ground_ball"]);
    expect(log[1].teamIdx).toBe(1);
    expect(new Set(log.map(e => e.groupId)).size).toBe(1);
  });

  it("caused-by + skip GB commits a 2-entry group", async () => {
    const onStateChange = vi.fn();
    await startTOFlow(onStateChange);
    fireEvent.click(screen.getByText("#11")); // Away causer
    expect(screen.getByText(/Ground ball\?/)).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByText(/Skip GB/)); });
    await waitFor(() => expect(screen.getByText(/Last entry:/)).toBeInTheDocument());
    const log = onStateChange.mock.calls.at(-1)[0].log;
    expect(log).toHaveLength(2);
    expect(log.map(e => e.event)).toEqual(["turnover", "forced_to"]);
    expect(log[1].teamIdx).toBe(1);
    expect(new Set(log.map(e => e.groupId)).size).toBe(1);
  });

  it("caused-by + GB commits a 3-entry group", async () => {
    const onStateChange = vi.fn();
    await startTOFlow(onStateChange);
    fireEvent.click(screen.getByText("#11"));
    // The causer is the featured GB tile; pick a different away player from the grid
    await act(async () => { fireEvent.click(screen.getByText("#12")); });
    await waitFor(() => expect(screen.getByText(/Last entry:/)).toBeInTheDocument());
    const log = onStateChange.mock.calls.at(-1)[0].log;
    expect(log).toHaveLength(3);
    expect(log.map(e => e.event)).toEqual(["turnover", "forced_to", "ground_ball"]);
    expect(log[2].teamIdx).toBe(1);
    expect(log[2].player.num).toBe("12");
    expect(new Set(log.map(e => e.groupId)).size).toBe(1);
  });

  it("group delete removes all three chained entries", async () => {
    const onStateChange = vi.fn();
    const onEventSoftDelete = vi.fn().mockResolvedValue(undefined);
    renderLaxStats({ onStateChange, onEventSoftDelete });
    await waitFor(() => screen.getAllByPlaceholderText(/First Last/));
    await act(async () => { await startTrackingDistinct(); });
    fireEvent.click(screen.getByText("Home"));
    fireEvent.click(screen.getByText("Turnover"));
    fireEvent.click(screen.getByText("#1"));
    fireEvent.click(screen.getByText("#11"));
    await act(async () => { fireEvent.click(screen.getByText("#12")); });
    await waitFor(() => expect(screen.getByText("undo")).toBeInTheDocument());
    fireEvent.click(screen.getByText("undo")); // group delete via undo
    await waitFor(() => {
      const log = onStateChange.mock.calls.at(-1)[0].log;
      expect(log).toHaveLength(0);
    });
    expect(onEventSoftDelete).toHaveBeenCalledTimes(1);
  });

  it("Caused TO is no longer a standalone event option", async () => {
    renderLaxStats();
    await waitFor(() => screen.getAllByPlaceholderText(/First Last/));
    await act(async () => { await startTrackingDistinct(); });
    fireEvent.click(screen.getByText("Home"));
    expect(screen.queryByText("Caused TO")).not.toBeInTheDocument();
  });
});

// ── Clear flow ────────────────────────────────────────────────────────────────

describe("LaxStats — clear flow", () => {
  beforeEach(() => vi.clearAllMocks());

  async function startClearFlow(onStateChange) {
    renderLaxStats({ onStateChange });
    await waitFor(() => screen.getAllByPlaceholderText(/First Last/));
    await act(async () => { await startTrackingDistinct(); });
    fireEvent.click(screen.getByText("Home"));
    fireEvent.click(screen.getByText("Clear"));
  }

  it("old two-button clear entry is gone", async () => {
    renderLaxStats();
    await waitFor(() => screen.getAllByPlaceholderText(/First Last/));
    await act(async () => { await startTrackingDistinct(); });
    fireEvent.click(screen.getByText("Home"));
    expect(screen.queryByText("Successful Clear")).not.toBeInTheDocument();
    expect(screen.queryByText("Failed Clear")).not.toBeInTheDocument();
  });

  it("successful clear commits a single team clear entry", async () => {
    const onStateChange = vi.fn();
    await startClearFlow(onStateChange);
    await act(async () => { fireEvent.click(screen.getByText("Successful")); });
    await waitFor(() => expect(screen.getByText(/Last entry:/)).toBeInTheDocument());
    const log = onStateChange.mock.calls.at(-1)[0].log;
    expect(log).toHaveLength(1);
    expect(log[0].event).toBe("clear");
    expect(log[0].teamStat).toBe(true);
  });

  it("failed clear with no turnover commits a single failed_clear entry", async () => {
    const onStateChange = vi.fn();
    await startClearFlow(onStateChange);
    fireEvent.click(screen.getByText("Failed"));
    expect(screen.getByText(/Did the failed clear result in a turnover\?/)).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByText("No")); });
    await waitFor(() => expect(screen.getByText(/Last entry:/)).toBeInTheDocument());
    const log = onStateChange.mock.calls.at(-1)[0].log;
    expect(log).toHaveLength(1);
    expect(log[0].event).toBe("failed_clear");
  });

  it("failed clear + turnover chains into the TO flow with the clearing team's grid", async () => {
    const onStateChange = vi.fn();
    await startClearFlow(onStateChange);
    fireEvent.click(screen.getByText("Failed"));
    fireEvent.click(screen.getByText("Yes"));
    // Clearing team (Home) committed the TO
    expect(screen.getByText(/Turnover — Which player\?/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("#1"));
    fireEvent.click(screen.getByText(/Skip — unforced/));
    await act(async () => { fireEvent.click(screen.getByText(/Skip GB/)); });
    await waitFor(() => expect(screen.getByText(/Last entry:/)).toBeInTheDocument());
    const log = onStateChange.mock.calls.at(-1)[0].log;
    expect(log.map(e => e.event)).toEqual(["failed_clear", "turnover"]);
    expect(new Set(log.map(e => e.groupId)).size).toBe(1);
  });

  it("full chain: failed clear + TO + caused-by + GB shares one groupId", async () => {
    const onStateChange = vi.fn();
    await startClearFlow(onStateChange);
    fireEvent.click(screen.getByText("Failed"));
    fireEvent.click(screen.getByText("Yes"));
    fireEvent.click(screen.getByText("#1"));   // Home turned it over
    fireEvent.click(screen.getByText("#11"));  // Away caused it
    await act(async () => { fireEvent.click(screen.getByText("#12")); }); // Away GB
    await waitFor(() => expect(screen.getByText(/Last entry:/)).toBeInTheDocument());
    const log = onStateChange.mock.calls.at(-1)[0].log;
    expect(log.map(e => e.event)).toEqual(["failed_clear", "turnover", "forced_to", "ground_ball"]);
    expect(log[0].teamIdx).toBe(0);
    expect(log[2].teamIdx).toBe(1);
    expect(new Set(log.map(e => e.groupId)).size).toBe(1);
  });
});

// ── Legacy blocked-shot hydration safety ──────────────────────────────────────

describe("LaxStats — legacy shot_blocked entries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("hydrates a legacy state containing shot_blocked without crashing or showing blocked stats", async () => {
    const legacy = trackingInitialState([
      { id: 1, seq: 1, groupId: "g1", teamIdx: 0, event: "shot", player: { num: "1", name: "Player1" }, quarter: 1 },
      { id: 2, seq: 2, groupId: "g1", teamIdx: 1, event: "shot_blocked", player: { num: "11", name: "Player11" }, quarter: 1 },
    ]);
    render(<LaxStats initialState={legacy} />);
    await waitFor(() => screen.getByText(/Who scored \/ acted\?/));
    fireEvent.click(screen.getByText("View stats →"));
    await waitFor(() => expect(screen.getByText("Total Shots")).toBeInTheDocument());
    expect(screen.queryByText(/Blocked/)).not.toBeInTheDocument();
  });
});

// ── In-flow jersey-number add (dialpad) ───────────────────────────────────────

describe("LaxStats — add missing jersey number", () => {
  beforeEach(() => vi.clearAllMocks());

  async function openGoalPlayerGrid() {
    renderLaxStats({ onStateChange: vi.fn() });
    await waitFor(() => screen.getAllByPlaceholderText(/First Last/));
    await act(async () => { await startTrackingDistinct(); });
    fireEvent.click(screen.getByText("Home"));
    fireEvent.click(screen.getByText("Goal"));
  }

  it("shows the ＋ # tile on the player grid", async () => {
    await openGoalPlayerGrid();
    expect(screen.getByText("＋ #")).toBeInTheDocument();
  });

  it("adds a new number via the dialpad and selects it for the in-flight step", async () => {
    await openGoalPlayerGrid();
    fireEvent.click(screen.getByText("＋ #"));
    expect(screen.getByText(/Enter jersey number/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("4"));
    fireEvent.click(screen.getByText("2"));
    await act(async () => { fireEvent.click(screen.getByText("Add")); });
    // #42 was selected for the goal — flow advanced to the assist question
    await waitFor(() => expect(screen.getByText(/Was it assisted\?/)).toBeInTheDocument());
  });

  it("tags dialpad-added players as addedInGame in saved state", async () => {
    const onStateChange = vi.fn();
    renderLaxStats({ onStateChange });
    await waitFor(() => screen.getAllByPlaceholderText(/First Last/));
    await act(async () => { await startTrackingDistinct(); });
    fireEvent.click(screen.getByText("Home"));
    fireEvent.click(screen.getByText("Ground Ball"));
    fireEvent.click(screen.getByText("＋ #"));
    fireEvent.click(screen.getByText("4"));
    fireEvent.click(screen.getByText("2"));
    await act(async () => { fireEvent.click(screen.getByText("Add")); });
    await waitFor(() => expect(screen.getByText(/Last entry:/)).toBeInTheDocument());
    const lastState = onStateChange.mock.calls.at(-1)[0];
    expect(lastState.teams[0].addedNums).toContain("42");
    expect(lastState.log.at(-1).player.num).toBe("42");
  });

  it("blocks duplicate numbers and highlights the existing tile instead", async () => {
    const onStateChange = vi.fn();
    renderLaxStats({ onStateChange });
    await waitFor(() => screen.getAllByPlaceholderText(/First Last/));
    await act(async () => { await startTrackingDistinct(); });
    fireEvent.click(screen.getByText("Home"));
    fireEvent.click(screen.getByText("Goal"));
    fireEvent.click(screen.getByText("＋ #"));
    fireEvent.click(screen.getByText("1"));
    await act(async () => { fireEvent.click(screen.getByText("Add")); });
    // Back on the grid (no new player added), still on the player step
    await waitFor(() => expect(screen.getByText(/Goal — Which player\?/)).toBeInTheDocument());
    const ones = screen.getAllByText("#1");
    expect(ones).toHaveLength(1);
  });
});

// ── Finalization wizard ───────────────────────────────────────────────────────

describe("LaxStats — finalization wizard", () => {
  beforeEach(() => vi.clearAllMocks());

  function q4State(log = []) {
    const s = trackingInitialState(log);
    s.currentQuarter = 4;
    s.completedQuarters = [1, 2, 3];
    return s;
  }

  const goalEntry = (gid, teamIdx, num = "1") => ({
    id: Number(gid.slice(1)) * 10, seq: Number(gid.slice(1)), groupId: gid, teamIdx,
    event: "goal", player: { num, name: `Player${num}` }, quarter: 4, teamStat: false,
  });

  it("ending Q4 with a winner opens the wizard instead of finalizing", async () => {
    const onMetaEvent = vi.fn().mockResolvedValue({});
    render(<LaxStats initialState={q4State([goalEntry("g1", 0)])} onMetaEvent={onMetaEvent} />);
    await waitFor(() => screen.getByText(/Who scored \/ acted\?/));
    fireEvent.click(screen.getByText(/End Q4/));
    fireEvent.click(screen.getByText(/Review & Finalize/));
    await waitFor(() => expect(screen.getByText("Roster corrections")).toBeInTheDocument());
    expect(onMetaEvent).not.toHaveBeenCalled(); // nothing committed yet
  });

  it("tie at end of Q4 goes to OT, not the wizard", async () => {
    const onMetaEvent = vi.fn().mockResolvedValue({});
    render(<LaxStats initialState={q4State([goalEntry("g1", 0), goalEntry("g2", 1, "11")])} onMetaEvent={onMetaEvent} />);
    await waitFor(() => screen.getByText(/Who scored \/ acted\?/));
    fireEvent.click(screen.getByText(/End Q4/));
    await act(async () => { fireEvent.click(screen.getByText(/Start OT/)); });
    await waitFor(() => expect(onMetaEvent).toHaveBeenCalledWith("quarter_end", 4, 5));
    expect(screen.queryByText("Roster corrections")).not.toBeInTheDocument();
  });

  it("'Not yet — keep scoring' escapes the wizard without finalizing", async () => {
    const onMetaEvent = vi.fn().mockResolvedValue({});
    render(<LaxStats initialState={q4State([goalEntry("g1", 0)])} onMetaEvent={onMetaEvent} />);
    await waitFor(() => screen.getByText(/Who scored \/ acted\?/));
    fireEvent.click(screen.getByText(/End Q4/));
    fireEvent.click(screen.getByText(/Review & Finalize/));
    await waitFor(() => screen.getByText("Roster corrections"));
    fireEvent.click(screen.getByText(/Not yet — keep scoring/));
    await waitFor(() => expect(screen.getByText(/Who scored \/ acted\?/)).toBeInTheDocument());
    expect(onMetaEvent).not.toHaveBeenCalled();
  });

  it("gameOver only commits after the summary screen's Finalize button", async () => {
    const onMetaEvent = vi.fn().mockResolvedValue({});
    const onStateChange = vi.fn();
    render(<LaxStats initialState={q4State([goalEntry("g1", 0)])} onMetaEvent={onMetaEvent} onStateChange={onStateChange} />);
    await waitFor(() => screen.getByText(/Who scored \/ acted\?/));
    fireEvent.click(screen.getByText(/End Q4/));
    fireEvent.click(screen.getByText(/Review & Finalize/));
    await waitFor(() => screen.getByText("Roster corrections"));
    fireEvent.click(screen.getByText("Continue →"));
    // Step B: winning goalie (Home won 1-0), then losing goalie
    await waitFor(() => screen.getByText(/Winning goalie — Home/));
    fireEvent.click(screen.getByText("#2"));
    await waitFor(() => screen.getByText(/Losing goalie — Away/));
    fireEvent.click(screen.getByText("#12"));
    // Step C: summary
    await waitFor(() => screen.getByText("Final summary"));
    expect(onMetaEvent).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByText("Finalize Game ✓")); });
    await waitFor(() => expect(onMetaEvent).toHaveBeenCalledWith("game_over", 4, 4));
    // Routed to the stats screen with the Final banner, goalie decisions persisted
    await waitFor(() => expect(screen.getByText("Final")).toBeInTheDocument());
    const lastState = onStateChange.mock.calls.at(-1)[0];
    expect(lastState.gameOver).toBe(true);
    expect(lastState.goalieDecisions.win.num).toBe("2");
    expect(lastState.goalieDecisions.loss.num).toBe("12");
  });

  it("an OT goal opens the wizard (sudden victory) instead of instantly ending the game", async () => {
    const onMetaEvent = vi.fn().mockResolvedValue({});
    const s = trackingInitialState([goalEntry("g1", 0), goalEntry("g2", 1, "11")]);
    s.currentQuarter = 5; // OT
    s.completedQuarters = [1, 2, 3, 4];
    render(<LaxStats initialState={s} onMetaEvent={onMetaEvent} />);
    await waitFor(() => screen.getByText(/Sudden death/));
    fireEvent.click(screen.getByText("Home"));
    fireEvent.click(screen.getByText("Goal"));
    fireEvent.click(screen.getByText("#1"));
    fireEvent.click(screen.getByText(/No — unassisted/));
    // goal time keypad: enter 1:00
    fireEvent.click(screen.getByText("1"));
    fireEvent.click(screen.getAllByText("0")[0]);
    fireEvent.click(screen.getAllByText("0")[0]);
    await act(async () => { fireEvent.click(screen.getByText("Use")); });
    await waitFor(() => expect(screen.getByText("Roster corrections")).toBeInTheDocument());
    expect(onMetaEvent).not.toHaveBeenCalled();
  });
});

// ── Group edit semantics ──────────────────────────────────────────────────────

describe("LaxStats — faceoff group editing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("editing a faceoff group re-opens the FO flow and swaps winner/loser atomically", async () => {
    const onStateChange = vi.fn();
    renderLaxStats({ onStateChange });
    await waitFor(() => screen.getAllByPlaceholderText(/First Last/));
    await act(async () => { await startTrackingDistinct(); });

    // Record a faceoff: Home #1 beats Away #11, no GB
    fireEvent.click(screen.getByText("🔄 Faceoff"));
    fireEvent.click(screen.getByText("#1"));
    fireEvent.click(screen.getByText("#11"));
    fireEvent.click(screen.getByText("Player1"));
    await act(async () => { fireEvent.click(screen.getByText(/Nobody/i)); });
    await waitFor(() => expect(screen.getByText(/Last entry:/)).toBeInTheDocument());
    const originalLog = onStateChange.mock.calls.at(-1)[0].log;
    const originalGroupId = originalLog[0].groupId;

    // Edit from the Event Log: both participants prefilled as featured tiles
    fireEvent.click(screen.getByText("Event Log"));
    fireEvent.click(screen.getByTitle("Edit"));
    await waitFor(() => expect(screen.getByText(/Faceoff — Home player/)).toBeInTheDocument());
    fireEvent.click(screen.getAllByText("#1")[0]);   // keep home participant
    fireEvent.click(screen.getAllByText("#11")[0]);  // keep away participant
    await waitFor(() => screen.getByText(/Who won the faceoff/));
    fireEvent.click(screen.getByText("Player11"));   // swap: Away wins now
    // Sit out the 500ms double-tap commit debounce before the replacing commit
    await act(async () => { await new Promise(r => setTimeout(r, 550)); });
    await act(async () => { fireEvent.click(screen.getByText(/Nobody/i)); });

    await waitFor(() => {
      const log = onStateChange.mock.calls.at(-1)[0].log;
      expect(log).toHaveLength(2);
      const win = log.find(e => e.event === "faceoff_win");
      const loss = log.find(e => e.event === "faceoff_loss");
      expect(win.teamIdx).toBe(1);
      expect(win.player.num).toBe("11");
      expect(loss.teamIdx).toBe(0);
      expect(loss.player.num).toBe("1");
      // replaced atomically under a new group, old group fully gone
      expect(win.groupId).toBe(loss.groupId);
      expect(log.some(e => e.groupId === originalGroupId)).toBe(false);
    });
  });
});

describe("LaxStats — finalization wizard: dialpad-added goalie", () => {
  beforeEach(() => vi.clearAllMocks());

  it("prompts for a name when the goalie was added via ＋ # in the wizard", async () => {
    const onMetaEvent = vi.fn().mockResolvedValue({});
    const onStateChange = vi.fn();
    const s = trackingInitialState([{
      id: 10, seq: 1, groupId: "g1", teamIdx: 0, event: "goal",
      player: { num: "1", name: "Player1" }, quarter: 4, teamStat: false,
    }]);
    s.currentQuarter = 4;
    s.completedQuarters = [1, 2, 3];
    render(<LaxStats initialState={s} onMetaEvent={onMetaEvent} onStateChange={onStateChange} />);
    await waitFor(() => screen.getByText(/Who scored \/ acted\?/));

    fireEvent.click(screen.getByText(/End Q4/));
    fireEvent.click(screen.getByText(/Review & Finalize/));
    await waitFor(() => screen.getByText("Roster corrections"));
    fireEvent.click(screen.getByText("Continue →"));

    // Winning goalie picked normally
    await waitFor(() => screen.getByText(/Winning goalie — Home/));
    fireEvent.click(screen.getByText("#2"));

    // Losing goalie wasn't on the roster — add #99 via the dialpad
    await waitFor(() => screen.getByText(/Losing goalie — Away/));
    fireEvent.click(screen.getByText("＋ #"));
    fireEvent.click(screen.getByText("9"));
    fireEvent.click(screen.getByText("9"));
    await act(async () => { fireEvent.click(screen.getByText("Add")); });

    // Name prompt appears instead of silently advancing
    await waitFor(() => expect(screen.getByText(/Name for #99\?/)).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText("Player name"), { target: { value: "Backup Goalie" } });
    await act(async () => { fireEvent.click(screen.getByText("Continue →")); });

    // Summary shows the named goalie and lists #99 as a roster change
    await waitFor(() => screen.getByText("Final summary"));
    expect(screen.getByText(/#99 Backup Goalie · Away/)).toBeInTheDocument();
    expect(screen.getByText("Roster changes")).toBeInTheDocument();
    expect(screen.getByText("Backup Goalie")).toBeInTheDocument();

    await act(async () => { fireEvent.click(screen.getByText("Finalize Game ✓")); });
    await waitFor(() => expect(onMetaEvent).toHaveBeenCalledWith("game_over", 4, 4));
    const lastState = onStateChange.mock.calls.at(-1)[0];
    expect(lastState.goalieDecisions.loss).toEqual({ teamIdx: 1, num: "99", name: "Backup Goalie" });
    // The name made it onto the saved roster too
    expect(lastState.teams[1].roster).toContain("#99 Backup Goalie");
  });

  it("allows skipping the name (blank) and still advances", async () => {
    const onMetaEvent = vi.fn().mockResolvedValue({});
    const s = trackingInitialState([{
      id: 10, seq: 1, groupId: "g1", teamIdx: 0, event: "goal",
      player: { num: "1", name: "Player1" }, quarter: 4, teamStat: false,
    }]);
    s.currentQuarter = 4;
    s.completedQuarters = [1, 2, 3];
    render(<LaxStats initialState={s} onMetaEvent={onMetaEvent} />);
    await waitFor(() => screen.getByText(/Who scored \/ acted\?/));

    fireEvent.click(screen.getByText(/End Q4/));
    fireEvent.click(screen.getByText(/Review & Finalize/));
    await waitFor(() => screen.getByText("Roster corrections"));
    fireEvent.click(screen.getByText("Continue →"));
    await waitFor(() => screen.getByText(/Winning goalie — Home/));
    fireEvent.click(screen.getByText("＋ #"));
    fireEvent.click(screen.getByText("5"));
    fireEvent.click(screen.getByText("5"));
    await act(async () => { fireEvent.click(screen.getByText("Add")); });
    await waitFor(() => screen.getByText(/Name for #55\?/));
    await act(async () => { fireEvent.click(screen.getByText("Continue →")); }); // blank name
    await waitFor(() => expect(screen.getByText(/Losing goalie — Away/)).toBeInTheDocument());
  });
});
