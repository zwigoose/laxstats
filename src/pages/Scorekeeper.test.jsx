import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Scorekeeper from "./Scorekeeper";

// ── useGameEvents mock state ───────────────────────────────────────────────────

const evState = vi.hoisted(() => ({
  entries:           [],
  loading:           false,
  error:             null,
  channelStatus:     "idle",
  isPrimary:         true,
  presenceList:      [],
  remoteQuarterState: null,
  commitGroup:       vi.fn().mockResolvedValue(undefined),
  softDeleteGroup:   vi.fn().mockResolvedValue(undefined),
  broadcastMeta:     vi.fn(),
}));

vi.mock("../hooks/useGameEvents", () => ({
  useGameEvents: vi.fn(() => ({ ...evState })),
}));

// ── Supabase mock ──────────────────────────────────────────────────────────────

const gameRow = vi.hoisted(() => ({
  value: {
    id: "game-1",
    created_at: "2026-01-01T00:00:00.000Z",
    name: "Home vs Away",
    state: null,
    schema_ver: 2,
    org_id: null,
    season_id: null,
    user_id: "user-1",
    multi_scorer_enabled: true,
  },
}));

vi.mock("../lib/supabase", () => {
  const rpcMock = vi.fn().mockResolvedValue({ data: "tok-abc", error: null });

  const queryChain = {
    select:  vi.fn().mockReturnThis(),
    eq:      vi.fn().mockReturnThis(),
    is:      vi.fn().mockReturnThis(),
    single:  vi.fn().mockImplementation(() => Promise.resolve({ data: gameRow.value, error: null })),
    update:  vi.fn().mockReturnThis(),
    delete:  vi.fn().mockReturnThis(),
    order:   vi.fn().mockResolvedValue({ data: [] }),
  };

  return {
    supabase: {
      from:           vi.fn().mockReturnValue(queryChain),
      rpc:            rpcMock,
      auth: {
        getSession:        vi.fn().mockResolvedValue({ data: { session: null } }),
        signInAnonymously: vi.fn().mockResolvedValue({ data: { user: { id: "anon-1", is_anonymous: true } }, error: null }),
      },
    },
  };
});

// ── AuthContext mock ───────────────────────────────────────────────────────────

const authState = vi.hoisted(() => ({
  user: { id: "user-1", is_anonymous: false },
  loading: false,
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: vi.fn(() => ({ ...authState })),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function renderScorekeeper(gameId = "game-1") {
  return render(
    <MemoryRouter initialEntries={[`/games/${gameId}/score`]}>
      <Routes>
        <Route path="/games/:id/score" element={<Scorekeeper />} />
        <Route path="*" element={<div>Redirected</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function resetState() {
  evState.entries           = [];
  evState.loading           = false;
  evState.error             = null;
  evState.channelStatus     = "idle";
  evState.isPrimary         = true;
  evState.presenceList      = [];
  evState.remoteQuarterState = null;

  authState.user    = { id: "user-1", is_anonymous: false };
  authState.loading = false;

  gameRow.value = {
    id: "game-1", created_at: "2026-01-01T00:00:00.000Z", name: "Home vs Away",
    state: null, schema_ver: 2, org_id: null, season_id: null,
    user_id: "user-1", multi_scorer_enabled: true,
  };
}

// ── Presence badge ─────────────────────────────────────────────────────────────

describe("ScorekeeperV2 — presence badge", () => {
  beforeEach(() => { vi.clearAllMocks(); resetState(); });

  it("hides badge when only one scorer is present", async () => {
    evState.presenceList = [{ userId: "user-1", joinedAt: new Date() }];
    renderScorekeeper();
    await waitFor(() => expect(screen.queryByText(/Primary/)).not.toBeInTheDocument());
  });

  it("shows Primary badge when isPrimary and multiple scorers", async () => {
    evState.isPrimary    = true;
    evState.presenceList = [
      { userId: "user-1",   joinedAt: new Date("2026-01-01T00:00:00Z") },
      { userId: "user-2",   joinedAt: new Date("2026-01-01T00:00:01Z") },
    ];
    renderScorekeeper();
    await waitFor(() => expect(screen.getByText(/Primary · 2 scorers/)).toBeInTheDocument());
  });

  it("shows Secondary badge when not primary and multiple scorers", async () => {
    evState.isPrimary    = false;
    evState.presenceList = [
      { userId: "user-2",   joinedAt: new Date("2026-01-01T00:00:00Z") },
      { userId: "user-1",   joinedAt: new Date("2026-01-01T00:00:01Z") },
    ];
    renderScorekeeper();
    await waitFor(() => expect(screen.getByText(/Secondary · 2 scorers/)).toBeInTheDocument());
  });

  it("shows scorer count in badge with 3 scorers", async () => {
    evState.isPrimary    = true;
    evState.presenceList = [
      { userId: "user-1", joinedAt: new Date("2026-01-01T00:00:00Z") },
      { userId: "user-2", joinedAt: new Date("2026-01-01T00:00:01Z") },
      { userId: "user-3", joinedAt: new Date("2026-01-01T00:00:02Z") },
    ];
    renderScorekeeper();
    await waitFor(() => expect(screen.getByText(/3 scorers/)).toBeInTheDocument());
  });
});

// ── Invite button gating ───────────────────────────────────────────────────────

describe("ScorekeeperV2 — invite scorer button", () => {
  beforeEach(() => { vi.clearAllMocks(); resetState(); });

  it("shows 'Invite scorer' for authenticated non-anonymous user", async () => {
    authState.user = { id: "user-1", is_anonymous: false };
    gameRow.value  = { ...gameRow.value, multi_scorer_enabled: true };
    renderScorekeeper();
    await waitFor(() => expect(screen.getByText("Invite scorer")).toBeInTheDocument());
  });

  it("hides 'Invite scorer' for anonymous (guest) user", async () => {
    authState.user = { id: "anon-1", is_anonymous: true };
    gameRow.value  = { ...gameRow.value, multi_scorer_enabled: true };
    renderScorekeeper();
    await waitFor(() => screen.getByText("Live view →"));
    expect(screen.queryByText("Invite scorer")).not.toBeInTheDocument();
  });

  it("hides 'Invite scorer' when multi_scorer_enabled is false", async () => {
    authState.user = { id: "user-1", is_anonymous: false };
    gameRow.value  = { ...gameRow.value, multi_scorer_enabled: false };
    renderScorekeeper();
    await waitFor(() => screen.getByText("Live view →"));
    expect(screen.queryByText("Invite scorer")).not.toBeInTheDocument();
  });

  it("generates invite link on button click", async () => {
    const { supabase } = await import("../lib/supabase");
    authState.user = { id: "user-1", is_anonymous: false };
    renderScorekeeper();
    await waitFor(() => expect(screen.getByText("Invite scorer")).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByText("Invite scorer")); });
    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith(
      "create_scorekeeper_invite",
      { p_game_id: "game-1" }
    ));
  });

  it("shows invite link panel after generation", async () => {
    const { supabase } = await import("../lib/supabase");
    supabase.rpc.mockResolvedValue({ data: "tok-abc", error: null });
    authState.user = { id: "user-1", is_anonymous: false };
    renderScorekeeper();
    await waitFor(() => expect(screen.getByText("Invite scorer")).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByText("Invite scorer")); });
    await waitFor(() => expect(screen.getByText("Scorer invite link")).toBeInTheDocument());
  });
});

// ── Sync / event error display ────────────────────────────────────────────────

describe("ScorekeeperV2 — error display", () => {
  beforeEach(() => { vi.clearAllMocks(); resetState(); });

  it("shows 'Sync error' when channelStatus is error and eventsError is set", async () => {
    evState.error         = "Realtime channel error — live sync unavailable";
    evState.channelStatus = "error";
    renderScorekeeper();
    await waitFor(() => expect(screen.getByText("Sync error")).toBeInTheDocument());
  });

  it("shows 'Sync error' when channelStatus is timed_out and eventsError is set", async () => {
    evState.error         = "Realtime channel timed out — live sync unavailable";
    evState.channelStatus = "timed_out";
    renderScorekeeper();
    await waitFor(() => expect(screen.getByText("Sync error")).toBeInTheDocument());
  });

  it("shows 'Event error' for non-channel errors", async () => {
    evState.error         = "Insert failed";
    evState.channelStatus = "subscribed";
    renderScorekeeper();
    await waitFor(() => expect(screen.getByText("Event error")).toBeInTheDocument());
  });

  it("shows no error text when eventsError is null", async () => {
    evState.error         = null;
    evState.channelStatus = "subscribed";
    renderScorekeeper();
    await waitFor(() => screen.getByText("Live view →"));
    expect(screen.queryByText("Sync error")).not.toBeInTheDocument();
    expect(screen.queryByText("Event error")).not.toBeInTheDocument();
  });
});

// ── Loading states ─────────────────────────────────────────────────────────────

describe("ScorekeeperV2 — loading", () => {
  beforeEach(() => { vi.clearAllMocks(); resetState(); });

  it("shows 'Loading events…' while useGameEvents is loading", async () => {
    evState.loading = true;
    renderScorekeeper();
    await waitFor(() => expect(screen.getByText("Loading events…")).toBeInTheDocument());
  });

  it("shows game name in header once loaded", async () => {
    evState.loading = false;
    renderScorekeeper();
    await waitFor(() => expect(screen.getByText("Home vs Away")).toBeInTheDocument());
  });
});
