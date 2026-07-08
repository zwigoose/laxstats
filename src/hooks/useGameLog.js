import { useState, useEffect, useRef, useCallback } from "react";
import { supabase as _supabase } from "../lib/supabase";
import {
  fetchGameEvents, appendGameEvents, softDeleteEventGroup, dismissDuplicateFlag,
  insertMetaEvent,
} from "../services/gameEvents";
import { enqueueOp, getPendingOps, removeOp, getPendingCount } from "../services/outbox";
import { isStatEventType, isMetaEventType, mkQuarterEnd, mkGameOver, mkQuarterOverride } from "../domain/eventTypes";
import { deriveQuarterFromStream } from "../domain/reduceGame";
import { useOnlineStatus } from "./useOnlineStatus";

// ── Translation: DB row ↔ LaxStats log entry ─────────────────────────────────

/**
 * Translate a game_events DB row into the LaxStats log entry format.
 * groupId stays as a UUID string (not an int) — both formats coexist
 * peacefully because log filtering uses strict equality.
 */
export function dbRowToEntry(row) {
  return {
    id:            row.seq,
    dbId:          row.id,
    groupId:       row.group_id,
    teamIdx:       row.team_idx,
    event:         row.event_type,
    player:        row.player_num
      ? { num: row.player_num, name: row.player_name ?? `#${row.player_num}` }
      : null,
    quarter:       row.quarter,
    teamStat:      row.is_team_stat ?? false,
    goalTime:      row.goal_time    ?? undefined,
    penaltyTime:   row.penalty_time ?? undefined,
    timeoutTime:   row.timeout_time ?? undefined,
    nonReleasable: row.is_non_releasable ?? false,
    penaltyMin:    row.penalty_minutes  ?? undefined,
    shotOutcome:   row.shot_outcome     ?? undefined,
    zone:          row.shot_zone        ?? undefined,
    foulName:           row.foul_name            ?? undefined,
    createdAt:          row.client_created_at    ?? undefined,
    isPossibleDuplicate: row.is_possible_duplicate ?? false,
    emo:                row.is_emo || undefined,
    payload:            row.payload ?? undefined,
    seq:                row.seq,
  };
}

/**
 * Translate a LaxStats log entry into a game_events insert payload.
 * groupId on the entry must already be a UUID (set by commitEntries), and
 * dbId/clientCreatedAt are stamped once by commitGroup at commit time — the
 * client-generated id is what makes retried flushes idempotent.
 */
export function entryToDbRow(entry, gameId, userId) {
  return {
    id:                 entry.dbId,
    game_id:            gameId,
    group_id:           entry.groupId,
    quarter:            entry.quarter,
    event_type:         entry.event,
    team_idx:           entry.teamIdx,
    is_team_stat:       entry.teamStat       ?? false,
    player_num:         entry.player?.num    ?? null,
    player_name:        entry.player?.name   ?? null,
    goal_time:          entry.goalTime       ?? null,
    penalty_time:       entry.penaltyTime    ?? null,
    timeout_time:       entry.timeoutTime    ?? null,
    is_non_releasable:  entry.nonReleasable  ?? false,
    penalty_minutes:    entry.penaltyMin     ?? null,
    shot_outcome:       entry.shotOutcome    ?? null,
    shot_zone:          entry.zone           ?? null,
    foul_name:          entry.foulName       ?? null,
    is_emo:             entry.emo            ?? false,
    payload:            entry.payload        ?? null,
    created_by:         userId,
    client_created_at:  entry.clientCreatedAt ?? entry.createdAt ?? new Date().toISOString(),
  };
}

// Returns true when an error looks like a transient network failure rather
// than an auth/server error that the caller should surface immediately.
function isNetworkError(err) {
  if (!navigator.onLine) return true;
  const msg = (err?.message ?? "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror")    ||
    msg.includes("load failed")     ||   // Safari
    msg.includes("network request failed")
  );
}

// Marker resolved to waiters when their op stays queued behind a network
// failure — the commit succeeded locally and will sync on reconnect.
const QUEUED = Symbol("queued");

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Manages the game_events event log for a game (event-sourcing Phase 2).
 *
 * All writes are outbox-first: commitGroup / commitMetaEvent /
 * softDeleteGroup enqueue an op in IndexedDB, then flush the outbox if
 * online. There is one code path whether online or offline — the only
 * difference is whether the flush runs now or on reconnect. Appends carry
 * client-generated row ids, so a crashed or retried flush can re-run every
 * op safely (duplicates are ignored server-side).
 *
 * A hard (non-network) flush failure — e.g. the DB rejecting an unknown
 * event type — drops the op and surfaces the error rather than jamming the
 * queue forever.
 *
 * Returns the same contract as the old useGameEvents:
 *   entries, loading, commitGroup, softDeleteGroup, commitMetaEvent,
 *   dismissDuplicate, broadcastMeta, derivedQuarterState, isPrimary,
 *   presenceList, remoteQuarterState, isOnline, pendingCount, syncStatus,
 *   error, channelStatus, reload
 */
export function useGameLog(gameId, userId, db = _supabase) {
  const [entries, setEntries]                       = useState([]);
  const [loading, setLoading]                       = useState(true);
  const [presenceList, setPresenceList]             = useState([]);
  const [remoteQuarterState, setRemoteQuarterState] = useState(null);
  const [derivedQuarterState, setDerivedQuarterState] = useState(null);
  const [error, setError]                           = useState(null);

  const channelRef    = useRef(null);
  const flushingRef   = useRef(false);
  const rerunFlushRef = useRef(false);
  const waitersRef    = useRef(new Map()); // opId → { resolve, reject }
  // Meta rows reach us on several paths (own commit, broadcast, postgres_changes
  // fallback); incremental quarter replay is not idempotent, so track what's
  // already been applied by row id.
  const appliedMetaIdsRef = useRef(new Set());
  const [channelStatus, setChannelStatus] = useState("idle");

  // ── Offline / sync state ──────────────────────────────────────────
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncStatus, setSyncStatus]     = useState("idle");

  const refreshPendingCount = useCallback(() => {
    if (!gameId) return;
    getPendingCount(gameId).then(setPendingCount).catch(() => {});
  }, [gameId]);

  // ── Initial load ─────────────────────────────────────────────────
  useEffect(() => {
    if (!gameId || !userId) { setLoading(false); return; }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, userId]);

  async function load() {
    setLoading(true);
    setError(null);
    const evRes = await fetchGameEvents(gameId, db);
    if (evRes.error) { setError(evRes.error.message); setLoading(false); return; }
    // The unified stream carries stat, state, and meta events. Only stat
    // events feed the LaxStats log; meta events replay into quarter state.
    const rows = evRes.data || [];
    setEntries(rows.filter(r => isStatEventType(r.event_type)).map(dbRowToEntry));
    appliedMetaIdsRef.current = new Set(
      rows.filter(r => isMetaEventType(r.event_type)).map(r => r.id)
    );
    const derived = deriveQuarterFromStream(rows);
    if (derived) setDerivedQuarterState(derived);
    setLoading(false);
  }

  // Apply one meta-kind stream row to derived quarter state, exactly once.
  const applyMetaRow = useCallback((row) => {
    if (appliedMetaIdsRef.current.has(row.id)) return;
    appliedMetaIdsRef.current.add(row.id);
    setDerivedQuarterState(prev =>
      prev ? _applyStreamMetaRow(prev, row) : deriveQuarterFromStream([row])
    );
  }, []);

  // ── Pending-count bootstrap ──────────────────────────────────────
  useEffect(() => { refreshPendingCount(); }, [refreshPendingCount]);

  // ── Realtime + Presence ──────────────────────────────────────────
  useEffect(() => {
    if (!gameId || !userId) return;

    const channel = db.channel(`game-events-${gameId}`, {
      config: { presence: { key: userId } },
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const list = Object.entries(state).map(([uid, presences]) => ({
        userId: uid,
        joinedAt: presences.reduce((earliest, p) => {
          const t = p.online_at ?? p.joined_at ?? "";
          return !earliest || t < earliest ? t : earliest;
        }, ""),
      }));
      list.sort((a, b) => (a.joinedAt < b.joinedAt ? -1 : 1));
      setPresenceList(list);
    });

    // Route one incoming stream row to the right slice of local state.
    const applyRemoteRow = (row) => {
      if (row.deleted_at) return;
      if (isMetaEventType(row.event_type)) {
        applyMetaRow(row);
        return;
      }
      if (!isStatEventType(row.event_type)) return; // state registers: read paths use summary
      const entry = dbRowToEntry(row);
      setEntries(prev => {
        if (prev.some(e => e.dbId === entry.dbId)) return prev;
        return [...prev, entry].sort((a, b) => a.seq - b.seq);
      });
    };

    // New rows broadcast by another scorer — primary sync path (instant WebSocket delivery)
    channel.on("broadcast", { event: "new_events" }, ({ payload }) => {
      if (payload?.scorerId === userId) return;
      for (const row of payload?.entries ?? []) applyRemoteRow(row);
    });

    // postgres_changes INSERT kept as fallback (covers brief disconnects, and
    // meta rows forwarded from pre-Phase-3 clients' game_meta_events writes)
    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "game_events", filter: `game_id=eq.${gameId}` },
      (payload) => {
        const row = payload.new;
        if (row.created_by === userId && !isMetaEventType(row.event_type)) return;
        applyRemoteRow(row);
      }
    );

    // Quarter/game-over state broadcast by the primary scorer (fast hint)
    channel.on("broadcast", { event: "meta_update" }, ({ payload }) => {
      if (payload?.scorerId === userId) return;
      setRemoteQuarterState({
        currentQuarter:    payload?.currentQuarter    ?? 1,
        completedQuarters: payload?.completedQuarters ?? [],
        gameOver:          payload?.gameOver          ?? false,
      });
    });

    // Deletion broadcast by another scorer
    channel.on("broadcast", { event: "delete_group" }, ({ payload }) => {
      if (payload?.scorerId === userId) return;
      setEntries(prev => prev.filter(e => e.groupId !== payload?.groupId));
    });

    // Duplicate dismissal broadcast by another scorer
    channel.on("broadcast", { event: "dismiss_duplicate" }, ({ payload }) => {
      if (payload?.scorerId === userId) return;
      setEntries(prev => prev.map(e =>
        e.groupId === payload?.groupId ? { ...e, isPossibleDuplicate: false } : e
      ));
    });

    // postgres_changes UPDATE — handles soft-deletes and flag changes (e.g. is_possible_duplicate)
    channel.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "game_events", filter: `game_id=eq.${gameId}` },
      (payload) => {
        const row = payload.new;
        if (row.deleted_at) {
          if (row.deleted_by !== userId) {
            setEntries(prev => prev.filter(e => e.dbId !== row.id));
          }
        } else {
          setEntries(prev => prev.map(e =>
            e.dbId === row.id
              ? { ...e, isPossibleDuplicate: row.is_possible_duplicate ?? false }
              : e
          ));
        }
      }
    );

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        const wasConnected = channelStatus !== "idle";
        setChannelStatus("subscribed");
        setError(prev => (prev?.startsWith("Realtime") ? null : prev));
        await channel.track({ online_at: new Date().toISOString() });
        // Reconnect: reload to close any gap from the disconnected window.
        if (wasConnected) load();
      } else if (status === "CHANNEL_ERROR") {
        setChannelStatus("error");
        setError("Realtime channel error — live sync unavailable");
      } else if (status === "TIMED_OUT") {
        setChannelStatus("timed_out");
        setError("Realtime channel timed out — live sync unavailable");
      } else if (status === "CLOSED") {
        setChannelStatus("idle");
      }
    });

    channelRef.current = channel;

    return () => {
      db.removeChannel(channel);
      channelRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, userId]);

  // ── Op execution ──────────────────────────────────────────────────
  // Performs one outbox op against the server and emits its broadcast.
  // Throws on failure; the flush loop decides queue-vs-drop.
  async function performOp(op) {
    if (op.kind === "append") {
      const rows = op.entries.map(e => entryToDbRow(e, gameId, userId));
      const { data: inserted, error: err } = await appendGameEvents(rows, db);
      if (err) throw err;
      // Empty result = every row already existed (an earlier attempt landed
      // before we crashed/retried) — the broadcast went out then, or the
      // co-scorers' postgres_changes fallback covered it.
      if (inserted?.length) {
        const statRows = inserted.filter(r => isStatEventType(r.event_type));
        const metaRows = inserted.filter(r => isMetaEventType(r.event_type));

        if (statRows.length) {
          // Merge our own rows (now carrying server seq) into entries — the
          // realtime handlers skip own events, so this is their only way in
          // short of a full reload.
          const incoming = statRows.map(dbRowToEntry);
          setEntries(prev => {
            const existingIds = new Set(prev.map(e => e.dbId));
            const toAdd = incoming.filter(e => !existingIds.has(e.dbId));
            if (!toAdd.length) return prev;
            return [...prev, ...toAdd].sort((a, b) => a.seq - b.seq);
          });
        }
        for (const row of metaRows) {
          applyMetaRow(row);
          // Legacy hint for pre-Phase-3 co-scorer clients that still listen
          // for meta_update instead of stream meta rows.
          channelRef.current?.send({
            type:    "broadcast",
            event:   "meta_update",
            payload: { scorerId: userId, ..._streamMetaToBroadcastPayload(row) },
          });
        }
        channelRef.current?.send({
          type:    "broadcast",
          event:   "new_events",
          payload: { scorerId: userId, entries: inserted },
        });
      }
      return inserted;
    }

    if (op.kind === "meta") {
      // Legacy op shape drained from the pre-Phase-3 offline queue: still
      // targets game_meta_events; the DB forwards it into the stream.
      const { data, error: err } = await insertMetaEvent(op.row, db);
      if (err) throw err;
      return data;
    }

    if (op.kind === "soft_delete") {
      const { error: err } = await softDeleteEventGroup(gameId, op.groupId, db);
      if (err) throw err;
      channelRef.current?.send({
        type:    "broadcast",
        event:   "delete_group",
        payload: { scorerId: userId, groupId: op.groupId },
      });
      return undefined;
    }

    throw new Error(`unknown outbox op kind: ${op.kind}`);
  }

  function settleWaiter(opId, outcome) {
    const w = waitersRef.current.get(opId);
    if (!w) return;
    waitersRef.current.delete(opId);
    if (outcome.error) w.reject(outcome.error);
    else w.resolve(outcome.value);
  }

  // ── Flush the outbox in strict FIFO order ─────────────────────────
  const flushOutbox = useCallback(async () => {
    if (!gameId || !userId) return;
    if (flushingRef.current) { rerunFlushRef.current = true; return; }
    flushingRef.current = true;

    let flushedAny = false;
    try {
      // Re-read after each batch: ops enqueued mid-flush get picked up here
      // instead of waiting for the next reconnect.
      for (;;) {
        rerunFlushRef.current = false;
        const ops = await getPendingOps(gameId);
        if (!ops.length) break;
        setSyncStatus("syncing");

        for (const op of ops) {
          try {
            const value = await performOp(op);
            await removeOp(op.opId);
            settleWaiter(op.opId, { value });
            flushedAny = true;
          } catch (err) {
            if (isNetworkError(err)) {
              // Leave this op (and everything after it) queued for reconnect.
              // The local commit already succeeded — resolve its waiter.
              settleWaiter(op.opId, { value: QUEUED });
              setSyncStatus("idle");
              refreshPendingCount();
              return;
            }
            // Hard failure (e.g. DB validation): drop the op so it can't jam
            // the queue, surface the error, and keep flushing the rest.
            await removeOp(op.opId);
            settleWaiter(op.opId, { error: err });
            setError(err.message);
            setSyncStatus("error");
          }
        }

        if (!rerunFlushRef.current) break;
      }

      if (flushedAny) {
        setSyncStatus(s => (s === "error" ? s : "synced"));
        setTimeout(() => setSyncStatus(s => (s === "synced" ? "idle" : s)), 3000);
      }
    } finally {
      flushingRef.current = false;
      refreshPendingCount();
    }
  // load is a stable closure over gameId/db; intentionally excluded from deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, userId, refreshPendingCount]);

  // Flush whenever we (re)connect. Also runs once on mount so ops queued
  // during a previous session are flushed immediately.
  useEffect(() => {
    if (isOnline) flushOutbox();
  }, [isOnline, flushOutbox]);

  // Enqueue an op and, when online, wait for its flush attempt. Resolves with
  // the op's server result, QUEUED if a network failure left it queued, or
  // rejects on a hard failure.
  const commitOp = useCallback(async (op) => {
    const opId = await enqueueOp({ gameId, ...op });
    refreshPendingCount();
    if (!isOnline) return QUEUED;
    const settled = new Promise((resolve, reject) => {
      waitersRef.current.set(opId, { resolve, reject });
    });
    flushOutbox();
    return settled;
  }, [gameId, isOnline, flushOutbox, refreshPendingCount]);

  // ── Commit a group of entries ────────────────────────────────────
  const commitGroup = useCallback(async (stampedEntries) => {
    if (!gameId || !userId || !stampedEntries?.length) return;
    // Stamp identity + client wall clock ONCE, so every retry of this op
    // writes the same rows (and the server ignores the duplicates).
    const now = new Date().toISOString();
    const entriesWithIds = stampedEntries.map(e => ({
      ...e,
      dbId:            e.dbId            ?? crypto.randomUUID(),
      clientCreatedAt: e.clientCreatedAt ?? now,
    }));
    try {
      await commitOp({ kind: "append", entries: entriesWithIds });
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [gameId, userId, commitOp]);

  // ── Commit a quarter-transition or game-over meta event ──────────
  // Meta events are ordinary stream appends (event-sourcing Phase 3).
  // Resolves with the inserted row after DB confirmation (callers gate local
  // quarter mutation on this), or with a synthetic stub when the op is queued
  // offline so callers can proceed optimistically.
  const commitMetaEvent = useCallback(async (type, fromQuarter, toQuarter) => {
    if (!gameId || !userId) return null;
    const builder = { quarter_end: mkQuarterEnd, game_over: mkGameOver, quarter_override: mkQuarterOverride }[type];
    if (!builder) throw new Error(`unknown meta event type: ${type}`);
    const entry = {
      ...(type === "game_over" ? builder(fromQuarter) : builder(fromQuarter, toQuarter)),
      dbId:            crypto.randomUUID(),
      clientCreatedAt: new Date().toISOString(),
    };
    const result = await commitOp({ kind: "append", entries: [entry] });
    if (result === QUEUED) {
      return { id: entry.dbId, event_type: type, from_quarter: fromQuarter, to_quarter: toQuarter, seq: null };
    }
    return result?.[0] ?? null;
  }, [gameId, userId, commitOp]);

  // ── Soft-delete all rows in a group ─────────────────────────────
  const softDeleteGroup = useCallback(async (groupIdUuid) => {
    if (!gameId || !userId) return;
    setEntries(prev => prev.filter(e => e.groupId !== groupIdUuid));
    try {
      await commitOp({ kind: "soft_delete", groupId: groupIdUuid });
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [gameId, userId, commitOp]);

  // ── Dismiss duplicate flag on a group ───────────────────────────
  const dismissDuplicate = useCallback(async (groupIdUuid) => {
    if (!gameId || !userId) return;
    setEntries(prev => prev.map(e =>
      e.groupId === groupIdUuid ? { ...e, isPossibleDuplicate: false } : e
    ));
    const { error: err } = await dismissDuplicateFlag(gameId, groupIdUuid, db);
    if (err) { setError(err.message); return; }
    channelRef.current?.send({
      type:    "broadcast",
      event:   "dismiss_duplicate",
      payload: { scorerId: userId, groupId: groupIdUuid },
    });
  }, [gameId, userId]);

  // Broadcast quarter/game-over state to other scorers (legacy fast path —
  // demoted to hint only; commitMetaEvent is the source of truth)
  const broadcastMeta = useCallback((meta) => {
    channelRef.current?.send({
      type:    "broadcast",
      event:   "meta_update",
      payload: { scorerId: userId, ...meta },
    });
  }, [userId]);

  // Primary scorer = first presence entry (by join order)
  const isPrimary = presenceList.length === 0 || presenceList[0]?.userId === userId;

  return {
    entries,
    loading,
    commitGroup,
    softDeleteGroup,
    dismissDuplicate,
    broadcastMeta,
    commitMetaEvent,
    derivedQuarterState,
    isPrimary,
    presenceList,
    remoteQuarterState,
    isOnline,
    pendingCount,
    syncStatus,
    error,
    channelStatus,
    reload: load,
  };
}

// ── Private helpers ───────────────────────────────────────────────────────────

// Incrementally apply a single new meta-kind stream row (payload-shaped) to an
// existing derived state object. Avoids replaying the full history on every
// realtime INSERT. Callers guarantee exactly-once via applyMetaRow.
function _applyStreamMetaRow(prev, row) {
  let { currentQuarter, completedQuarters, gameOver } = prev;
  const p = row.payload ?? {};
  if (row.event_type === "quarter_end") {
    completedQuarters = [...completedQuarters, p.fromQuarter];
    currentQuarter    = p.toQuarter;
  } else if (row.event_type === "game_over") {
    completedQuarters = [...completedQuarters, p.fromQuarter];
    gameOver          = true;
    currentQuarter    = p.fromQuarter;
  } else if (row.event_type === "quarter_override") {
    currentQuarter = p.toQuarter;
  }
  return { currentQuarter, completedQuarters, gameOver };
}

// Build the broadcast payload matching the remoteQuarterState shape expected
// by pre-Phase-3 clients.
function _streamMetaToBroadcastPayload(row) {
  const p = row.payload ?? {};
  if (row.event_type === "game_over") {
    return { currentQuarter: p.fromQuarter, gameOver: true };
  }
  // quarter_end / quarter_override
  return { currentQuarter: p.toQuarter, gameOver: false };
}
