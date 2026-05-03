/**
 * IndexedDB-backed queue for events and soft-deletes created while offline.
 *
 * Schema
 * ──────
 * pending_events  { queueId (PK), gameId, entries[], createdAt }
 * pending_deletes { queueId (PK), gameId, groupId,   createdAt }
 *
 * Items in each store are indexed by gameId so we can efficiently query
 * everything belonging to a single game.  createdAt is a Date.now() integer
 * so we can replay operations in the order they were originally performed.
 */

const DB_NAME    = "laxstats-offline";
const DB_VERSION = 1;

let _db = null;

function openDb() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = ({ target: { result: db } }) => {
      if (!db.objectStoreNames.contains("pending_events")) {
        db.createObjectStore("pending_events",  { keyPath: "queueId" })
          .createIndex("gameId", "gameId");
      }
      if (!db.objectStoreNames.contains("pending_deletes")) {
        db.createObjectStore("pending_deletes", { keyPath: "queueId" })
          .createIndex("gameId", "gameId");
      }
    };

    req.onsuccess = ({ target: { result: db } }) => { _db = db; resolve(db); };
    req.onerror   = ({ target: { error }       }) => reject(error);
  });
}

async function idbGet(storeName, gameId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db
      .transaction(storeName, "readonly")
      .objectStore(storeName)
      .index("gameId")
      .getAll(gameId);
    req.onsuccess = ({ target: { result } }) =>
      resolve(result.sort((a, b) => a.createdAt - b.createdAt));
    req.onerror = ({ target: { error } }) => reject(error);
  });
}

async function idbAdd(storeName, item) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db
      .transaction(storeName, "readwrite")
      .objectStore(storeName)
      .add(item);
    req.onsuccess = () => resolve();
    req.onerror   = ({ target: { error } }) => reject(error);
  });
}

async function idbDelete(storeName, key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db
      .transaction(storeName, "readwrite")
      .objectStore(storeName)
      .delete(key);
    req.onsuccess = () => resolve();
    req.onerror   = ({ target: { error } }) => reject(error);
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function enqueueEvents(gameId, entries) {
  const item = { queueId: crypto.randomUUID(), gameId, entries, createdAt: Date.now() };
  await idbAdd("pending_events", item);
}

export async function enqueueDelete(gameId, groupId) {
  const item = { queueId: crypto.randomUUID(), gameId, groupId, createdAt: Date.now() };
  await idbAdd("pending_deletes", item);
}

export const getPendingEvents  = (gameId) => idbGet("pending_events",  gameId);
export const getPendingDeletes = (gameId) => idbGet("pending_deletes", gameId);

export const removeEvent  = (queueId) => idbDelete("pending_events",  queueId);
export const removeDelete = (queueId) => idbDelete("pending_deletes", queueId);

export async function getPendingCount(gameId) {
  const [evs, dels] = await Promise.all([
    getPendingEvents(gameId),
    getPendingDeletes(gameId),
  ]);
  return evs.length + dels.length;
}
