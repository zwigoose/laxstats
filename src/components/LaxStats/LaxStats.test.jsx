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

// ── Undo / last entry banner ───────────────────────────────────────────────────

describe("LaxStats — undo banner", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows undo banner after committing a team-stat event", async () => {
    renderLaxStats();
    await waitFor(() => screen.getAllByPlaceholderText(/First Last/));
    await act(async () => { await startTracking(); });
    fireEvent.click(screen.getByText("Home"));
    fireEvent.click(screen.getByText("Successful Clear"));
    await waitFor(() => expect(screen.getByText(/Last entry:/)).toBeInTheDocument());
  });

  it("undo button removes the last entry and hides banner", async () => {
    renderLaxStats();
    await waitFor(() => screen.getAllByPlaceholderText(/First Last/));
    await act(async () => { await startTracking(); });
    fireEvent.click(screen.getByText("Home"));
    fireEvent.click(screen.getByText("Successful Clear"));
    await waitFor(() => expect(screen.getByText("undo")).toBeInTheDocument());
    fireEvent.click(screen.getByText("undo"));
    await waitFor(() => expect(screen.queryByText(/Last entry:/)).not.toBeInTheDocument());
  });

  it("calls onEventSoftDelete with the groupId when undo is clicked", async () => {
    const onEventSoftDelete = vi.fn().mockResolvedValue(undefined);
    renderLaxStats({ onEventSoftDelete });
    await waitFor(() => screen.getAllByPlaceholderText(/First Last/));
    await act(async () => { await startTracking(); });
    fireEvent.click(screen.getByText("Home"));
    fireEvent.click(screen.getByText("Successful Clear"));
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
    fireEvent.click(screen.getByText("Successful Clear"));
    await waitFor(() => expect(onStateChange).toHaveBeenCalled());
    const lastCall = onStateChange.mock.calls[onStateChange.mock.calls.length - 1][0];
    expect(lastCall.log).toHaveLength(1);
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
