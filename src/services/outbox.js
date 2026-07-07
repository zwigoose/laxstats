/**
 * IndexedDB-backed outbox: the single queue for every write that must survive
 * being offline. Replaces the three-store offlineQueue (event-sourcing
 * Phase 2) — the v3 upgrade drains pending_events / pending_deletes /
 * pending_meta_events into the unified store, preserving each item's original
 * createdAt so replay order is unchanged.
 *
 * Op shapes (one store, discriminated by `kind`)
 * ──────────────────────────────────────────────
 *   { opId, gameId, kind: "append",      entries: [entry], createdAt }
 *   { opId, gameId, kind: "meta",        row: {…},         createdAt }
 *   { opId, gameId, kind: "soft_delete", groupId,          createdAt }
 *
 * Ops flush in strict createdAt order (global FIFO, not per-kind), so a
 * "create group offline, then delete it offline" pair replays correctly.
 * Every op must be idempotent to re-run: appends carry client-generated row
 * ids (upsert-ignore), soft-deletes are naturally repeatable. Entries drained
 * from the legacy queue are stamped with dbId here so their replay is
 * idempotent from now on too.
 */

const DB_NAME    = "laxstats-offline";
const DB_VERSION = 3;

let _db = null;

function drainLegacyStore(db, tx, storeName, toOp) {
  if (!db.objectStoreNames.contains(storeName)) return;
  const req = tx.objectStore(storeName).getAll();
  req.onsuccess = ({ target: { result: items } }) => {
    const outbox = tx.objectStore("outbox");
    for (const item of items ?? []) outbox.put(toOp(item));
    db.deleteObjectStore(storeName);
  };
}

function openDb() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = ({ target: { result: db, transaction: tx }, oldVersion }) => {
      db.createObjectStore("outbox", { keyPath: "opId" })
        .createIndex("gameId", "gameId");
      if (oldVersion >= 1) {
        drainLegacyStore(db, tx, "pending_events", (item) => ({
          opId:      item.queueId,
          gameId:    item.gameId,
          kind:      "append",
          entries:   (item.entries ?? []).map(e => ({ ...e, dbId: e.dbId ?? crypto.randomUUID() })),
          createdAt: item.createdAt,
        }));
        drainLegacyStore(db, tx, "pending_deletes", (item) => ({
          opId:      item.queueId,
          gameId:    item.gameId,
          kind:      "soft_delete",
          groupId:   item.groupId,
          createdAt: item.createdAt,
        }));
        drainLegacyStore(db, tx, "pending_meta_events", (item) => ({
          opId:      item.queueId,
          gameId:    item.gameId,
          kind:      "meta",
          row:       item.row,
          createdAt: item.createdAt,
        }));
      }
    };

    req.onsuccess = ({ target: { result: db } }) => { _db = db; resolve(db); };
    req.onerror   = ({ target: { error }       }) => reject(error);
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function enqueueOp(op) {
  const db = await openDb();
  const record = { opId: crypto.randomUUID(), createdAt: Date.now(), ...op };
  return new Promise((resolve, reject) => {
    const req = db
      .transaction("outbox", "readwrite")
      .objectStore("outbox")
      .add(record);
    req.onsuccess = () => resolve(record.opId);
    req.onerror   = ({ target: { error } }) => reject(error);
  });
}

export async function getPendingOps(gameId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db
      .transaction("outbox", "readonly")
      .objectStore("outbox")
      .index("gameId")
      .getAll(gameId);
    req.onsuccess = ({ target: { result } }) =>
      resolve(result.sort((a, b) => a.createdAt - b.createdAt));
    req.onerror = ({ target: { error } }) => reject(error);
  });
}

export async function removeOp(opId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db
      .transaction("outbox", "readwrite")
      .objectStore("outbox")
      .delete(opId);
    req.onsuccess = () => resolve();
    req.onerror   = ({ target: { error } }) => reject(error);
  });
}

export async function getPendingCount(gameId) {
  return (await getPendingOps(gameId)).length;
}
