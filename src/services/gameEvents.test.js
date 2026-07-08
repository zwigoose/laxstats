import { describe, it, expect, vi } from "vitest";
import {
  fetchGameEvents, appendGameEvents, softDeleteEventGroup, insertMetaEvent,
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


// ── appendGameEvents ───────────────────────────────────────────────────────────

describe("appendGameEvents", () => {
  it("upserts with onConflict id and ignoreDuplicates (idempotent retries)", async () => {
    const chain = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({ data: [{ id: "r1" }], error: null }),
    };
    const db = { from: vi.fn().mockReturnValue(chain) };
    const rows = [{ id: "r1", event_type: "goal" }];
    const result = await appendGameEvents(rows, db);
    expect(db.from).toHaveBeenCalledWith("game_events");
    expect(chain.upsert).toHaveBeenCalledWith(rows, { onConflict: "id", ignoreDuplicates: true });
    expect(result.data).toEqual([{ id: "r1" }]);
  });
});

// ── softDeleteEventGroup ───────────────────────────────────────────────────────

describe("softDeleteEventGroup", () => {
  it("calls the soft_delete_event_group RPC with game and group ids", async () => {
    const db = { rpc: vi.fn().mockResolvedValue({ data: null, error: null }) };
    await softDeleteEventGroup("g1", "grp-1", db);
    expect(db.rpc).toHaveBeenCalledWith("soft_delete_event_group", {
      p_game_id: "g1", p_group_id: "grp-1",
    });
  });
});
