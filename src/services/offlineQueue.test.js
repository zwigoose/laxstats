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

  function makeTransaction(storeNames) {
    return { objectStore: (name) => makeObjectStore(name) };
  }

  const db = {
    objectStoreNames: { contains: () => false },
    createObjectStore(name) {
      makeStore(name);
      return { createIndex: vi.fn() };
    },
    transaction: (name) => makeTransaction(name),
  };

  const openReq = { onupgradeneeded: null, onsuccess: null, onerror: null };
  Promise.resolve().then(() => {
    openReq.onupgradeneeded?.({ target: { result: db } });
    openReq.result = db;
    openReq.onsuccess?.({ target: openReq });
  });

  return openReq;
}

// Patch global indexedDB before module loads
vi.stubGlobal("indexedDB", { open: () => makeFakeIDB() });

// Reset the module-level _db cache between tests so each test gets a fresh DB
beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal("indexedDB", { open: () => makeFakeIDB() });
});

async function getModule() {
  return import("./offlineQueue.js?v=" + Math.random());
}

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
    const pending = await getPendingEvents("game-2");
    expect(pending).toHaveLength(0);
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

describe("offlineQueue — removeDelete", () => {
  it("removes a pending delete by queueId", async () => {
    const { enqueueDelete, getPendingDeletes, removeDelete } = await getModule();
    await enqueueDelete("game-1", "group-abc");
    const [item] = await getPendingDeletes("game-1");
    await removeDelete(item.queueId);
    expect(await getPendingDeletes("game-1")).toHaveLength(0);
  });
});

describe("offlineQueue — getPendingCount", () => {
  it("returns 0 when queue is empty", async () => {
    const { getPendingCount } = await getModule();
    expect(await getPendingCount("game-1")).toBe(0);
  });

  it("counts events and deletes together", async () => {
    const { enqueueEvents, enqueueDelete, getPendingCount } = await getModule();
    await enqueueEvents("game-1", [{ id: "e1" }]);
    await enqueueEvents("game-1", [{ id: "e2" }]);
    await enqueueDelete("game-1", "group-abc");
    expect(await getPendingCount("game-1")).toBe(3);
  });

  it("only counts items for the given gameId", async () => {
    const { enqueueEvents, getPendingCount } = await getModule();
    await enqueueEvents("game-1", [{ id: "e1" }]);
    await enqueueEvents("game-2", [{ id: "e2" }]);
    expect(await getPendingCount("game-1")).toBe(1);
  });
});
