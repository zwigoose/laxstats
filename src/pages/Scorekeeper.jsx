import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  fetchGame, fetchGameMeta, updateGame, deleteGame,
  fetchOrgContext, createScorekeeperInvite, claimScorekeeperInvite,
  deleteAllGameEvents,
} from "../services/games";
import { useAuth } from "../contexts/AuthContext";
import LaxStats from "../components/LaxStats";
import { useGameEvents } from "../hooks/useGameEvents";

const S = {
  header:      { display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid #e5e5e5", background: "#fff", position: "sticky", top: 0, zIndex: 10, fontFamily: "system-ui, sans-serif" },
  backBtn:     { fontSize: 13, fontWeight: 500, color: "#888", background: "none", border: "none", cursor: "pointer", padding: "4px 0", letterSpacing: "0.01em" },
  headerTitle: { fontSize: 17, fontWeight: 700, color: "#111", flex: 1, letterSpacing: "-0.01em" },
  saveStatus:  { fontSize: 12, color: "#aaa" },
  viewBtn:     { padding: "6px 12px", fontSize: 12, fontWeight: 500, background: "transparent", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", color: "#555" },
  loading:     { fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "#888", fontSize: 14 },
  error:       { fontFamily: "system-ui, sans-serif", maxWidth: 400, margin: "40px auto", padding: 20, background: "#fff5f5", border: "1px solid #f0a0a0", borderRadius: 10, color: "#c0392b", fontSize: 14 },
  secondaryBadge: { fontSize: 11, fontWeight: 700, color: "#1a6bab", background: "#eef4fb", border: "1px solid #c0d8f0", borderRadius: 6, padding: "2px 8px", letterSpacing: "0.04em" },
  primaryBadge:   { fontSize: 11, fontWeight: 700, color: "#2a7a3b", background: "#eaf6ec", border: "1px solid #b5e0c0", borderRadius: 6, padding: "2px 8px", letterSpacing: "0.04em" },
};

// ── v1 path — JSONB blob save (unchanged) ─────────────────────────────────────
function ScorekeeperV1({ game, id, navigate, orgContext }) {
  const [saveStatus, setSaveStatus] = useState("");
  const saveTimer    = useRef(null);
  const pendingSave  = useRef(null);
  const saveInFlight = useRef(false);
  const [gameName, setGameName] = useState(game?.name || "");

  const handleStateChange = useCallback(async (newState) => {
    pendingSave.current = newState;
    if (newState.teams?.[0]?.name && newState.teams?.[1]?.name) {
      setGameName(`${newState.teams[0].name} vs ${newState.teams[1].name}`);
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (saveInFlight.current) return;
      const stateToSave = pendingSave.current;
      if (!stateToSave) return;
      saveInFlight.current = true;
      setSaveStatus("saving");
      pendingSave.current = null;
      const updatePayload = { state: stateToSave };
      if (stateToSave.teams?.[0]?.name && stateToSave.teams?.[1]?.name) {
        updatePayload.name = `${stateToSave.teams[0].name} vs ${stateToSave.teams[1].name}`;
      }
      const { error: err } = await updateGame(id, updatePayload);
      saveInFlight.current = false;
      if (err) { setSaveStatus("error"); setTimeout(() => setSaveStatus(""), 3000); }
      else {
        setSaveStatus("saved"); setTimeout(() => setSaveStatus(""), 2000);
        if (pendingSave.current) handleStateChange(pendingSave.current);
      }
    }, 800);
  }, [id]);

  return (
    <div>
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => navigate("/")}>← Games</button>
        <img src="/LaxStatsIcon.png" alt="LaxStats" style={{ width: 28, height: 28, objectFit: "contain" }} />
        <span style={S.headerTitle}>{gameName || "Scorekeeper"}</span>
        <span style={S.saveStatus}>
          {saveStatus === "saving" && "Saving…"}
          {saveStatus === "saved"  && "Saved ✓"}
          {saveStatus === "error"  && "Save failed"}
        </span>
        <button style={S.viewBtn} onClick={() => navigate(`/games/${id}/view`)}>Live view →</button>
      </div>
      <LaxStats
        initialState={game?.state}
        createdAt={game?.created_at}
        onStateChange={handleStateChange}
        orgContext={orgContext}
        onOrgTeamSelected={async (teamIdx, teamId) => {
          const col = teamIdx === 0 ? "home_team_id" : "away_team_id";
          await updateGame(id, { [col]: teamId });
        }}
        onCancel={async () => { await deleteGame(id); navigate("/"); }}
      />
    </div>
  );
}

// ── v2 path — game_events table + Realtime ────────────────────────────────────
function ScorekeeperV2({ game, id, navigate, userId, isAnonymous, orgContext }) {
  const [saveStatus, setSaveStatus] = useState("");
  const saveTimer    = useRef(null);
  const pendingMeta  = useRef(null);
  const saveInFlight = useRef(false);
  const [gameName, setGameName]   = useState(game?.name || "");
  const [inviteLink,  setInviteLink]  = useState(null);
  const [inviteState, setInviteState] = useState("idle"); // idle | generating | ready | copied | error
  const [inviteError, setInviteError] = useState(null);

  async function generateInviteLink() {
    setInviteState("generating");
    setInviteError(null);
    const { data: token, error } = await createScorekeeperInvite(id);
    if (error || !token) {
      setInviteError(error?.message || "Failed to generate link");
      setInviteState("error");
      return;
    }
    setInviteLink(`${window.location.origin}/games/${id}/score?token=${token}`);
    setInviteState("ready");
  }

  function copyInviteLink() {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setInviteState("copied");
      setTimeout(() => setInviteState("ready"), 2000);
    });
  }

  const {
    entries,
    loading:       eventsLoading,
    commitGroup,
    softDeleteGroup,
    broadcastMeta,
    isPrimary,
    presenceList,
    remoteQuarterState,
    error:         eventsError,
    channelStatus,
  } = useGameEvents(id, userId);

  // Build initialState: use game.state for meta (teams, quarter, etc.)
  // but inject events from game_events as the log.
  const initialState = eventsLoading
    ? undefined  // still loading — LaxStats waits
    : (game?.state
        ? { ...game.state, log: entries }
        : (entries.length > 0 ? { log: entries } : null));

  // Meta-event handler: persist quarter/gameOver changes to games.state
  const handleMetaEvent = useCallback(async (type, payload) => {
    setSaveStatus("saving");
    const { data: current } = await fetchGameMeta(id);
    const meta = current?.state ? { ...current.state } : {};
    delete meta.log; // v2 games don't store log in state

    if (type === "endQuarter") {
      meta.completedQuarters = [...(meta.completedQuarters || []), payload.quarter];
      meta.currentQuarter    = (meta.currentQuarter || 1) + 1;
    } else if (type === "gameOver") {
      meta.completedQuarters = [...(meta.completedQuarters || []), payload.quarter];
      meta.gameOver          = true;
    }

    const { error: err } = await updateGame(id, { state: meta });

    if (err) { setSaveStatus("error"); setTimeout(() => setSaveStatus(""), 3000); }
    else {
      setSaveStatus("saved"); setTimeout(() => setSaveStatus(""), 2000);
      // Broadcast quarter/game-over state so secondary scorers update immediately
      broadcastMeta({ currentQuarter: meta.currentQuarter, completedQuarters: meta.completedQuarters, gameOver: !!meta.gameOver });
    }
  }, [id, broadcastMeta]);

  // State change handler: persist team/meta changes (NOT the log — that's in game_events)
  const handleStateChange = useCallback(async (newState) => {
    if (newState.teams?.[0]?.name && newState.teams?.[1]?.name) {
      setGameName(`${newState.teams[0].name} vs ${newState.teams[1].name}`);
    }
    // Build meta payload (no log); compute score from log so game list can display it
    const { log: _log, ...meta } = newState;
    meta.score0 = (_log || []).filter(e => e.event === "goal" && e.teamIdx === 0).length;
    meta.score1 = (_log || []).filter(e => e.event === "goal" && e.teamIdx === 1).length;
    pendingMeta.current = meta;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (saveInFlight.current) return;
      const stateToSave = pendingMeta.current;
      if (!stateToSave) return;
      saveInFlight.current = true;
      setSaveStatus("saving");
      pendingMeta.current = null;
      const updatePayload = { state: stateToSave };
      if (stateToSave.teams?.[0]?.name && stateToSave.teams?.[1]?.name) {
        updatePayload.name = `${stateToSave.teams[0].name} vs ${stateToSave.teams[1].name}`;
      }
      const { error: err } = await updateGame(id, updatePayload);
      saveInFlight.current = false;
      if (err) { setSaveStatus("error"); setTimeout(() => setSaveStatus(""), 3000); }
      else { setSaveStatus("saved"); setTimeout(() => setSaveStatus(""), 2000); }
    }, 800);
  }, [id]);

  const scorerCount = presenceList.length;

  return (
    <div>
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => navigate("/")}>← Games</button>
        <img src="/LaxStatsIcon.png" alt="LaxStats" style={{ width: 28, height: 28, objectFit: "contain" }} />
        <span style={S.headerTitle}>{gameName || "Scorekeeper"}</span>
        {scorerCount > 1 && (
          <span style={isPrimary ? S.primaryBadge : S.secondaryBadge}>
            {isPrimary ? "Primary" : "Secondary"}
            {scorerCount > 1 && ` · ${scorerCount} scorers`}
          </span>
        )}
        <span style={S.saveStatus}>
          {saveStatus === "saving" && "Saving…"}
          {saveStatus === "saved"  && "Saved ✓"}
          {saveStatus === "error"  && "Save failed"}
          {eventsError && !saveStatus && (channelStatus === "error" || channelStatus === "timed_out" ? "Sync error" : "Event error")}
        </span>
        {game?.multi_scorer_enabled && !isAnonymous && (
          <button style={S.viewBtn} onClick={() => {
            if (inviteLink || inviteState === "error") { setInviteLink(null); setInviteState("idle"); setInviteError(null); }
            else generateInviteLink();
          }} disabled={inviteState === "generating"}>
            {inviteState === "generating" ? "…" : (inviteLink || inviteState === "error") ? "Hide" : "Invite scorer"}
          </button>
        )}
        <button style={S.viewBtn} onClick={() => navigate(`/games/${id}/view`)}>Live view →</button>
      </div>

      {inviteState === "error" && (
        <div style={{ padding: "8px 16px", background: "#fff5f5", borderBottom: "1px solid #fdd", fontFamily: "system-ui, sans-serif", fontSize: 12, color: "#c0392b" }}>
          Could not generate invite link: {inviteError}
        </div>
      )}

      {inviteLink && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", background: "#f0f7ff", borderBottom: "1px solid #c8dff5", fontFamily: "system-ui, sans-serif" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#1a6bab", whiteSpace: "nowrap" }}>Scorer invite link</span>
          <span style={{ flex: 1, fontSize: 11, color: "#444", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" }}>{inviteLink}</span>
          <button onClick={copyInviteLink} style={{ padding: "4px 12px", fontSize: 11, fontWeight: 600, background: inviteState === "copied" ? "#2a7a3b" : "#1a6bab", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap" }}>
            {inviteState === "copied" ? "Copied ✓" : "Copy"}
          </button>
          <button onClick={generateInviteLink} style={{ padding: "4px 10px", fontSize: 11, color: "#1a6bab", background: "transparent", border: "1px solid #b3d4f0", borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap" }}>
            New link
          </button>
          <span style={{ fontSize: 10, color: "#999", whiteSpace: "nowrap" }}>Expires 24h</span>
        </div>
      )}

      {eventsLoading ? (
        <div style={S.loading}>Loading events…</div>
      ) : (
        <LaxStats
          initialState={initialState}
          createdAt={game?.created_at}
          onStateChange={handleStateChange}
          onEventCommit={commitGroup}
          onEventSoftDelete={softDeleteGroup}
          onMetaEvent={handleMetaEvent}
          remoteEntries={entries}
          remoteQuarterState={remoteQuarterState}
          scorekeeperRole={isPrimary ? "primary" : "secondary"}
          orgContext={orgContext}
          onOrgTeamSelected={async (teamIdx, teamId) => {
            const col = teamIdx === 0 ? "home_team_id" : "away_team_id";
            await updateGame(id, { [col]: teamId });
          }}
          onCancel={async () => {
            await deleteAllGameEvents(id, userId);
            await deleteGame(id);
            navigate("/");
          }}
        />
      )}
    </div>
  );
}

// ── Root — dispatches to v1 or v2 based on schema_ver ─────────────────────────
export default function Scorekeeper() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [game, setGame]           = useState(null);
  const [orgContext, setOrgContext] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [tokenClaimed, setTokenClaimed] = useState(false);
  const [anonPending, setAnonPending]   = useState(false);

  // Read invite token from URL — present when landing via a shared scoring link
  const inviteToken = new URLSearchParams(location.search).get("token");

  // Auth gate: if no token and no user, redirect to login preserving the URL
  useEffect(() => {
    if (authLoading) return;
    if (!user && !inviteToken) {
      navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`, { replace: true });
    }
  }, [authLoading, user, inviteToken]);

  // Token flow: if token present but no user, sign in anonymously so we get a real auth.uid()
  useEffect(() => {
    if (authLoading || user || !inviteToken || anonPending) return;
    setAnonPending(true);
    supabase.auth.signInAnonymously().catch(() => {
      // Anon auth not enabled — fall back to login page
      navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`, { replace: true });
    });
  }, [authLoading, user, inviteToken, anonPending]);

  // Claim the invite token once we have any user (anon or real)
  useEffect(() => {
    if (!inviteToken || !user || tokenClaimed) return;
    claimScorekeeperInvite(inviteToken).then(({ error: err }) => {
      setTokenClaimed(true);
      if (!err) navigate(`/games/${id}/score`, { replace: true });
      // Expired/invalid: still proceed — may have org/owner access already
    });
  }, [inviteToken, user, tokenClaimed, id]);

  useEffect(() => { loadGame(); }, [id]);

  async function loadGame() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await fetchGame(id);
    if (err) { setError(err.message); setLoading(false); return; }

    setOrgContext(data?.org_id ? await fetchOrgContext(data.org_id, data.season_id) : null);
    setGame(data);
    setLoading(false);
  }

  if (loading || authLoading || (inviteToken && !user)) return <div style={S.loading}>Loading game…</div>;
  if (error)   return <div style={S.error}>{error}</div>;

  if (game?.schema_ver === 2) {
    return <ScorekeeperV2 game={game} id={id} navigate={navigate} userId={user?.id} isAnonymous={user?.is_anonymous ?? false} orgContext={orgContext} />;
  }
  return <ScorekeeperV1 game={game} id={id} navigate={navigate} orgContext={orgContext} />;
}
