import { useState, useEffect, useRef, useCallback } from "react";
import { supabase as _supabase } from "../lib/supabase";
import { fetchGameEvents, insertGameEvents, softDeleteGameEvents } from "../services/gameEvents";
import {
  enqueueEvents, enqueueDelete,
  getPendingEvents, getPendingDeletes,
  removeEvent, removeDelete,
  getPendingCount,
} from "../services/offlineQueue";
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
    foulName:      row.foul_name        ?? undefined,
    seq:           row.seq,
  };
}

/**
 * Translate a LaxStats log entry into a game_events insert payload.
 * groupId on the entry must already be a UUID (set by commitEntries in v2 mode).
 */
export function entryToDbRow(entry, gameId, userId) {
  return {
    game_id:           gameId,
    group_id:          entry.groupId,
    quarter:           entry.quarter,
    event_type:        entry.event,
    team_idx:          entry.teamIdx,
    is_team_stat:      entry.teamStat       ?? false,
    player_num:        entry.player?.num    ?? null,
    player_name:       entry.player?.name   ?? null,
    goal_time:         entry.goalTime       ?? null,
    penalty_time:      entry.penaltyTime    ?? null,
    timeout_time:      entry.timeoutTime    ?? null,
    is_non_releasable: entry.nonReleasable  ?? false,
    penalty_minutes:   entry.penaltyMin     ?? null,
    shot_outcome:      entry.shotOutcome    ?? null,
    foul_name:         entry.foulName       ?? null,
    created_by:        userId,
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

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Manages the v2 (game_events) event log for a game.
 *
 * Returns:
 *   entries          — log entries in LaxStats format, sorted by seq
 *   loading          — initial load state
 *   commitGroup      — async (stampedEntries) → writes to game_events; queues locally
 *                      when offline so no events are lost
 *   softDeleteGroup  — async (groupIdUuid) → soft-deletes group; queues when offline
 *   isPrimary        — true if this session is the designated primary scorer
 *   presenceList     — [{userId, joinedAt}, ...] sorted by join order
 *   isOnline         — current network status
 *   pendingCount     — number of operations waiting to sync
 *   syncStatus       — "idle" | "syncing" | "synced" | "error"
 *   error            — last error string or null
 *
 * Pass gameId=null to disable (v1 games).
 */
export function useGameEvents(gameId, userId, db = _supabase) {
  const [entries, setEntries]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [presenceList, setPresenceList] = useState([]);
  const [remoteQuarterState, setRemoteQuarterState] = useState(null);
  const [error, setError]               = useState(null);

  const channelRef   = useRef(null);
  const isSyncingRef = useRef(false);
  const [channelStatus, setChannelStatus] = useState("idle");

  // ── Offline / sync state ──────────────────────────────────────────
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncStatus, setSyncStatus]     = useState("idle");

  // ── Initial load ─────────────────────────────────────────────────
  useEffect(() => {
    if (!gameId || !userId) { setLoading(false); return; }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, userId]);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await fetchGameEvents(gameId, db);
    if (err) { setError(err.message); setLoading(false); return; }
    setEntries((data || []).map(dbRowToEntry));
    setLoading(false);
  }

  // ── Pending-count bootstrap ──────────────────────────────────────
  // On mount, read the IDB queue so we can show the right badge even
  // before any new offline activity happens.
  useEffect(() => {
    if (!gameId) return;
    getPendingCount(gameId).then(setPendingCount).catch(() => {});
  }, [gameId]);

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

    // New entries broadcast by another scorer — primary sync path (instant WebSocket delivery)
    channel.on("broadcast", { event: "new_events" }, ({ payload }) => {
      if (payload?.scorerId === userId) return;
      const incoming = (payload?.entries ?? []).map(dbRowToEntry);
      if (!incoming.length) return;
      setEntries(prev => {
        const existingIds = new Set(prev.map(e => e.dbId));
        const toAdd = incoming.filter(e => !existingIds.has(e.dbId));
        if (!toAdd.length) return prev;
        return [...prev, ...toAdd].sort((a, b) => a.seq - b.seq);
      });
    });

    // postgres_changes INSERT kept as fallback (covers brief disconnects)
    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "game_events", filter: `game_id=eq.${gameId}` },
      (payload) => {
        const row = payload.new;
        if (row.created_by === userId) return;
        if (row.deleted_at) return;
        const entry = dbRowToEntry(row);
        setEntries(prev => {
          if (prev.some(e => e.dbId === entry.dbId)) return prev;
          return [...prev, entry].sort((a, b) => a.seq - b.seq);
        });
      }
    );

    // Quarter/game-over state broadcast by the primary scorer
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

    // postgres_changes UPDATE fallback for soft-deletes
    channel.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "game_events", filter: `game_id=eq.${gameId}` },
      (payload) => {
        const row = payload.new;
        if (row.deleted_at && row.deleted_by !== userId) {
          setEntries(prev => prev.filter(e => e.dbId !== row.id));
        }
      }
    );

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        setChannelStatus("subscribed");
        setError(prev => (prev?.startsWith("Realtime") ? null : prev));
        await channel.track({ online_at: new Date().toISOString() });
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
  }, [gameId, userId]);

  // ── Sync pending queue → server ──────────────────────────────────
  const syncPending = useCallback(async () => {
    if (!gameId || !userId) return;
    if (isSyncingRef.current) return;

    const [pendingEvs, pendingDels] = await Promise.all([
      getPendingEvents(gameId),
      getPendingDeletes(gameId),
    ]);

    if (!pendingEvs.length && !pendingDels.length) return;

    isSyncingRef.current = true;
    setSyncStatus("syncing");

    try {
      // Flush event inserts in creation order so the DB sequence reflects
      // the real-time order in which the scorer logged them.
      for (const item of pendingEvs) {
        const rows = item.entries.map(e => entryToDbRow(e, gameId, userId));
        const { data: inserted, error: err } = await insertGameEvents(rows, db);
        if (err) throw err;
        // Broadcast so online co-scorers see the newly-synced events immediately.
        channelRef.current?.send({
          type:    "broadcast",
          event:   "new_events",
          payload: { scorerId: userId, entries: inserted ?? rows },
        });
        await removeEvent(item.queueId);
        setPendingCount(prev => Math.max(0, prev - 1));
      }

      // Flush soft-deletes after inserts so any "delete an offline-created
      // event" pair is applied in the correct order: create then delete.
      for (const item of pendingDels) {
        // Soft-delete is idempotent — safe to retry even if another scorer
        // already deleted the same group while we were offline.
        await softDeleteGameEvents(gameId, item.groupId, userId, db);
        channelRef.current?.send({
          type:    "broadcast",
          event:   "delete_group",
          payload: { scorerId: userId, groupId: item.groupId },
        });
        await removeDelete(item.queueId);
        setPendingCount(prev => Math.max(0, prev - 1));
      }

      setSyncStatus("synced");
      setTimeout(() => setSyncStatus(s => (s === "synced" ? "idle" : s)), 3000);
      // Reload from DB so entries get correct seq/dbId values from the server.
      load();
    } catch (err) {
      setSyncStatus("error");
      setError(err.message);
    } finally {
      isSyncingRef.current = false;
    }
  // load is a stable closure over gameId/db; it's intentionally excluded from
  // the deps array to avoid a dependency cycle.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, userId]);

  // Trigger sync whenever we (re)connect.  Also runs once on mount so events
  // queued during a previous offline session are flushed immediately.
  useEffect(() => {
    if (isOnline) syncPending();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, syncPending]);

  // ── Commit a group of entries ────────────────────────────────────
  const commitGroup = useCallback(async (stampedEntries) => {
    if (!gameId || !userId || !stampedEntries?.length) return;

    // Offline path — queue locally; the optimistic update in LaxStats already
    // updated the local log so the scorer can keep working seamlessly.
    if (!isOnline) {
      await enqueueEvents(gameId, stampedEntries);
      setPendingCount(prev => prev + 1);
      return;
    }

    const rows = stampedEntries.map(e => entryToDbRow(e, gameId, userId));
    const { data: inserted, error: err } = await insertGameEvents(rows, db);

    if (err) {
      // Network failure while nominally online → fall back to the local queue
      // so the event is not lost.
      if (isNetworkError(err)) {
        await enqueueEvents(gameId, stampedEntries);
        setPendingCount(prev => prev + 1);
        return;
      }
      setError(err.message);
      throw err;
    }

    channelRef.current?.send({
      type:    "broadcast",
      event:   "new_events",
      payload: { scorerId: userId, entries: inserted ?? rows },
    });
  }, [gameId, userId, isOnline]);

  // ── Soft-delete all rows in a group ─────────────────────────────
  const softDeleteGroup = useCallback(async (groupIdUuid) => {
    if (!gameId || !userId) return;

    // Always remove from local state immediately (optimistic).
    setEntries(prev => prev.filter(e => e.groupId !== groupIdUuid));

    if (!isOnline) {
      await enqueueDelete(gameId, groupIdUuid);
      setPendingCount(prev => prev + 1);
      return;
    }

    const { error: err } = await softDeleteGameEvents(gameId, groupIdUuid, userId, db);

    if (err) {
      if (isNetworkError(err)) {
        await enqueueDelete(gameId, groupIdUuid);
        setPendingCount(prev => prev + 1);
        return;
      }
      setError(err.message);
      throw err;
    }

    channelRef.current?.send({
      type:    "broadcast",
      event:   "delete_group",
      payload: { scorerId: userId, groupId: groupIdUuid },
    });
  }, [gameId, userId, isOnline]);

  // Broadcast quarter/game-over state to other scorers (called by primary after DB write)
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
    broadcastMeta,
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
