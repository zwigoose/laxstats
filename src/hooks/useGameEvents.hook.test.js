import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useGameEvents } from "./useGameEvents";

// ── Shared mock state (hoisted so vi.mock factory can close over them) ─────────

const st = vi.hoisted(() => ({
  load:   { data: [], error: null },
  insert: { data: [], error: null },
  update: { error: null },
}));

// ── Channel mock ───────────────────────────────────────────────────────────────

const ch = vi.hoisted(() => {
  const c = {
    _handlers:    {},
    _subscribeCb: null,
    on: vi.fn().mockImplementation(function (type, filter, handler) {
      const key = `${type}::${filter?.event ?? "*"}`;
      c._handlers[key] = handler;
      return c;
    }),
    subscribe: vi.fn().mockImplementation(function (cb) {
      c._subscribeCb = cb;
      return c;
    }),
    track:        vi.fn().mockResolvedValue(undefined),
    presenceState: vi.fn().mockReturnValue({}),
    send:         vi.fn().mockResolvedValue(undefined),
  };
  return c;
});

// ── Query-chain mock ───────────────────────────────────────────────────────────
// Handles three distinct call patterns in the hook:
//   LOAD:   .select("*").eq().is().order()      → terminal: order()
//   INSERT: .insert().select()                  → terminal: select(undefined)
//   UPDATE: .update().eq().eq().is()            → terminal: is() after update()

const qm = vi.hoisted(() => {
  let _updatePending = false;
  const q = {
    _reset() { _updatePending = false; },
    select: vi.fn().mockImplementation((arg) =>
      arg === undefined ? Promise.resolve(st.insert) : q
    ),
    eq:     vi.fn().mockReturnThis(),
    is:     vi.fn().mockImplementation(() => {
      if (_updatePending) { _updatePending = false; return Promise.resolve(st.update); }
      return q;
    }),
    order:  vi.fn().mockImplementation(() => Promise.resolve(st.load)),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockImplementation(() => { _updatePending = true; return q; }),
  };
  return q;
});

// ── Supabase module mock ───────────────────────────────────────────────────────

vi.mock("../lib/supabase", () => ({
  supabase: {
    from:          vi.fn().mockReturnValue(qm),
    channel:       vi.fn().mockReturnValue(ch),
    removeChannel: vi.fn(),
  },
}));

// ── Test helpers ───────────────────────────────────────────────────────────────

const GAME_ID = "game-abc";
const USER_ID = "user-xyz";

function renderEvents(gameId = GAME_ID, userId = USER_ID) {
  return renderHook(() => useGameEvents(gameId, userId));
}

// Minimal DB row for load results
function dbRow(overrides = {}) {
  return {
    id: "row-1", seq: 1, group_id: "grp-1", team_idx: 0,
    event_type: "goal", player_num: "7", player_name: "Alice",
    quarter: 1, is_team_stat: false, goal_time: "5:00",
    penalty_time: null, timeout_time: null, is_non_releasable: false,
    penalty_minutes: null, shot_outcome: null, foul_name: null,
    ...overrides,
  };
}

// Minimal entry for commitGroup calls
function entry(overrides = {}) {
  return {
    groupId: "grp-1", teamIdx: 0, event: "goal",
    player: { num: "7", name: "Alice" }, quarter: 1,
    teamStat: false, goalTime: "5:00",
    penaltyTime: undefined, timeoutTime: undefined,
    nonReleasable: false, penaltyMin: undefined,
    shotOutcome: undefined, foulName: undefined,
    ...overrides,
  };
}

function resetMocks() {
  vi.clearAllMocks();
  qm._reset();
  ch._handlers    = {};
  ch._subscribeCb = null;
  ch.presenceState.mockReturnValue({});
  st.load   = { data: [], error: null };
  st.insert = { data: [], error: null };
  st.update = { error: null };
}

// ── Initial load ───────────────────────────────────────────────────────────────

describe("useGameEvents — initial load", () => {
  beforeEach(resetMocks);

  it("starts in loading state", () => {
    const { result } = renderEvents();
    expect(result.current.loading).toBe(true);
  });

  it("sets loading false after load resolves", async () => {
    const { result } = renderEvents();
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it("populates entries from DB rows", async () => {
    st.load = { data: [dbRow()], error: null };
    const { result } = renderEvents();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].event).toBe("goal");
    expect(result.current.entries[0].player).toEqual({ num: "7", name: "Alice" });
  });

  it("entries is empty when DB returns no rows", async () => {
    const { result } = renderEvents();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries).toEqual([]);
  });

  it("sets error and clears loading on DB failure", async () => {
    st.load = { data: null, error: { message: "DB error" } };
    const { result } = renderEvents();
    await waitFor(() => expect(result.current.error).toBe("DB error"));
    expect(result.current.loading).toBe(false);
  });

  it("skips load when gameId is null", async () => {
    const { result } = renderHook(() => useGameEvents(null, USER_ID));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(qm.order).not.toHaveBeenCalled();
  });

  it("skips load when userId is null", async () => {
    const { result } = renderHook(() => useGameEvents(GAME_ID, null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(qm.order).not.toHaveBeenCalled();
  });

  it("queries with correct game_id filter", async () => {
    renderEvents("specific-game", USER_ID);
    await waitFor(() => expect(qm.order).toHaveBeenCalled());
    expect(qm.eq).toHaveBeenCalledWith("game_id", "specific-game");
  });
});

// ── Channel subscription ───────────────────────────────────────────────────────

describe("useGameEvents — channel subscription", () => {
  beforeEach(resetMocks);

  it("subscribes to channel named after the game", async () => {
    const { supabase } = await import("../lib/supabase");
    renderEvents();
    await waitFor(() => expect(result => result).toBeTruthy());
    expect(supabase.channel).toHaveBeenCalledWith(
      `game-events-${GAME_ID}`,
      expect.objectContaining({ config: { presence: { key: USER_ID } } })
    );
  });

  it("calls track() with online_at after SUBSCRIBED", async () => {
    const { result } = renderEvents();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await ch._subscribeCb?.("SUBSCRIBED"); });
    expect(ch.track).toHaveBeenCalledWith({ online_at: expect.any(String) });
  });

  it("channelStatus becomes 'subscribed' after SUBSCRIBED", async () => {
    const { result } = renderEvents();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await ch._subscribeCb?.("SUBSCRIBED"); });
    expect(result.current.channelStatus).toBe("subscribed");
  });

  it("channelStatus becomes 'error' and sets error message on CHANNEL_ERROR", async () => {
    const { result } = renderEvents();
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { ch._subscribeCb?.("CHANNEL_ERROR"); });
    await waitFor(() => expect(result.current.channelStatus).toBe("error"));
    expect(result.current.error).toMatch(/Realtime channel error/);
  });

  it("channelStatus becomes 'timed_out' on TIMED_OUT", async () => {
    const { result } = renderEvents();
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { ch._subscribeCb?.("TIMED_OUT"); });
    await waitFor(() => expect(result.current.channelStatus).toBe("timed_out"));
  });

  it("clears Realtime error when channel reconnects", async () => {
    const { result } = renderEvents();
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { ch._subscribeCb?.("CHANNEL_ERROR"); });
    await waitFor(() => expect(result.current.error).toBeTruthy());
    await act(async () => { await ch._subscribeCb?.("SUBSCRIBED"); });
    expect(result.current.error).toBeNull();
  });

  it("does NOT clear non-Realtime errors on reconnect", async () => {
    st.load = { data: null, error: { message: "DB error" } };
    const { result } = renderEvents();
    await waitFor(() => expect(result.current.error).toBe("DB error"));
    await act(async () => { await ch._subscribeCb?.("SUBSCRIBED"); });
    expect(result.current.error).toBe("DB error");
  });

  it("removes channel on unmount", async () => {
    const { supabase } = await import("../lib/supabase");
    const { unmount } = renderEvents();
    await waitFor(() => expect(result => result).toBeTruthy());
    unmount();
    expect(supabase.removeChannel).toHaveBeenCalledWith(ch);
  });
});

// ── Presence ───────────────────────────────────────────────────────────────────

describe("useGameEvents — presence", () => {
  beforeEach(resetMocks);

  it("presenceList starts empty", async () => {
    const { result } = renderEvents();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.presenceList).toEqual([]);
  });

  it("isPrimary is true when presenceList is empty", async () => {
    const { result } = renderEvents();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isPrimary).toBe(true);
  });

  it("populates presenceList from sync event state", async () => {
    const { result } = renderEvents();
    await waitFor(() => expect(result.current.loading).toBe(false));
    ch.presenceState.mockReturnValue({
      [USER_ID]: [{ online_at: "2026-01-01T00:00:00.000Z" }],
    });
    await act(async () => { ch._handlers["presence::sync"]?.(); });
    expect(result.current.presenceList).toHaveLength(1);
    expect(result.current.presenceList[0].userId).toBe(USER_ID);
  });

  it("isPrimary true when current user joined first", async () => {
    const { result } = renderEvents();
    await waitFor(() => expect(result.current.loading).toBe(false));
    ch.presenceState.mockReturnValue({
      [USER_ID]:    [{ online_at: "2026-01-01T00:00:00.000Z" }],
      "other-user": [{ online_at: "2026-01-01T00:00:01.000Z" }],
    });
    await act(async () => { ch._handlers["presence::sync"]?.(); });
    expect(result.current.isPrimary).toBe(true);
  });

  it("isPrimary false when current user joined second", async () => {
    const { result } = renderEvents();
    await waitFor(() => expect(result.current.loading).toBe(false));
    ch.presenceState.mockReturnValue({
      "other-user": [{ online_at: "2026-01-01T00:00:00.000Z" }],
      [USER_ID]:    [{ online_at: "2026-01-01T00:00:01.000Z" }],
    });
    await act(async () => { ch._handlers["presence::sync"]?.(); });
    expect(result.current.isPrimary).toBe(false);
  });

  it("presenceList sorted by joinedAt ascending", async () => {
    const { result } = renderEvents();
    await waitFor(() => expect(result.current.loading).toBe(false));
    ch.presenceState.mockReturnValue({
      "z-user": [{ online_at: "2026-01-01T00:00:02.000Z" }],
      "a-user": [{ online_at: "2026-01-01T00:00:01.000Z" }],
      [USER_ID]: [{ online_at: "2026-01-01T00:00:00.000Z" }],
    });
    await act(async () => { ch._handlers["presence::sync"]?.(); });
    expect(result.current.presenceList.map(p => p.userId))
      .toEqual([USER_ID, "a-user", "z-user"]);
  });
});

// ── commitGroup ────────────────────────────────────────────────────────────────

describe("useGameEvents — commitGroup", () => {
  beforeEach(resetMocks);

  it("calls insert with correctly-shaped DB rows", async () => {
    st.insert = { data: [dbRow()], error: null };
    const { result } = renderEvents();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.commitGroup([entry()]); });
    expect(qm.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        game_id:    GAME_ID,
        group_id:   "grp-1",
        team_idx:   0,
        event_type: "goal",
        player_num: "7",
        player_name: "Alice",
        quarter:    1,
        created_by: USER_ID,
        goal_time:  "5:00",
      }),
    ]);
  });

  it("broadcasts new_events to channel after insert", async () => {
    st.insert = { data: [dbRow()], error: null };
    const { result } = renderEvents();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await ch._subscribeCb?.("SUBSCRIBED"); });
    await act(async () => { await result.current.commitGroup([entry()]); });
    expect(ch.send).toHaveBeenCalledWith(expect.objectContaining({
      type:  "broadcast",
      event: "new_events",
      payload: expect.objectContaining({ scorerId: USER_ID }),
    }));
  });

  it("sets error and throws when insert fails", async () => {
    st.insert = { data: null, error: { message: "Insert failed" } };
    const { result } = renderEvents();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      try { await result.current.commitGroup([entry()]); } catch { /* expected throw */ }
    });
    expect(result.current.error).toBe("Insert failed");
  });
});

// ── softDeleteGroup ────────────────────────────────────────────────────────────

describe("useGameEvents — softDeleteGroup", () => {
  beforeEach(resetMocks);

  it("calls update with deleted_at timestamp and deleted_by userId", async () => {
    const { result } = renderEvents();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.softDeleteGroup("grp-uuid"); });
    expect(qm.update).toHaveBeenCalledWith(expect.objectContaining({
      deleted_by: USER_ID,
      deleted_at: expect.any(String),
    }));
  });

  it("filters update by game_id and group_id", async () => {
    const { result } = renderEvents();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.softDeleteGroup("grp-uuid"); });
    expect(qm.eq).toHaveBeenCalledWith("game_id", GAME_ID);
    expect(qm.eq).toHaveBeenCalledWith("group_id", "grp-uuid");
  });

  it("removes deleted group from local entries immediately", async () => {
    st.load = { data: [dbRow({ group_id: "grp-uuid" })], error: null };
    const { result } = renderEvents();
    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    await act(async () => { await result.current.softDeleteGroup("grp-uuid"); });
    expect(result.current.entries).toHaveLength(0);
  });

  it("broadcasts delete_group event to channel", async () => {
    const { result } = renderEvents();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await ch._subscribeCb?.("SUBSCRIBED"); });
    await act(async () => { await result.current.softDeleteGroup("grp-uuid"); });
    expect(ch.send).toHaveBeenCalledWith(expect.objectContaining({
      type:  "broadcast",
      event: "delete_group",
      payload: expect.objectContaining({ groupId: "grp-uuid", scorerId: USER_ID }),
    }));
  });

  it("sets error when update fails", async () => {
    st.update = { error: { message: "Update failed" } };
    const { result } = renderEvents();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      try { await result.current.softDeleteGroup("grp-uuid"); } catch { /* expected throw */ }
    });
    expect(result.current.error).toBe("Update failed");
  });
});
