import { describe, it, expect, vi } from "vitest";
import {
  fetchGameEvents, insertGameEvents, softDeleteGameEvents,
  fetchMetaEvents, insertMetaEvent, deriveQuarterState,
} from "./gameEvents";

// ── Fake DB builder ────────────────────────────────────────────────────────────

function fakeChain(result) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    is:     vi.fn().mockReturnThis(),   // intermediate by default
    order:  vi.fn().mockResolvedValue(result),  // terminal for fetch
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  };
  return chain;
}

function fakeDb(result = { data: [], error: null }) {
  const chain = fakeChain(result);
  return { from: vi.fn().mockReturnValue(chain), _chain: chain };
}

// ── fetchGameEvents ────────────────────────────────────────────────────────────

describe("fetchGameEvents", () => {
  it("queries game_events filtered by game_id, non-deleted, ordered by seq", async () => {
    const db = fakeDb({ data: [], error: null });
    await fetchGameEvents("g1", db);
    expect(db.from).toHaveBeenCalledWith("game_events");
    expect(db._chain.eq).toHaveBeenCalledWith("game_id", "g1");
    expect(db._chain.is).toHaveBeenCalledWith("deleted_at", null);
    expect(db._chain.order).toHaveBeenCalledWith("seq");
  });

  it("returns rows from the DB", async () => {
    const rows = [{ id: "row-1", seq: 1 }, { id: "row-2", seq: 2 }];
    const db = fakeDb({ data: rows, error: null });
    // order() is the terminal call — mock it to resolve with rows
    db._chain.order.mockResolvedValue({ data: rows, error: null });
    const result = await fetchGameEvents("g1", db);
    expect(result.data).toEqual(rows);
  });

  it("propagates DB errors", async () => {
    const db = fakeDb();
    db._chain.order.mockResolvedValue({ data: null, error: { message: "DB error" } });
    const result = await fetchGameEvents("g1", db);
    expect(result.error.message).toBe("DB error");
  });
});

// ── insertGameEvents ───────────────────────────────────────────────────────────

describe("insertGameEvents", () => {
  it("inserts rows into game_events and selects", async () => {
    const chain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({ data: [{ id: "row-1" }], error: null }),
    };
    const db = { from: vi.fn().mockReturnValue(chain) };
    const rows = [{ game_id: "g1", event_type: "goal" }];
    const result = await insertGameEvents(rows, db);
    expect(db.from).toHaveBeenCalledWith("game_events");
    expect(chain.insert).toHaveBeenCalledWith(rows);
    expect(chain.select).toHaveBeenCalled();
    expect(result.data).toEqual([{ id: "row-1" }]);
  });

  it("propagates insert errors", async () => {
    const chain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({ data: null, error: { message: "Insert failed" } }),
    };
    const db = { from: vi.fn().mockReturnValue(chain) };
    const result = await insertGameEvents([], db);
    expect(result.error.message).toBe("Insert failed");
  });
});

// ── softDeleteGameEvents ───────────────────────────────────────────────────────

describe("softDeleteGameEvents", () => {
  it("updates deleted_at and deleted_by on matching rows", async () => {
    const chain = {
      update: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockReturnThis(),
      is:     vi.fn().mockResolvedValue({ error: null }),
    };
    const db = { from: vi.fn().mockReturnValue(chain) };
    await softDeleteGameEvents("g1", "grp-uuid", "user-1", db);
    expect(db.from).toHaveBeenCalledWith("game_events");
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({
      deleted_by: "user-1",
      deleted_at: expect.any(String),
    }));
    expect(chain.eq).toHaveBeenCalledWith("game_id", "g1");
    expect(chain.eq).toHaveBeenCalledWith("group_id", "grp-uuid");
    expect(chain.is).toHaveBeenCalledWith("deleted_at", null);
  });

  it("only targets non-deleted rows via is(deleted_at, null)", async () => {
    const chain = {
      update: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockReturnThis(),
      is:     vi.fn().mockResolvedValue({ error: null }),
    };
    const db = { from: vi.fn().mockReturnValue(chain) };
    await softDeleteGameEvents("g1", "grp-uuid", "user-1", db);
    expect(chain.is).toHaveBeenCalledWith("deleted_at", null);
  });
});

// ── fetchMetaEvents ────────────────────────────────────────────────────────────

describe("fetchMetaEvents", () => {
  it("queries game_meta_events filtered by game_id ordered by seq", async () => {
    const db = fakeDb({ data: [], error: null });
    await fetchMetaEvents("g1", db);
    expect(db.from).toHaveBeenCalledWith("game_meta_events");
    expect(db._chain.eq).toHaveBeenCalledWith("game_id", "g1");
    expect(db._chain.order).toHaveBeenCalledWith("seq");
  });

  it("returns rows from the DB", async () => {
    const rows = [{ id: "m1", event_type: "quarter_end", from_quarter: 1, to_quarter: 2 }];
    const db = fakeDb({ data: rows, error: null });
    db._chain.order.mockResolvedValue({ data: rows, error: null });
    const result = await fetchMetaEvents("g1", db);
    expect(result.data).toEqual(rows);
  });
});

// ── insertMetaEvent ────────────────────────────────────────────────────────────

describe("insertMetaEvent", () => {
  it("inserts into game_meta_events and returns single row", async () => {
    const row = { game_id: "g1", event_type: "quarter_end", from_quarter: 1, to_quarter: 2 };
    const chain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: row, error: null }),
    };
    const db = { from: vi.fn().mockReturnValue(chain) };
    const result = await insertMetaEvent(row, db);
    expect(db.from).toHaveBeenCalledWith("game_meta_events");
    expect(chain.insert).toHaveBeenCalledWith(row);
    expect(chain.single).toHaveBeenCalled();
    expect(result.data).toEqual(row);
  });

  it("propagates insert errors", async () => {
    const chain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: "Insert failed" } }),
    };
    const db = { from: vi.fn().mockReturnValue(chain) };
    const result = await insertMetaEvent({}, db);
    expect(result.error.message).toBe("Insert failed");
  });
});

// ── deriveQuarterState ─────────────────────────────────────────────────────────

describe("deriveQuarterState", () => {
  it("returns null for empty or missing rows", () => {
    expect(deriveQuarterState([])).toBeNull();
    expect(deriveQuarterState(null)).toBeNull();
    expect(deriveQuarterState(undefined)).toBeNull();
  });

  it("advances quarter on quarter_end", () => {
    const rows = [{ event_type: "quarter_end", from_quarter: 1, to_quarter: 2 }];
    expect(deriveQuarterState(rows)).toEqual({
      currentQuarter: 2,
      completedQuarters: [1],
      gameOver: false,
    });
  });

  it("replays multiple quarter_end events in sequence", () => {
    const rows = [
      { event_type: "quarter_end", from_quarter: 1, to_quarter: 2 },
      { event_type: "quarter_end", from_quarter: 2, to_quarter: 3 },
      { event_type: "quarter_end", from_quarter: 3, to_quarter: 4 },
    ];
    const result = deriveQuarterState(rows);
    expect(result.currentQuarter).toBe(4);
    expect(result.completedQuarters).toEqual([1, 2, 3]);
    expect(result.gameOver).toBe(false);
  });

  it("sets gameOver and preserves from_quarter on game_over", () => {
    const rows = [
      { event_type: "quarter_end", from_quarter: 1, to_quarter: 2 },
      { event_type: "quarter_end", from_quarter: 2, to_quarter: 3 },
      { event_type: "quarter_end", from_quarter: 3, to_quarter: 4 },
      { event_type: "game_over",   from_quarter: 4, to_quarter: null },
    ];
    const result = deriveQuarterState(rows);
    expect(result.gameOver).toBe(true);
    expect(result.currentQuarter).toBe(4);
    expect(result.completedQuarters).toContain(4);
  });

  it("applies quarter_override to currentQuarter", () => {
    const rows = [
      { event_type: "quarter_end",     from_quarter: 1, to_quarter: 2 },
      { event_type: "quarter_override", from_quarter: null, to_quarter: 3 },
    ];
    const result = deriveQuarterState(rows);
    expect(result.currentQuarter).toBe(3);
    expect(result.completedQuarters).toEqual([1]);
  });

  it("quarter_override does not add to completedQuarters", () => {
    const rows = [
      { event_type: "quarter_override", from_quarter: null, to_quarter: 2 },
    ];
    const result = deriveQuarterState(rows);
    expect(result.completedQuarters).toEqual([]);
  });

  it("handles overtime (Q5) correctly", () => {
    const rows = [
      { event_type: "quarter_end", from_quarter: 1, to_quarter: 2 },
      { event_type: "quarter_end", from_quarter: 2, to_quarter: 3 },
      { event_type: "quarter_end", from_quarter: 3, to_quarter: 4 },
      { event_type: "quarter_end", from_quarter: 4, to_quarter: 5 },
    ];
    const result = deriveQuarterState(rows);
    expect(result.currentQuarter).toBe(5);
    expect(result.completedQuarters).toEqual([1, 2, 3, 4]);
  });
});
