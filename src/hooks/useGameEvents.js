import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";

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
function entryToDbRow(entry, gameId, userId) {
  return {
    game_id:          gameId,
    group_id:         entry.groupId,
    quarter:          entry.quarter,
    event_type:       entry.event,
    team_idx:         entry.teamIdx,
    is_team_stat:     entry.teamStat  ?? false,
    player_num:       entry.player?.num  ?? null,
    player_name:      entry.player?.name ?? null,
    goal_time:        entry.goalTime     ?? null,
    penalty_time:     entry.penaltyTime  ?? null,
    timeout_time:     entry.timeoutTime  ?? null,
    is_non_releasable: entry.nonReleasable ?? false,
    penalty_minutes:  entry.penaltyMin   ?? null,
    shot_outcome:     entry.shotOutcome  ?? null,
    foul_name:        entry.foulName     ?? null,
    created_by:       userId,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Manages the v2 (game_events) event log for a game.
 *
 * Returns:
 *   entries       — log entries in LaxStats format, sorted by seq
 *   loading       — initial load state
 *   commitGroup   — async (stampedEntries) → writes to game_events; entries must
 *                   already have UUID groupId (set by LaxStats's commitEntries in v2 mode)
 *   softDeleteGroup — async (groupIdUuid) → sets deleted_at on all rows in group
 *   isPrimary     — true if this session is the designated primary scorer
 *   presenceList  — [{userId, joinedAt}, ...] sorted by join order
 *   error         — last error string or null
 *
 * Pass gameId=null to disable (v1 games).
 */
export function useGameEvents(gameId, userId) {
  const [entries, setEntries]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [presenceList, setPresenceList] = useState([]);
  const [remoteQuarterState, setRemoteQuarterState] = useState(null);
  const [error, setError]               = useState(null);

  const channelRef = useRef(null);

  // ── Initial load ─────────────────────────────────────────────────
  useEffect(() => {
    if (!gameId || !userId) { setLoading(false); return; }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, userId]);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("game_events")
      .select("*")
      .eq("game_id", gameId)
      .is("deleted_at", null)
      .order("seq");
    if (err) { setError(err.message); setLoading(false); return; }
    setEntries((data || []).map(dbRowToEntry));
    setLoading(false);
  }

  // ── Realtime + Presence ──────────────────────────────────────────
  useEffect(() => {
    if (!gameId || !userId) return;

    const channel = supabase.channel(`game-events-${gameId}`, {
      config: { presence: { key: userId } },
    });

    // Track presence (who else is scoring this game)
    // One entry per unique key (userId) — take the earliest joinedAt if multiple objects exist.
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
      if (payload?.scorerId === userId) return; // skip our own broadcast
      const incoming = (payload?.entries ?? []).map(dbRowToEntry);
      if (!incoming.length) return;
      setEntries(prev => {
        const existingIds = new Set(prev.map(e => e.dbId));
        const toAdd = incoming.filter(e => !existingIds.has(e.dbId));
        if (!toAdd.length) return prev;
        return [...prev, ...toAdd].sort((a, b) => a.seq - b.seq);
      });
    });

    // postgres_changes for INSERT kept as a fallback (covers cases where
    // broadcast is missed, e.g. brief disconnects).
    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "game_events", filter: `game_id=eq.${gameId}` },
      (payload) => {
        const row = payload.new;
        if (row.created_by === userId) return; // skip own events
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

    // postgres_changes UPDATE as fallback for soft-deletes
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
        await channel.track({ online_at: new Date().toISOString() });
      }
    });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [gameId, userId]);

  // ── Commit a group of entries ────────────────────────────────────
  const commitGroup = useCallback(async (stampedEntries) => {
    if (!gameId || !userId || !stampedEntries?.length) return;
    const rows = stampedEntries.map(e => entryToDbRow(e, gameId, userId));
    const { data: inserted, error: err } = await supabase
      .from("game_events").insert(rows).select();
    if (err) {
      setError(err.message);
      throw err;
    }
    // Broadcast to other scorers immediately (don't wait for postgres_changes delivery)
    channelRef.current?.send({
      type: "broadcast",
      event: "new_events",
      payload: { scorerId: userId, entries: inserted ?? rows },
    });
  }, [gameId, userId]);

  // ── Soft-delete all rows in a group ─────────────────────────────
  const softDeleteGroup = useCallback(async (groupIdUuid) => {
    if (!gameId || !userId) return;
    const now = new Date().toISOString();
    const { error: err } = await supabase
      .from("game_events")
      .update({ deleted_at: now, deleted_by: userId })
      .eq("game_id", gameId)
      .eq("group_id", groupIdUuid)
      .is("deleted_at", null);
    if (err) {
      setError(err.message);
      throw err;
    }
    // Optimistically remove from local state
    setEntries(prev => prev.filter(e => e.groupId !== groupIdUuid));
    // Broadcast deletion to other scorers immediately
    channelRef.current?.send({
      type: "broadcast",
      event: "delete_group",
      payload: { scorerId: userId, groupId: groupIdUuid },
    });
  }, [gameId, userId]);

  // Broadcast quarter/game-over state to other scorers (called by primary after DB write)
  const broadcastMeta = useCallback((meta) => {
    channelRef.current?.send({
      type: "broadcast",
      event: "meta_update",
      payload: { scorerId: userId, ...meta },
    });
  }, [userId]);

  // Primary scorer = first presence entry (by join order)
  const isPrimary = presenceList.length === 0 || presenceList[0]?.userId === userId;

  // Remote entries = entries from OTHER users (for LaxStats remoteEntries prop)
  const remoteEntries = entries.filter(e => {
    // We don't know which entries came from us vs others from the entries array alone.
    // Return all entries; LaxStats reconciles by groupId deduplication.
    return true;
  });

  return {
    entries,
    loading,
    commitGroup,
    softDeleteGroup,
    broadcastMeta,
    isPrimary,
    presenceList,
    remoteQuarterState,
    error,
    reload: load,
  };
}
