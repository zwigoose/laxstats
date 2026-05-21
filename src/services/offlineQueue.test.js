import { describe, it, expect, beforeEach, vi } from "vitest";

// ── IndexedDB fake ─────────────────────────────────────────────────────────────
// vitest-environment jsdom ships with a minimal IDBFactory stub that doesn't
// implement indexes.  We replace it with a fully-functional in-memory fake.

function makeFakeIDB() {
  const stores = {};

  function makeStore(name) {
    if (!stores[name]) stores[name] = [];
    return stores[name];
  }

  function fakeRequest(fn) {
    const req = { onsuccess: null, onerror: null };
    Promise.resolve().then(() => {
      try {
        const result = fn();
        req.result = result;
        req.onsuccess?.({ target: req });
      } catch (err) {
        req.error = err;
        req.onerror?.({ target: req });
      }
    });
    return req;
  }

  function makeObjectStore(name) {
    const store = makeStore(name);
    return {
      add(item) {
        return fakeRequest(() => {
          store.push(item);
          return item.queueId;
        });
      },
      delete(key) {
        return fakeRequest(() => {
          const i = store.findIndex(r => r.queueId === key);
          if (i !== -1) store.splice(i, 1);
        });
      },
      index() {
        return {
          getAll(gameId) {
            return fakeRequest(() => store.filter(r => r.gameId === gameId));
          },
        };
      },
    };
  }

  const db = {
    objectStoreNames: { contains: () => false },
    createObjectStore(name) {
      makeStore(name);
      return { createIndex: vi.fn() };
    },
    transaction: (name) => ({ objectStore: () => makeObjectStore(name) }),
  };

  const openReq = { onupgradeneeded: null, onsuccess: null, onerror: null };
  Promise.resolve().then(() => {
    // Pass oldVersion: 0 so both upgrade branches (< 1 and < 2) run
    openReq.onupgradeneeded?.({ target: { result: db, transaction: {} }, oldVersion: 0 });
    openReq.result = db;
    openReq.onsuccess?.({ target: openReq });
  });

  return openReq;
}

vi.stubGlobal("indexedDB", { open: () => makeFakeIDB() });

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal("indexedDB", { open: () => makeFakeIDB() });
});

async function getModule() {
  return import("./offlineQueue.js?v=" + Math.random());
}

// ── enqueueEvents / getPendingEvents ──────────────────────────────────────────

describe("offlineQueue — enqueueEvents / getPendingEvents", () => {
  it("stores an event batch and retrieves it by gameId", async () => {
    const { enqueueEvents, getPendingEvents } = await getModule();
    const entries = [{ id: "e1", type: "goal" }];
    await enqueueEvents("game-1", entries);
    const pending = await getPendingEvents("game-1");
    expect(pending).toHaveLength(1);
    expect(pending[0].entries).toEqual(entries);
    expect(pending[0].gameId).toBe("game-1");
  });

  it("does not return events for a different gameId", async () => {
    const { enqueueEvents, getPendingEvents } = await getModule();
    await enqueueEvents("game-1", [{ id: "e1" }]);
    expect(await getPendingEvents("game-2")).toHaveLength(0);
  });

  it("returns multiple batches sorted by createdAt", async () => {
    const { enqueueEvents, getPendingEvents } = await getModule();
    await enqueueEvents("game-1", [{ id: "e1" }]);
    await enqueueEvents("game-1", [{ id: "e2" }]);
    const pending = await getPendingEvents("game-1");
    expect(pending).toHaveLength(2);
    expect(pending[0].createdAt).toBeLessThanOrEqual(pending[1].createdAt);
  });
});

// ── enqueueDelete / getPendingDeletes ─────────────────────────────────────────

describe("offlineQueue — enqueueDelete / getPendingDeletes", () => {
  it("stores a delete and retrieves it by gameId", async () => {
    const { enqueueDelete, getPendingDeletes } = await getModule();
    await enqueueDelete("game-1", "group-abc");
    const pending = await getPendingDeletes("game-1");
    expect(pending).toHaveLength(1);
    expect(pending[0].groupId).toBe("group-abc");
  });

  it("does not return deletes for a different gameId", async () => {
    const { enqueueDelete, getPendingDeletes } = await getModule();
    await enqueueDelete("game-1", "group-abc");
    expect(await getPendingDeletes("game-2")).toHaveLength(0);
  });
});

// ── enqueueMetaEvent / getPendingMetaEvents ───────────────────────────────────

describe("offlineQueue — enqueueMetaEvent / getPendingMetaEvents", () => {
  it("stores a meta event and retrieves it by gameId", async () => {
    const { enqueueMetaEvent, getPendingMetaEvents } = await getModule();
    const row = { event_type: "quarter_end", from_quarter: 1, to_quarter: 2 };
    await enqueueMetaEvent("game-1", row);
    const pending = await getPendingMetaEvents("game-1");
    expect(pending).toHaveLength(1);
    expect(pending[0].row).toEqual(row);
    expect(pending[0].gameId).toBe("game-1");
  });

  it("does not return meta events for a different gameId", async () => {
    const { enqueueMetaEvent, getPendingMetaEvents } = await getModule();
    await enqueueMetaEvent("game-1", { event_type: "quarter_end" });
    expect(await getPendingMetaEvents("game-2")).toHaveLength(0);
  });

  it("stores multiple meta events and returns them sorted by createdAt", async () => {
    const { enqueueMetaEvent, getPendingMetaEvents } = await getModule();
    await enqueueMetaEvent("game-1", { event_type: "quarter_end", from_quarter: 1, to_quarter: 2 });
    await enqueueMetaEvent("game-1", { event_type: "quarter_end", from_quarter: 2, to_quarter: 3 });
    const pending = await getPendingMetaEvents("game-1");
    expect(pending).toHaveLength(2);
    expect(pending[0].createdAt).toBeLessThanOrEqual(pending[1].createdAt);
  });
});

// ── removeEvent ───────────────────────────────────────────────────────────────

describe("offlineQueue — removeEvent", () => {
  it("removes a single event batch by queueId", async () => {
    const { enqueueEvents, getPendingEvents, removeEvent } = await getModule();
    await enqueueEvents("game-1", [{ id: "e1" }]);
    const [item] = await getPendingEvents("game-1");
    await removeEvent(item.queueId);
    expect(await getPendingEvents("game-1")).toHaveLength(0);
  });

  it("only removes the targeted item, leaving others intact", async () => {
    const { enqueueEvents, getPendingEvents, removeEvent } = await getModule();
    await enqueueEvents("game-1", [{ id: "e1" }]);
    await enqueueEvents("game-1", [{ id: "e2" }]);
    const [first] = await getPendingEvents("game-1");
    await removeEvent(first.queueId);
    expect(await getPendingEvents("game-1")).toHaveLength(1);
  });
});

// ── removeDelete ──────────────────────────────────────────────────────────────

describe("offlineQueue — removeDelete", () => {
  it("removes a pending delete by queueId", async () => {
    const { enqueueDelete, getPendingDeletes, removeDelete } = await getModule();
    await enqueueDelete("game-1", "group-abc");
    const [item] = await getPendingDeletes("game-1");
    await removeDelete(item.queueId);
    expect(await getPendingDeletes("game-1")).toHaveLength(0);
  });
});

// ── removeMetaEvent ───────────────────────────────────────────────────────────

describe("offlineQueue — removeMetaEvent", () => {
  it("removes a pending meta event by queueId", async () => {
    const { enqueueMetaEvent, getPendingMetaEvents, removeMetaEvent } = await getModule();
    await enqueueMetaEvent("game-1", { event_type: "quarter_end" });
    const [item] = await getPendingMetaEvents("game-1");
    await removeMetaEvent(item.queueId);
    expect(await getPendingMetaEvents("game-1")).toHaveLength(0);
  });
});

// ── getPendingCount ───────────────────────────────────────────────────────────

describe("offlineQueue — getPendingCount", () => {
  it("returns 0 when all queues are empty", async () => {
    const { getPendingCount } = await getModule();
    expect(await getPendingCount("game-1")).toBe(0);
  });

  it("counts events, deletes, and meta events together", async () => {
    const { enqueueEvents, enqueueDelete, enqueueMetaEvent, getPendingCount } = await getModule();
    await enqueueEvents("game-1", [{ id: "e1" }]);
    await enqueueEvents("game-1", [{ id: "e2" }]);
    await enqueueDelete("game-1", "group-abc");
    await enqueueMetaEvent("game-1", { event_type: "quarter_end" });
    expect(await getPendingCount("game-1")).toBe(4);
  });

  it("only counts items for the given gameId", async () => {
    const { enqueueEvents, enqueueMetaEvent, getPendingCount } = await getModule();
    await enqueueEvents("game-1", [{ id: "e1" }]);
    await enqueueEvents("game-2", [{ id: "e2" }]);
    await enqueueMetaEvent("game-2", { event_type: "quarter_end" });
    expect(await getPendingCount("game-1")).toBe(1);
  });
});
