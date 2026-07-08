import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useGameLog } from "./useGameLog";
import { useOnlineStatus } from "./useOnlineStatus";

// ── Shared mock state ──────────────────────────────────────────────────────────

const st = vi.hoisted(() => ({
  load:       { data: [], error: null },
  insert:     { data: [], error: null },   // result of appendGameEvents upsert
  metaInsert: { data: null, error: null }, // result of insertMetaEvent
  rpc:        { data: null, error: null }, // result of rpc calls (soft_delete_event_group…)
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
    track:         vi.fn().mockResolvedValue(undefined),
    presenceState: vi.fn().mockReturnValue({}),
    send:          vi.fn().mockResolvedValue(undefined),
  };
  return c;
});

// ── Query-chain mock ───────────────────────────────────────────────────────────
// select() with an arg continues the chain (fetch path: .select().eq().is().order());
// select() with no arg terminates a write chain and must support both
// `await q.select()` (upsert path) and `q.select().single()` (meta insert path).

const qm = vi.hoisted(() => {
  const writeResult = () => ({
    then:   (onF, onR) => Promise.resolve(st.insert).then(onF, onR),
    single: () => Promise.resolve(st.metaInsert),
  });
  const q = {
    select: vi.fn().mockImplementation((arg) => (arg === undefined ? writeResult() : q)),
    eq:     vi.fn().mockReturnThis(),
    is:     vi.fn().mockReturnThis(),
    order:  vi.fn().mockImplementation(() => Promise.resolve(st.load)),
    insert: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
  };
  return q;
});

// ── Stateful outbox fake ───────────────────────────────────────────────────────
// The real outbox is IndexedDB; here it's an in-memory array so the
// outbox-first flow (enqueue → flush → remove) can be observed end to end.

const ob = vi.hoisted(() => {
  let ops = [];
  let clock = 0;
  return {
    _ops: () => ops,
    _seed(op) { ops.push({ opId: `seeded-${++clock}`, createdAt: clock, ...op }); },
    _reset() { ops = []; clock = 0; },
    enqueueOp: vi.fn(async (op) => {
      const record = { opId: `op-${++clock}`, createdAt: clock, ...op };
      ops.push(record);
      return record.opId;
    }),
    getPendingOps: vi.fn(async (gameId) =>
      ops.filter(o => o.gameId === gameId).sort((a, b) => a.createdAt - b.createdAt)
    ),
    removeOp: vi.fn(async (opId) => {
      ops = ops.filter(o => o.opId !== opId);
    }),
    getPendingCount: vi.fn(async (gameId) => ops.filter(o => o.gameId === gameId).length),
  };
});

vi.mock("../services/outbox", () => ob);

// ── Online-status mock — defaults to online ────────────────────────────────────

const onlineState = vi.hoisted(() => ({ value: true }));

vi.mock("./useOnlineStatus", () => ({
  useOnlineStatus: vi.fn(() => onlineState.value),
}));

// ── Supabase mock ──────────────────────────────────────────────────────────────

vi.mock("../lib/supabase", () => ({
  supabase: {
    from:          vi.fn().mockReturnValue(qm),
    channel:       vi.fn().mockReturnValue(ch),
    removeChannel: vi.fn(),
    rpc:           vi.fn(() => Promise.resolve(st.rpc)),
  },
}));

// ── Test helpers ───────────────────────────────────────────────────────────────

const GAME_ID = "game-abc";
const USER_ID = "user-xyz";

function renderLog(gameId = GAME_ID, userId = USER_ID) {
  return renderHook(() => useGameLog(gameId, userId));
}

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
  ob._reset();
  ch._handlers    = {};
  ch._subscribeCb = null;
  ch.presenceState.mockReturnValue({});
  st.load       = { data: [], error: null };
  st.insert     = { data: [], error: null };
  st.metaInsert = { data: null, error: null };
  st.rpc        = { data: null, error: null };
  onlineState.value = true;
  useOnlineStatus.mockImplementation(() => true);
}

// ── Initial load ───────────────────────────────────────────────────────────────

describe("useGameLog — initial load", () => {
  beforeEach(resetMocks);

  it("starts in loading state", () => {
    const { result } = renderLog();
    expect(result.current.loading).toBe(true);
  });

  it("sets loading false after load resolves", async () => {
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it("populates entries from DB rows", async () => {
    st.load = { data: [dbRow()], error: null };
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].event).toBe("goal");
    expect(result.current.entries[0].player).toEqual({ num: "7", name: "Alice" });
  });

  it("entries is empty when DB returns no rows", async () => {
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries).toEqual([]);
  });

  it("sets error and clears loading on DB failure", async () => {
    st.load = { data: null, error: { message: "DB error" } };
    const { result } = renderLog();
    await waitFor(() => expect(result.current.error).toBe("DB error"));
    expect(result.current.loading).toBe(false);
  });

  it("skips load when gameId is null", async () => {
    const { result } = renderHook(() => useGameLog(null, USER_ID));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(qm.order).not.toHaveBeenCalled();
  });

  it("skips load when userId is null", async () => {
    const { result } = renderHook(() => useGameLog(GAME_ID, null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(qm.order).not.toHaveBeenCalled();
  });

  it("queries with correct game_id filter", async () => {
    renderLog("specific-game", USER_ID);
    await waitFor(() => expect(qm.order).toHaveBeenCalled());
    expect(qm.eq).toHaveBeenCalledWith("game_id", "specific-game");
  });
});

// ── Channel subscription ───────────────────────────────────────────────────────

describe("useGameLog — channel subscription", () => {
  beforeEach(resetMocks);

  it("subscribes to channel named after the game", async () => {
    const { supabase } = await import("../lib/supabase");
    renderLog();
    await waitFor(() => expect(result => result).toBeTruthy());
    expect(supabase.channel).toHaveBeenCalledWith(
      `game-events-${GAME_ID}`,
      expect.objectContaining({ config: { presence: { key: USER_ID } } })
    );
  });

  it("calls track() with online_at after SUBSCRIBED", async () => {
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await ch._subscribeCb?.("SUBSCRIBED"); });
    expect(ch.track).toHaveBeenCalledWith({ online_at: expect.any(String) });
  });

  it("channelStatus becomes 'subscribed' after SUBSCRIBED", async () => {
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await ch._subscribeCb?.("SUBSCRIBED"); });
    expect(result.current.channelStatus).toBe("subscribed");
  });

  it("channelStatus becomes 'error' and sets error message on CHANNEL_ERROR", async () => {
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { ch._subscribeCb?.("CHANNEL_ERROR"); });
    await waitFor(() => expect(result.current.channelStatus).toBe("error"));
    expect(result.current.error).toMatch(/Realtime channel error/);
  });

  it("channelStatus becomes 'timed_out' on TIMED_OUT", async () => {
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { ch._subscribeCb?.("TIMED_OUT"); });
    await waitFor(() => expect(result.current.channelStatus).toBe("timed_out"));
  });

  it("clears Realtime error when channel reconnects", async () => {
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { ch._subscribeCb?.("CHANNEL_ERROR"); });
    await waitFor(() => expect(result.current.error).toBeTruthy());
    await act(async () => { await ch._subscribeCb?.("SUBSCRIBED"); });
    expect(result.current.error).toBeNull();
  });

  it("does NOT clear non-Realtime errors on reconnect", async () => {
    st.load = { data: null, error: { message: "DB error" } };
    const { result } = renderLog();
    await waitFor(() => expect(result.current.error).toBe("DB error"));
    await act(async () => { await ch._subscribeCb?.("SUBSCRIBED"); });
    expect(result.current.error).toBe("DB error");
  });

  it("removes channel on unmount", async () => {
    const { supabase } = await import("../lib/supabase");
    const { unmount } = renderLog();
    await waitFor(() => expect(result => result).toBeTruthy());
    unmount();
    expect(supabase.removeChannel).toHaveBeenCalledWith(ch);
  });
});

// ── Presence ───────────────────────────────────────────────────────────────────

describe("useGameLog — presence", () => {
  beforeEach(resetMocks);

  it("presenceList starts empty", async () => {
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.presenceList).toEqual([]);
  });

  it("isPrimary is true when presenceList is empty", async () => {
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isPrimary).toBe(true);
  });

  it("populates presenceList from sync event state", async () => {
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    ch.presenceState.mockReturnValue({
      [USER_ID]: [{ online_at: "2026-01-01T00:00:00.000Z" }],
    });
    await act(async () => { ch._handlers["presence::sync"]?.(); });
    expect(result.current.presenceList).toHaveLength(1);
    expect(result.current.presenceList[0].userId).toBe(USER_ID);
  });

  it("isPrimary true when current user joined first", async () => {
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    ch.presenceState.mockReturnValue({
      [USER_ID]:    [{ online_at: "2026-01-01T00:00:00.000Z" }],
      "other-user": [{ online_at: "2026-01-01T00:00:01.000Z" }],
    });
    await act(async () => { ch._handlers["presence::sync"]?.(); });
    expect(result.current.isPrimary).toBe(true);
  });

  it("isPrimary false when current user joined second", async () => {
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    ch.presenceState.mockReturnValue({
      "other-user": [{ online_at: "2026-01-01T00:00:00.000Z" }],
      [USER_ID]:    [{ online_at: "2026-01-01T00:00:01.000Z" }],
    });
    await act(async () => { ch._handlers["presence::sync"]?.(); });
    expect(result.current.isPrimary).toBe(false);
  });

  it("presenceList sorted by joinedAt ascending", async () => {
    const { result } = renderLog();
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

// ── commitGroup (online, outbox-first) ─────────────────────────────────────────

describe("useGameLog — commitGroup (online)", () => {
  beforeEach(resetMocks);

  it("upserts correctly-shaped DB rows with client-generated ids", async () => {
    st.insert = { data: [dbRow()], error: null };
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.commitGroup([entry()]); });
    expect(qm.upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id:         expect.any(String),   // stamped once at commit time
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
      ],
      { onConflict: "id", ignoreDuplicates: true }
    );
  });

  it("goes through the outbox: enqueues, then removes after flush", async () => {
    st.insert = { data: [dbRow()], error: null };
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.commitGroup([entry()]); });
    expect(ob.enqueueOp).toHaveBeenCalledWith(
      expect.objectContaining({ gameId: GAME_ID, kind: "append" })
    );
    expect(ob._ops()).toHaveLength(0);          // flushed and removed
    expect(result.current.pendingCount).toBe(0);
  });

  it("merges own committed rows (with server seq) into entries", async () => {
    st.insert = { data: [dbRow({ id: "own-row", seq: 42 })], error: null };
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.commitGroup([entry()]); });
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0]).toEqual(
      expect.objectContaining({ dbId: "own-row", seq: 42 })
    );
  });

  it("broadcasts new_events to channel after upsert", async () => {
    st.insert = { data: [dbRow()], error: null };
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await ch._subscribeCb?.("SUBSCRIBED"); });
    await act(async () => { await result.current.commitGroup([entry()]); });
    expect(ch.send).toHaveBeenCalledWith(expect.objectContaining({
      type:  "broadcast",
      event: "new_events",
      payload: expect.objectContaining({ scorerId: USER_ID }),
    }));
  });

  it("skips the broadcast when the upsert was a duplicate no-op (empty result)", async () => {
    st.insert = { data: [], error: null };
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await ch._subscribeCb?.("SUBSCRIBED"); });
    await act(async () => { await result.current.commitGroup([entry()]); });
    expect(ch.send).not.toHaveBeenCalledWith(
      expect.objectContaining({ event: "new_events" })
    );
  });

  it("sets error, throws, and drops the op on a hard (non-network) failure", async () => {
    st.insert = { data: null, error: { message: "unknown event_type: bogus" } };
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    let threw = false;
    await act(async () => {
      try { await result.current.commitGroup([entry()]); } catch { threw = true; }
    });
    expect(threw).toBe(true);
    expect(result.current.error).toBe("unknown event_type: bogus");
    expect(ob._ops()).toHaveLength(0);          // poison op dropped, queue not jammed
  });
});

// ── commitGroup (offline) ──────────────────────────────────────────────────────

describe("useGameLog — commitGroup (offline)", () => {
  beforeEach(() => {
    resetMocks();
    onlineState.value = false;
    useOnlineStatus.mockImplementation(() => false);
  });

  it("queues the op when offline instead of upserting", async () => {
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.commitGroup([entry()]); });
    expect(ob._ops()).toHaveLength(1);
    expect(ob._ops()[0].kind).toBe("append");
    expect(qm.upsert).not.toHaveBeenCalled();
  });

  it("stamps dbId on queued entries so a later flush is idempotent", async () => {
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.commitGroup([entry()]); });
    expect(ob._ops()[0].entries[0].dbId).toEqual(expect.any(String));
  });

  it("increments pendingCount when offline op is queued", async () => {
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.commitGroup([entry()]); });
    expect(result.current.pendingCount).toBe(1);
  });

  it("does not broadcast when offline", async () => {
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await ch._subscribeCb?.("SUBSCRIBED"); });
    await act(async () => { await result.current.commitGroup([entry()]); });
    expect(ch.send).not.toHaveBeenCalled();
  });
});

// ── commitGroup — network error fallback ───────────────────────────────────────

describe("useGameLog — commitGroup (network error fallback)", () => {
  beforeEach(resetMocks);

  it("leaves the op queued when online but the request fails with 'Failed to fetch'", async () => {
    st.insert = { data: null, error: { message: "Failed to fetch" } };
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.commitGroup([entry()]); });
    expect(ob._ops()).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it("reflects the queued op in pendingCount", async () => {
    st.insert = { data: null, error: { message: "Failed to fetch" } };
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.commitGroup([entry()]); });
    expect(result.current.pendingCount).toBe(1);
  });
});

// ── commitMetaEvent ────────────────────────────────────────────────────────────

describe("useGameLog — commitMetaEvent (stream append)", () => {
  beforeEach(resetMocks);

  const streamMetaRow = {
    id: "meta-1", seq: 7, game_id: GAME_ID, group_id: "grp-m1",
    event_type: "quarter_end", team_idx: null, quarter: null,
    payload: { fromQuarter: 1, toQuarter: 2 },
  };

  it("appends a meta event to the stream and resolves with the inserted row", async () => {
    st.insert = { data: [streamMetaRow], error: null };
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    let returned;
    await act(async () => {
      returned = await result.current.commitMetaEvent("quarter_end", 1, 2);
    });
    expect(returned).toEqual(streamMetaRow);
    expect(qm.upsert).toHaveBeenCalledWith(
      [expect.objectContaining({
        event_type: "quarter_end",
        payload:    { fromQuarter: 1, toQuarter: 2 },
        team_idx:   null,
        quarter:    null,
      })],
      { onConflict: "id", ignoreDuplicates: true }
    );
    expect(result.current.derivedQuarterState).toEqual({
      currentQuarter: 2, completedQuarters: [1], gameOver: false,
    });
  });

  it("broadcasts meta_update (legacy hint) and new_events after commit", async () => {
    st.insert = { data: [streamMetaRow], error: null };
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await ch._subscribeCb?.("SUBSCRIBED"); });
    await act(async () => { await result.current.commitMetaEvent("quarter_end", 1, 2); });
    expect(ch.send).toHaveBeenCalledWith(expect.objectContaining({
      event:   "meta_update",
      payload: expect.objectContaining({ scorerId: USER_ID, currentQuarter: 2 }),
    }));
    expect(ch.send).toHaveBeenCalledWith(expect.objectContaining({
      event: "new_events",
    }));
  });

  it("does not double-apply its own meta row when it echoes back via realtime", async () => {
    st.insert = { data: [streamMetaRow], error: null };
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.commitMetaEvent("quarter_end", 1, 2); });
    // postgres_changes fallback echoes the same row back
    await act(async () => {
      ch._handlers["postgres_changes::*"]; // trigger registration exists
    });
    const pgHandlers = ch.on.mock.calls
      .filter(([type, f]) => type === "postgres_changes" && f.event === "INSERT" && f.table === "game_events")
      .map(([, , handler]) => handler);
    await act(async () => { pgHandlers.forEach(h => h({ new: streamMetaRow })); });
    expect(result.current.derivedQuarterState).toEqual({
      currentQuarter: 2, completedQuarters: [1], gameOver: false,   // not [1, 1]
    });
  });

  it("returns a synthetic stub and queues an append op when offline", async () => {
    onlineState.value = false;
    useOnlineStatus.mockImplementation(() => false);
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    let returned;
    await act(async () => {
      returned = await result.current.commitMetaEvent("game_over", 4, 4);
    });
    expect(returned).toEqual(expect.objectContaining({
      event_type: "game_over", from_quarter: 4, to_quarter: 4, seq: null,
    }));
    expect(ob._ops()).toHaveLength(1);
    expect(ob._ops()[0].kind).toBe("append");
    expect(ob._ops()[0].entries[0]).toEqual(expect.objectContaining({
      event: "game_over", payload: { fromQuarter: 4, toQuarter: 4 },
    }));
  });
});

// ── softDeleteGroup ────────────────────────────────────────────────────────────

describe("useGameLog — softDeleteGroup (online)", () => {
  beforeEach(resetMocks);

  it("calls the soft_delete_event_group RPC with game and group ids", async () => {
    const { supabase } = await import("../lib/supabase");
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.softDeleteGroup("grp-uuid"); });
    expect(supabase.rpc).toHaveBeenCalledWith("soft_delete_event_group", {
      p_game_id: GAME_ID, p_group_id: "grp-uuid",
    });
  });

  it("removes deleted group from local entries immediately", async () => {
    st.load = { data: [dbRow({ group_id: "grp-uuid" })], error: null };
    const { result } = renderLog();
    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    await act(async () => { await result.current.softDeleteGroup("grp-uuid"); });
    expect(result.current.entries).toHaveLength(0);
  });

  it("broadcasts delete_group event to channel", async () => {
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await ch._subscribeCb?.("SUBSCRIBED"); });
    await act(async () => { await result.current.softDeleteGroup("grp-uuid"); });
    expect(ch.send).toHaveBeenCalledWith(expect.objectContaining({
      type:  "broadcast",
      event: "delete_group",
      payload: expect.objectContaining({ groupId: "grp-uuid", scorerId: USER_ID }),
    }));
  });

  it("sets error and throws when the RPC fails with a non-network error", async () => {
    st.rpc = { data: null, error: { message: "not authorized to modify this game" } };
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    let threw = false;
    await act(async () => {
      try { await result.current.softDeleteGroup("grp-uuid"); } catch { threw = true; }
    });
    expect(threw).toBe(true);
    expect(result.current.error).toBe("not authorized to modify this game");
  });
});

describe("useGameLog — softDeleteGroup (offline)", () => {
  beforeEach(() => {
    resetMocks();
    onlineState.value = false;
    useOnlineStatus.mockImplementation(() => false);
  });

  it("queues the delete when offline instead of calling the RPC", async () => {
    const { supabase } = await import("../lib/supabase");
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.softDeleteGroup("grp-uuid"); });
    expect(ob._ops()).toHaveLength(1);
    expect(ob._ops()[0]).toEqual(expect.objectContaining({
      kind: "soft_delete", groupId: "grp-uuid",
    }));
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("still removes the group from local entries when offline", async () => {
    st.load = { data: [dbRow({ group_id: "grp-uuid" })], error: null };
    const { result } = renderLog();
    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    await act(async () => { await result.current.softDeleteGroup("grp-uuid"); });
    expect(result.current.entries).toHaveLength(0);
  });

  it("increments pendingCount when delete is queued", async () => {
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.softDeleteGroup("grp-uuid"); });
    expect(result.current.pendingCount).toBe(1);
  });
});

// ── Flush on reconnect ─────────────────────────────────────────────────────────

describe("useGameLog — outbox flush", () => {
  beforeEach(resetMocks);

  it("flushes queued append ops on mount when online", async () => {
    ob._seed({ gameId: GAME_ID, kind: "append", entries: [entry({ groupId: "offline-grp", dbId: "id-1" })] });
    st.insert = { data: [dbRow({ group_id: "offline-grp" })], error: null };

    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(ob._ops()).toHaveLength(0));
    expect(qm.upsert).toHaveBeenCalled();
  });

  it("flushes queued soft-deletes via the RPC", async () => {
    const { supabase } = await import("../lib/supabase");
    ob._seed({ gameId: GAME_ID, kind: "soft_delete", groupId: "grp-del" });

    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(ob._ops()).toHaveLength(0));
    expect(supabase.rpc).toHaveBeenCalledWith("soft_delete_event_group", {
      p_game_id: GAME_ID, p_group_id: "grp-del",
    });
  });

  it("flushes ops in strict FIFO order across kinds", async () => {
    const { supabase } = await import("../lib/supabase");
    ob._seed({ gameId: GAME_ID, kind: "append", entries: [entry({ dbId: "id-1" })] });
    ob._seed({ gameId: GAME_ID, kind: "soft_delete", groupId: "grp-1" });
    st.insert = { data: [dbRow()], error: null };

    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(ob._ops()).toHaveLength(0));
    expect(qm.upsert.mock.invocationCallOrder[0])
      .toBeLessThan(supabase.rpc.mock.invocationCallOrder[0]);
  });

  it("broadcasts flushed events to the channel", async () => {
    ob._seed({ gameId: GAME_ID, kind: "append", entries: [entry({ groupId: "sync-grp", dbId: "id-2" })] });
    st.insert = { data: [dbRow({ group_id: "sync-grp" })], error: null };

    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await ch._subscribeCb?.("SUBSCRIBED"); });
    await waitFor(() => expect(ob._ops()).toHaveLength(0));

    expect(ch.send).toHaveBeenCalledWith(expect.objectContaining({
      event:   "new_events",
      payload: expect.objectContaining({ scorerId: USER_ID }),
    }));
  });

  it("syncStatus transitions to 'synced' after successful flush", async () => {
    ob._seed({ gameId: GAME_ID, kind: "append", entries: [entry({ dbId: "id-3" })] });
    st.insert = { data: [dbRow()], error: null };

    const { result } = renderLog();
    await waitFor(() => expect(result.current.syncStatus).toBe("synced"));
  });

  it("syncStatus stays 'idle' when there is nothing to flush", async () => {
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.syncStatus).toBe("idle");
  });

  it("drops the op and reports 'error' when a flush fails hard", async () => {
    ob._seed({ gameId: GAME_ID, kind: "append", entries: [entry({ dbId: "id-4" })] });
    st.insert = { data: null, error: { message: "Sync insert failed" } };

    const { result } = renderLog();
    await waitFor(() => expect(result.current.syncStatus).toBe("error"));
    expect(result.current.error).toBe("Sync insert failed");
    expect(ob._ops()).toHaveLength(0);   // dropped, not retried forever
  });

  it("keeps ops queued when the flush hits a network error", async () => {
    ob._seed({ gameId: GAME_ID, kind: "append", entries: [entry({ dbId: "id-5" })] });
    ob._seed({ gameId: GAME_ID, kind: "soft_delete", groupId: "grp-x" });
    st.insert = { data: null, error: { message: "Failed to fetch" } };

    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(result.current.pendingCount).toBe(2));
    expect(ob._ops()).toHaveLength(2);   // both remain for the next reconnect
  });

  it("initialises pendingCount from the outbox on mount when offline", async () => {
    onlineState.value = false;
    useOnlineStatus.mockImplementation(() => false);
    ob._seed({ gameId: GAME_ID, kind: "append", entries: [entry({ dbId: "id-6" })] });
    ob._seed({ gameId: GAME_ID, kind: "meta", row: { event_type: "quarter_end" } });
    ob._seed({ gameId: GAME_ID, kind: "soft_delete", groupId: "g" });

    const { result } = renderLog();
    await waitFor(() => expect(result.current.pendingCount).toBe(3));
  });
});

// ── isOnline exposure ──────────────────────────────────────────────────────────

describe("useGameLog — isOnline", () => {
  it("exposes isOnline=true when navigator.onLine=true", async () => {
    resetMocks();
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isOnline).toBe(true);
  });

  it("exposes isOnline=false when useOnlineStatus returns false", async () => {
    resetMocks();
    onlineState.value = false;
    useOnlineStatus.mockImplementation(() => false);
    const { result } = renderLog();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isOnline).toBe(false);
  });
});
