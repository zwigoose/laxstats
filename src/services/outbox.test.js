import { describe, it, expect, beforeEach, vi } from "vitest";

// ── IndexedDB fake ─────────────────────────────────────────────────────────────
// jsdom's IDB stub doesn't implement indexes or upgrades; this in-memory fake
// covers the API surface outbox.js uses, including onupgradeneeded with an
// oldVersion so the legacy-store drain can be exercised.

function makeFakeIDB({ oldVersion = 0, legacy = {} } = {}) {
  const stores = {}; // name → array of records

  if (legacy.pending_events)      stores.pending_events      = [...legacy.pending_events];
  if (legacy.pending_deletes)     stores.pending_deletes     = [...legacy.pending_deletes];
  if (legacy.pending_meta_events) stores.pending_meta_events = [...legacy.pending_meta_events];

  function fakeRequest(fn) {
    const req = { onsuccess: null, onerror: null };
    Promise.resolve().then(() => {
      try {
        req.result = fn();
        req.onsuccess?.({ target: req });
      } catch (err) {
        req.error = err;
        req.onerror?.({ target: req });
      }
    });
    return req;
  }

  function storeHandle(name) {
    return {
      add(item)  { return fakeRequest(() => { stores[name].push(item); return item.opId; }); },
      put(item)  { return fakeRequest(() => { stores[name].push(item); }); },
      getAll()   { return fakeRequest(() => [...stores[name]]); },
      delete(key) {
        return fakeRequest(() => {
          const i = stores[name].findIndex(r => r.opId === key);
          if (i !== -1) stores[name].splice(i, 1);
        });
      },
      index() {
        return {
          getAll(gameId) {
            return fakeRequest(() => stores[name].filter(r => r.gameId === gameId));
          },
        };
      },
    };
  }

  const db = {
    _stores: stores,
    objectStoreNames: { contains: (n) => Object.prototype.hasOwnProperty.call(stores, n) },
    createObjectStore(name) {
      stores[name] = stores[name] ?? [];
      return { createIndex: () => {} };
    },
    deleteObjectStore(name) { delete stores[name]; },
    transaction() { return { objectStore: storeHandle }; },
  };

  const tx = { objectStore: storeHandle };

  return {
    _db: db,
    open() {
      const req = { onupgradeneeded: null, onsuccess: null, onerror: null };
      Promise.resolve().then(async () => {
        req.onupgradeneeded?.({ target: { result: db, transaction: tx }, oldVersion });
        // Legacy drains issue async getAll requests on the upgrade tx; let
        // their microtasks run before signalling success (mirrors IDB, where
        // onsuccess fires only after the versionchange tx completes).
        await new Promise(r => setTimeout(r, 0));
        req.onsuccess?.({ target: { result: db } });
      });
      return req;
    },
  };
}

let fake;

async function loadOutbox(fakeOpts) {
  // Fresh module per test: outbox.js caches the opened DB in module scope.
  vi.resetModules();
  fake = makeFakeIDB(fakeOpts);
  globalThis.indexedDB = { open: () => fake.open() };
  return import("./outbox");
}

const GAME = "game-1";

describe("outbox — enqueue / flush primitives", () => {
  let outbox;
  beforeEach(async () => { outbox = await loadOutbox(); });

  it("enqueueOp returns an opId and the op becomes pending", async () => {
    const opId = await outbox.enqueueOp({ gameId: GAME, kind: "append", entries: [] });
    expect(opId).toEqual(expect.any(String));
    const ops = await outbox.getPendingOps(GAME);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toEqual(expect.objectContaining({ opId, kind: "append", gameId: GAME }));
  });

  it("getPendingOps returns ops sorted by createdAt (global FIFO)", async () => {
    // Force distinct createdAt values regardless of timer resolution.
    const a = await outbox.enqueueOp({ gameId: GAME, kind: "append", entries: [], createdAt: 3 });
    const b = await outbox.enqueueOp({ gameId: GAME, kind: "soft_delete", groupId: "g", createdAt: 1 });
    const c = await outbox.enqueueOp({ gameId: GAME, kind: "meta", row: {}, createdAt: 2 });
    const ops = await outbox.getPendingOps(GAME);
    expect(ops.map(o => o.opId)).toEqual([b, c, a]);
  });

  it("getPendingOps filters by gameId", async () => {
    await outbox.enqueueOp({ gameId: GAME, kind: "append", entries: [] });
    await outbox.enqueueOp({ gameId: "other-game", kind: "append", entries: [] });
    expect(await outbox.getPendingOps(GAME)).toHaveLength(1);
    expect(await outbox.getPendingCount("other-game")).toBe(1);
  });

  it("removeOp deletes exactly one op", async () => {
    const a = await outbox.enqueueOp({ gameId: GAME, kind: "append", entries: [] });
    await outbox.enqueueOp({ gameId: GAME, kind: "soft_delete", groupId: "g" });
    await outbox.removeOp(a);
    const ops = await outbox.getPendingOps(GAME);
    expect(ops).toHaveLength(1);
    expect(ops[0].kind).toBe("soft_delete");
  });

  it("removeOp is idempotent (re-removing is a no-op)", async () => {
    const a = await outbox.enqueueOp({ gameId: GAME, kind: "append", entries: [] });
    await outbox.removeOp(a);
    await outbox.removeOp(a);
    expect(await outbox.getPendingCount(GAME)).toBe(0);
  });
});

describe("outbox — v3 upgrade drains the legacy three-store queue", () => {
  it("converts pending_events / pending_deletes / pending_meta_events into ops", async () => {
    const outbox = await loadOutbox({
      oldVersion: 2,
      legacy: {
        pending_events: [
          { queueId: "q-1", gameId: GAME, entries: [{ event: "goal", teamIdx: 0 }], createdAt: 10 },
        ],
        pending_deletes: [
          { queueId: "q-2", gameId: GAME, groupId: "grp-1", createdAt: 20 },
        ],
        pending_meta_events: [
          { queueId: "q-3", gameId: GAME, row: { event_type: "quarter_end" }, createdAt: 15 },
        ],
      },
    });

    const ops = await outbox.getPendingOps(GAME);
    expect(ops.map(o => [o.opId, o.kind])).toEqual([
      ["q-1", "append"],       // createdAt 10
      ["q-3", "meta"],         // createdAt 15
      ["q-2", "soft_delete"],  // createdAt 20
    ]);
    expect(ops[0].entries[0].event).toBe("goal");
    expect(ops[1].row.event_type).toBe("quarter_end");
    expect(ops[2].groupId).toBe("grp-1");
  });

  it("stamps dbId on drained legacy entries so their replay is idempotent", async () => {
    const outbox = await loadOutbox({
      oldVersion: 2,
      legacy: {
        pending_events: [
          { queueId: "q-1", gameId: GAME, entries: [{ event: "goal" }, { event: "assist", dbId: "keep-me" }], createdAt: 1 },
        ],
      },
    });
    const [op] = await outbox.getPendingOps(GAME);
    expect(op.entries[0].dbId).toEqual(expect.any(String));
    expect(op.entries[1].dbId).toBe("keep-me");  // existing ids preserved
  });

  it("deletes the legacy stores after draining", async () => {
    const outbox = await loadOutbox({
      oldVersion: 2,
      legacy: {
        pending_events:      [{ queueId: "q-1", gameId: GAME, entries: [], createdAt: 1 }],
        pending_deletes:     [],
        pending_meta_events: [],
      },
    });
    await outbox.getPendingCount(GAME);  // openDb is lazy — force the upgrade
    expect(fake._db.objectStoreNames.contains("pending_events")).toBe(false);
    expect(fake._db.objectStoreNames.contains("pending_deletes")).toBe(false);
    expect(fake._db.objectStoreNames.contains("pending_meta_events")).toBe(false);
    expect(fake._db.objectStoreNames.contains("outbox")).toBe(true);
  });

  it("fresh install (oldVersion 0) just creates the outbox store", async () => {
    const outbox = await loadOutbox({ oldVersion: 0 });
    expect(await outbox.getPendingCount(GAME)).toBe(0);
    expect(fake._db.objectStoreNames.contains("outbox")).toBe(true);
  });
});
