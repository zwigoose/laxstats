import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { qLabel } from "../components/LaxStats";
import { RosterEditor, SharePanel } from "./GameList";

const FAKE_DOMAIN = "@laxstats.app";
function toEmail(username) {
  const u = username.trim().toLowerCase();
  return u.includes("@") ? u : u + FAKE_DOMAIN;
}

// Separate client that won't touch the admin's session
function makeTempClient() {
  return createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function displayName(email) {
  if (!email) return "Unknown";
  return email.endsWith("@laxstats.app") ? email.replace("@laxstats.app", "") : email;
}

function getLatestTime(state) {
  if (!state?.log || !state.currentQuarter) return null;
  const q = state.currentQuarter;
  const toS = t => { const [m, s] = t.split(":").map(Number); return m * 60 + s; };
  const timed = (state.log || [])
    .filter(e => e.quarter === q && (e.goalTime || e.timeoutTime || e.penaltyTime))
    .map(e => { const str = e.goalTime || e.timeoutTime || e.penaltyTime; return { str, secs: toS(str) }; });
  if (!timed.length) return null;
  return timed.reduce((min, t) => t.secs < min.secs ? t : min).str;
}

function getGameInfo(game) {
  const s = game.state;
  if (!s?.teams) return null;
  const t0 = s.teams[0], t1 = s.teams[1];
  const score0 = (s.log || []).filter(e => e.event === "goal" && e.teamIdx === 0).length;
  const score1 = (s.log || []).filter(e => e.event === "goal" && e.teamIdx === 1).length;
  const started = !!s.trackingStarted;
  const currentQuarter = s.currentQuarter || 1;
  const latestTime = getLatestTime(s);
  return { t0, t1, score0, score1, gameOver: s.gameOver, started, currentQuarter, latestTime };
}

// ── Game Row (module-level so useState works) ─────────────────────────────────
function AdminGameRow({ game, userMap, users, onReassigned, onDeleted }) {
  const navigate = useNavigate();
  const info = getGameInfo(game);
  const owner = userMap[game.user_id];
  const c0 = info?.t0?.color || "#444";
  const c1 = info?.t1?.color || "#888";
  const [adminOpen, setAdminOpen] = useState(false);
  const [newOwnerId, setNewOwnerId] = useState(game.user_id || "");
  const [reassigning, setReassigning] = useState(false);
  const [reassignError, setReassignError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [pressboxEnabled, setPressboxEnabled] = useState(!!game.pressbox_enabled);
  const [togglingPressbox, setTogglingPressbox] = useState(false);
  const [pressboxError, setPressboxError] = useState(null);
  // org-level pressbox: null = not yet fetched, true/false = result
  const [orgPressbox, setOrgPressbox] = useState(null);
  const [multiScorerEnabled, setMultiScorerEnabled] = useState(!!game.multi_scorer_enabled);
  const [togglingMultiScorer, setTogglingMultiScorer] = useState(false);
  const [multiScorerError, setMultiScorerError] = useState(null);

  async function handleDelete() {
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    setDeleting(true);
    setDeleteError(null);
    // Use SECURITY DEFINER RPC so child-row deletes bypass RLS
    const { error: err } = await supabase.rpc("admin_delete_game", { p_game_id: game.id });
    if (err) { setDeleteError(err.message); setDeleting(false); }
    else { onDeleted(game.id); }
  }

  async function handleTogglePressbox() {
    setTogglingPressbox(true);
    setPressboxError(null);
    const next = !pressboxEnabled;
    const { error: err } = await supabase.rpc("admin_set_game_pressbox", { p_game_id: game.id, p_enabled: next });
    if (err) { setPressboxError(err.message); setTogglingPressbox(false); return; }
    setPressboxEnabled(next);
    setTogglingPressbox(false);
  }

  async function handleToggleMultiScorer() {
    setTogglingMultiScorer(true);
    setMultiScorerError(null);
    const next = !multiScorerEnabled;
    const { error: err } = await supabase.rpc("admin_set_game_multi_scorer", { p_game_id: game.id, p_enabled: next });
    if (err) { setMultiScorerError(err.message); setTogglingMultiScorer(false); return; }
    setMultiScorerEnabled(next);
    setTogglingMultiScorer(false);
  }

  async function handleReassign() {
    if (!newOwnerId || newOwnerId === game.user_id) return;
    setReassigning(true);
    setReassignError(null);
    const { error: err } = await supabase.rpc("admin_reassign_game", { p_game_id: game.id, p_user_id: newOwnerId });
    if (err) setReassignError(err.message);
    else { onReassigned(game.id, newOwnerId); setAdminOpen(false); }
    setReassigning(false);
  }

  return (
    <div style={{ borderRadius: 14, overflow: "hidden", marginBottom: 10, boxShadow: "0 2px 10px rgba(0,0,0,0.06)", border: "1px solid #e8e8e8", background: "#fff" }}>
      <div style={{ height: 4, background: info ? `linear-gradient(90deg, ${c0} 50%, ${c1} 50%)` : "#e0e0e0" }} />
      <div style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>
            {info ? `${info.t0.name} vs ${info.t1.name}` : game.name}
          </div>
          {info && (
            <div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#111" }}>
              <span style={{ color: c0 }}>{info.score0}</span>
              <span style={{ color: "#ccc", margin: "0 4px" }}>—</span>
              <span style={{ color: c1 }}>{info.score1}</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {info?.gameOver ? (
              <span style={{ fontSize: 11, fontWeight: 600, color: "#888", background: "#f0f0f0", borderRadius: 20, padding: "2px 8px" }}>Final</span>
            ) : info?.started ? (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#2a7a3b", background: "#eaf6ec", borderRadius: 20, padding: "2px 8px" }}>● Live{info.latestTime ? ` · ${info.latestTime} ${qLabel(info.currentQuarter)}` : ""}</span>
            ) : (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#d4820a", background: "#fff8ec", borderRadius: 20, padding: "2px 8px" }}>Pending</span>
            )}
            {owner && <span style={{ fontSize: 11, color: "#aaa" }}>{displayName(owner.email)}</span>}
            <span style={{ fontSize: 11, color: "#ccc" }}>
              Game: {formatDate((game.state?.gameDate) || game.created_at.split("T")[0])}
              {" · "}Created: {formatDate(game.created_at)}
            </span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={{ padding: "5px 10px", fontSize: 12, fontWeight: 500, background: "transparent", border: "1px solid #ddd", borderRadius: 7, cursor: "pointer", color: "#555" }}
              onClick={() => navigate(`/games/${game.id}/view`)}>View</button>
            <button style={{ padding: "5px 10px", fontSize: 12, fontWeight: 500, background: "transparent", border: "1px solid #ddd", borderRadius: 7, cursor: "pointer", color: "#555" }}
              onClick={() => window.open(`/games/${game.id}/pressbox`, "_blank")}>Press Box</button>
            <button style={{ padding: "5px 12px", fontSize: 12, fontWeight: 600, background: "#111", border: "none", borderRadius: 7, cursor: "pointer", color: "#fff" }}
              onClick={() => navigate(`/games/${game.id}/score`)}>{info?.started ? "Score" : "Setup"}</button>
            <button title="Reassign owner" style={{ padding: "5px 9px", fontSize: 12, background: adminOpen ? "#f0f0f0" : "transparent", border: "1px solid #ddd", borderRadius: 7, cursor: "pointer", color: "#888" }}
              onClick={() => {
                const opening = !adminOpen;
                setAdminOpen(opening);
                setDeleteConfirm(false);
                setDeleteError(null);
                // Fetch org pressbox status once when panel first opens
                if (opening && orgPressbox === null && game.org_id) {
                  supabase.rpc("org_feature_limit", { p_org_id: game.org_id, p_feature_id: "pressbox" })
                    .then(({ data }) => setOrgPressbox(data !== 0));
                }
              }}>⚙</button>
          </div>
        </div>
      </div>
      {adminOpen && (
        <div style={{ borderTop: "1px solid #f0f0f0", padding: "10px 16px 12px", background: "#fafafa" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Reassign owner</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select value={newOwnerId} onChange={e => setNewOwnerId(e.target.value)}
              style={{ flex: 1, padding: "6px 8px", fontSize: 13, border: "1px solid #e0e0e0", borderRadius: 8, background: "#fff" }}>
              <option value="">Select user…</option>
              {users.map(u => <option key={u.id} value={u.id}>{displayName(u.email)}</option>)}
            </select>
            <button onClick={handleReassign} disabled={!newOwnerId || newOwnerId === game.user_id || reassigning}
              style={{ padding: "6px 14px", fontSize: 13, fontWeight: 600, background: (newOwnerId && newOwnerId !== game.user_id && !reassigning) ? "#111" : "#ccc", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", flexShrink: 0 }}>
              {reassigning ? "…" : "Save"}
            </button>
          </div>
          {reassignError && <div style={{ fontSize: 12, color: "#c0392b", marginTop: 6 }}>{reassignError}</div>}
          <div style={{ marginTop: 14, borderTop: "1px solid #ebebeb", paddingTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Press Box</div>
            {orgPressbox ? (
              // Org plan enables pressbox for all games in this org — no per-game toggle needed
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  position: "relative", width: 40, height: 22, borderRadius: 11,
                  background: "#111", flexShrink: 0,
                }}>
                  <span style={{
                    position: "absolute", top: 3, left: 21,
                    width: 16, height: 16, borderRadius: "50%", background: "#fff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }} />
                </div>
                <span style={{ fontSize: 13, color: "#555" }}>Enabled via org plan</span>
                <button
                  onClick={() => window.open(`/games/${game.id}/pressbox`, "_blank")}
                  style={{ fontSize: 11, color: "#1a6bab", background: "none", border: "1px solid #c0d8f0", borderRadius: 6, padding: "3px 8px", cursor: "pointer", flexShrink: 0 }}
                >
                  Open ↗
                </button>
              </div>
            ) : (
              // No org-level pressbox — per-game override toggle
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  onClick={handleTogglePressbox}
                  disabled={togglingPressbox}
                  style={{
                    position: "relative", width: 40, height: 22, borderRadius: 11, border: "none",
                    background: pressboxEnabled ? "#111" : "#ddd",
                    cursor: togglingPressbox ? "default" : "pointer",
                    transition: "background 0.2s", flexShrink: 0, padding: 0,
                  }}
                >
                  <span style={{
                    position: "absolute", top: 3, left: pressboxEnabled ? 21 : 3,
                    width: 16, height: 16, borderRadius: "50%", background: "#fff",
                    transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }} />
                </button>
                <span style={{ fontSize: 13, color: "#555" }}>
                  {pressboxEnabled ? "Enabled — press box link is active for this game" : "Disabled — enable to share the press box view"}
                </span>
                {pressboxEnabled && (
                  <button
                    onClick={() => window.open(`/games/${game.id}/pressbox`, "_blank")}
                    style={{ fontSize: 11, color: "#1a6bab", background: "none", border: "1px solid #c0d8f0", borderRadius: 6, padding: "3px 8px", cursor: "pointer", flexShrink: 0 }}
                  >
                    Open ↗
                  </button>
                )}
              </div>
            )}
            {pressboxError && <div style={{ fontSize: 12, color: "#c0392b", marginTop: 6 }}>{pressboxError}</div>}
          </div>
          {game.schema_ver === 2 && (
            <div style={{ marginTop: 14, borderTop: "1px solid #ebebeb", paddingTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Multi-Scorekeeper</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  onClick={handleToggleMultiScorer}
                  disabled={togglingMultiScorer}
                  style={{
                    position: "relative", width: 40, height: 22, borderRadius: 11, border: "none",
                    background: multiScorerEnabled ? "#111" : "#ddd",
                    cursor: togglingMultiScorer ? "default" : "pointer",
                    transition: "background 0.2s", flexShrink: 0, padding: 0,
                  }}
                >
                  <span style={{
                    position: "absolute", top: 3, left: multiScorerEnabled ? 21 : 3,
                    width: 16, height: 16, borderRadius: "50%", background: "#fff",
                    transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }} />
                </button>
                <span style={{ fontSize: 13, color: "#555" }}>
                  {multiScorerEnabled ? "Enabled — scorer invite links can be generated" : "Disabled — only the game owner can score"}
                </span>
              </div>
              {multiScorerError && <div style={{ fontSize: 12, color: "#c0392b", marginTop: 6 }}>{multiScorerError}</div>}
            </div>
          )}
          <div style={{ marginTop: 14, borderTop: "1px solid #ebebeb", paddingTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Danger zone</div>
            {!deleteConfirm ? (
              <button onClick={handleDelete}
                style={{ padding: "6px 14px", fontSize: 13, fontWeight: 500, background: "transparent", border: "1px solid #e0a0a0", borderRadius: 8, cursor: "pointer", color: "#c0392b" }}>
                Delete game
              </button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, color: "#c0392b", fontWeight: 500 }}>Delete permanently?</span>
                <button onClick={handleDelete} disabled={deleting}
                  style={{ padding: "6px 14px", fontSize: 13, fontWeight: 700, background: deleting ? "#ccc" : "#c0392b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
                  {deleting ? "Deleting…" : "Yes, delete"}
                </button>
                <button onClick={() => { setDeleteConfirm(false); setDeleteError(null); }}
                  style={{ padding: "6px 12px", fontSize: 13, background: "transparent", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", color: "#888" }}>
                  Cancel
                </button>
              </div>
            )}
            {deleteError && <div style={{ fontSize: 12, color: "#c0392b", marginTop: 6 }}>{deleteError}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared section toggle ─────────────────────────────────────────────────────
function SectionToggle({ label, count, open, onToggle }) {
  if (count === 0) return null;
  return (
    <button onClick={onToggle} style={{
      width: "100%", padding: "8px 12px", marginTop: 4, marginBottom: open ? 8 : 4,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      background: "#f5f5f5", border: "1px solid #e8e8e8", borderRadius: 8,
      cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#666",
    }}>
      <span>{count} {label}{count !== 1 ? "s" : ""}</span>
      <span style={{ fontSize: 12, color: "#aaa", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s", display: "inline-block" }}>›</span>
    </button>
  );
}

// ── Org game group ────────────────────────────────────────────────────────────
function OrgGameGroup({ orgName, orgSlug, games, userMap, users, onReassigned, onDeleted }) {
  const live    = games.filter(g => { const i = getGameInfo(g); return i?.started && !i?.gameOver; });
  const pending = games.filter(g => { const i = getGameInfo(g); return !i?.started; });
  const final   = games.filter(g => { const i = getGameInfo(g); return i?.gameOver; });

  const [open, setOpen]           = useState(live.length > 0);
  const [showPending, setShowPending] = useState(false);
  const [showFinal, setShowFinal]     = useState(false);

  return (
    <div style={{ marginBottom: 10 }}>
      {/* Org header row */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%", padding: "10px 14px",
          display: "flex", alignItems: "center", gap: 10,
          background: "#fff", border: "1px solid #e0e0e0", borderRadius: open ? "12px 12px 0 0" : 12,
          cursor: "pointer", textAlign: "left",
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: "#111", flex: 1 }}>{orgName}</span>
        {live.length > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, color: "#2a7a3b", background: "#eaf6ec", borderRadius: 20, padding: "2px 8px" }}>
            ● {live.length} live
          </span>
        )}
        <span style={{ fontSize: 11, color: "#aaa" }}>{games.length} game{games.length !== 1 ? "s" : ""}</span>
        <span style={{ fontSize: 13, color: "#ccc", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }}>›</span>
      </button>

      {open && (
        <div style={{ border: "1px solid #e0e0e0", borderTop: "none", borderRadius: "0 0 12px 12px", padding: "10px 12px 12px", background: "#fafafa" }}>
          {live.length === 0 && pending.length === 0 && final.length === 0 && (
            <div style={{ fontSize: 13, color: "#aaa", padding: "8px 0" }}>No games.</div>
          )}
          {live.map(g => (
            <AdminGameRow key={g.id} game={g} userMap={userMap} users={users} onReassigned={onReassigned} onDeleted={onDeleted} />
          ))}
          <SectionToggle label="pending game" count={pending.length} open={showPending} onToggle={() => setShowPending(v => !v)} />
          {showPending && pending.map(g => (
            <AdminGameRow key={g.id} game={g} userMap={userMap} users={users} onReassigned={onReassigned} onDeleted={onDeleted} />
          ))}
          <SectionToggle label="completed game" count={final.length} open={showFinal} onToggle={() => setShowFinal(v => !v)} />
          {showFinal && final.map(g => (
            <AdminGameRow key={g.id} game={g} userMap={userMap} users={users} onReassigned={onReassigned} onDeleted={onDeleted} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── All Games Tab ─────────────────────────────────────────────────────────────
function AllGamesTab() {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPersonalPending, setShowPersonalPending] = useState(false);
  const [showPersonalFinal, setShowPersonalFinal]     = useState(false);
  const [showCreateGame, setShowCreateGame] = useState(false);
  const [createForUserId, setCreateForUserId] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel("admin-all-games")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games" }, (payload) => {
        setGames(prev => prev.map(g => g.id === payload.new.id ? { ...g, ...payload.new } : g));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    const [gamesRes, usersRes] = await Promise.all([
      supabase.from("games").select("id, name, created_at, state, schema_ver, user_id, pressbox_enabled, multi_scorer_enabled, org_id, org:organizations!org_id(id, name, slug)").order("created_at", { ascending: false }),
      supabase.rpc("admin_get_users"),
    ]);
    if (gamesRes.error) { setError(gamesRes.error.message); setLoading(false); return; }
    setGames(gamesRes.data || []);
    setUsers(usersRes.data || []);
    setLoading(false);
  }

  const userMap = useMemo(() => {
    const m = {};
    users.forEach(u => { m[u.id] = u; });
    return m;
  }, [users]);

  // Split into org groups and personal
  const { orgGroups, personalGames } = useMemo(() => {
    const groups = {};
    const personal = [];
    for (const g of games) {
      if (g.org_id) {
        if (!groups[g.org_id]) groups[g.org_id] = { org: g.org, games: [] };
        groups[g.org_id].games.push(g);
      } else {
        personal.push(g);
      }
    }
    // Sort orgs: those with live games first, then alphabetically
    const sorted = Object.values(groups).sort((a, b) => {
      const aLive = a.games.some(g => { const i = getGameInfo(g); return i?.started && !i?.gameOver; });
      const bLive = b.games.some(g => { const i = getGameInfo(g); return i?.started && !i?.gameOver; });
      if (aLive !== bLive) return bLive ? 1 : -1;
      return (a.org?.name ?? "").localeCompare(b.org?.name ?? "");
    });
    return { orgGroups: sorted, personalGames: personal };
  }, [games]);

  const personalLive    = personalGames.filter(g => { const i = getGameInfo(g); return i?.started && !i?.gameOver; });
  const personalPending = personalGames.filter(g => { const i = getGameInfo(g); return !i?.started; });
  const personalFinal   = personalGames.filter(g => { const i = getGameInfo(g); return i?.gameOver; });

  async function handleCreateGame() {
    if (!createForUserId) return;
    setCreating(true);
    const name = `Game — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    const { data: gameId, error: err } = await supabase.rpc("admin_create_game", { p_user_id: createForUserId, p_name: name });
    if (err) { setError(err.message); setCreating(false); return; }
    setCreating(false);
    navigate(`/games/${gameId}/score`);
  }

  function handleGameReassigned(gameId, newUserId) {
    setGames(prev => prev.map(g => g.id === gameId ? { ...g, user_id: newUserId } : g));
  }

  function handleGameDeleted(gameId) {
    setGames(prev => prev.filter(g => g.id !== gameId));
  }

  if (loading) return <div style={{ textAlign: "center", padding: "48px 0", color: "#aaa", fontSize: 14 }}>Loading…</div>;
  if (error) return <div style={{ background: "#fff5f5", border: "1px solid #fdd", borderRadius: 10, padding: "12px 16px", color: "#c0392b", fontSize: 13, marginBottom: 16 }}>{error}</div>;

  return (
    <div>
      {/* Create game for user */}
      <div style={{ marginBottom: 14 }}>
        {!showCreateGame ? (
          <button onClick={() => setShowCreateGame(true)}
            style={{ padding: "7px 16px", fontSize: 13, fontWeight: 600, background: "#111", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer" }}>
            + New Game for User
          </button>
        ) : (
          <div style={{ border: "1px solid #e0e0e0", borderRadius: 14, padding: 16, background: "#fafafa" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>New Game</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select value={createForUserId} onChange={e => setCreateForUserId(e.target.value)}
                style={{ flex: 1, padding: "8px 10px", fontSize: 13, border: "1px solid #e0e0e0", borderRadius: 8, background: "#fff" }}>
                <option value="">Select user…</option>
                {users.map(u => <option key={u.id} value={u.id}>{displayName(u.email)}</option>)}
              </select>
              <button onClick={handleCreateGame} disabled={!createForUserId || creating}
                style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, background: createForUserId && !creating ? "#111" : "#ccc", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", flexShrink: 0 }}>
                {creating ? "Creating…" : "Create"}
              </button>
              <button onClick={() => { setShowCreateGame(false); setCreateForUserId(""); }}
                style={{ padding: "8px 12px", fontSize: 13, background: "transparent", border: "1px solid #e0e0e0", borderRadius: 8, cursor: "pointer", color: "#555", flexShrink: 0 }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {games.length === 0 && <div style={{ textAlign: "center", padding: "24px 0 12px", color: "#aaa", fontSize: 14 }}>No games yet.</div>}

      {/* Org groups */}
      {orgGroups.map(({ org, games: orgGames }) => (
        <OrgGameGroup
          key={org?.id ?? "unknown"}
          orgName={org?.name ?? "Unknown Org"}
          orgSlug={org?.slug}
          games={orgGames}
          userMap={userMap}
          users={users}
          onReassigned={handleGameReassigned}
          onDeleted={handleGameDeleted}
        />
      ))}

      {/* Personal games */}
      {personalGames.length > 0 && (
        <div style={{ marginTop: orgGroups.length > 0 ? 16 : 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            Personal Games
          </div>
          {personalLive.map(g => <AdminGameRow key={g.id} game={g} userMap={userMap} users={users} onReassigned={handleGameReassigned} onDeleted={handleGameDeleted} />)}
          <SectionToggle label="pending game" count={personalPending.length} open={showPersonalPending} onToggle={() => setShowPersonalPending(v => !v)} />
          {showPersonalPending && personalPending.map(g => <AdminGameRow key={g.id} game={g} userMap={userMap} users={users} onReassigned={handleGameReassigned} onDeleted={handleGameDeleted} />)}
          <SectionToggle label="completed game" count={personalFinal.length} open={showPersonalFinal} onToggle={() => setShowPersonalFinal(v => !v)} />
          {showPersonalFinal && personalFinal.map(g => <AdminGameRow key={g.id} game={g} userMap={userMap} users={users} onReassigned={handleGameReassigned} onDeleted={handleGameDeleted} />)}
        </div>
      )}
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────────────────
function UsersTab() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [deleteStages, setDeleteStages] = useState({});

  // Create user state
  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    const [usersRes, gamesRes] = await Promise.all([
      supabase.rpc("admin_get_users"),
      supabase.from("games").select("id, name, created_at, state, schema_ver, user_id, pressbox_enabled, multi_scorer_enabled").order("created_at", { ascending: false }),
    ]);
    if (usersRes.error) { setError(usersRes.error.message); setLoading(false); return; }
    setUsers(usersRes.data || []);
    setGames(gamesRes.data || []);
    setLoading(false);
  }

  async function toggleAdmin(userId, currentValue) {
    setTogglingId(userId);
    const { error: err } = await supabase.rpc("admin_set_admin", { target_id: userId, admin_value: !currentValue });
    if (err) setError(err.message);
    else setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_admin: !currentValue } : u));
    setTogglingId(null);
  }

  function setDeleteStage(userId, stage) {
    setDeleteStages(prev => stage === null
      ? (({ [userId]: _, ...rest }) => rest)(prev)
      : { ...prev, [userId]: stage }
    );
  }

  async function handleDeleteUser(userId) {
    const { error: err } = await supabase.rpc("admin_delete_user", { target_id: userId });
    if (err) { setError(err.message); setDeleteStage(userId, null); return; }
    setUsers(prev => prev.filter(u => u.id !== userId));
    setDeleteStage(userId, null);
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    const email = toEmail(newUsername);
    const tempClient = makeTempClient();
    const { data, error: err } = await tempClient.auth.signUp({ email, password: newPassword });
    if (err) {
      setCreateError(err.message);
    } else if (data?.user) {
      setShowCreate(false);
      setNewUsername("");
      setNewPassword("");
      // Reload users to show the new one
      const { data: usersData } = await supabase.rpc("admin_get_users");
      if (usersData) setUsers(usersData);
    }
    setCreating(false);
  }

  const gamesByUser = useMemo(() => {
    const map = {};
    games.forEach(g => {
      if (!map[g.user_id]) map[g.user_id] = [];
      map[g.user_id].push(g);
    });
    return map;
  }, [games]);

  if (loading) return <div style={{ textAlign: "center", padding: "48px 0", color: "#aaa", fontSize: 14 }}>Loading…</div>;
  if (error) return <div style={{ background: "#fff5f5", border: "1px solid #fdd", borderRadius: 10, padding: "12px 16px", color: "#c0392b", fontSize: 13, marginBottom: 16 }}>{error}</div>;

  const inputStyle = { width: "100%", padding: "8px 10px", fontSize: 14, border: "1px solid #e0e0e0", borderRadius: 8, background: "#fff", boxSizing: "border-box", fontFamily: "system-ui, sans-serif" };

  return (
    <div>
      {/* Create user */}
      <div style={{ marginBottom: 16 }}>
        {!showCreate ? (
          <button onClick={() => setShowCreate(true)} style={{ padding: "7px 16px", fontSize: 13, fontWeight: 600, background: "#111", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer" }}>
            + Create User
          </button>
        ) : (
          <div style={{ border: "1px solid #e0e0e0", borderRadius: 14, padding: 16, background: "#fafafa" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>New User</div>
            <form onSubmit={handleCreateUser}>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Username</label>
                <input style={inputStyle} type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)}
                  placeholder="username" required autoCapitalize="off" autoCorrect="off" />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Password</label>
                <input style={inputStyle} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters" required autoComplete="new-password" />
              </div>
              {createError && (
                <div style={{ background: "#fff5f5", border: "1px solid #fdd", borderRadius: 8, padding: "8px 12px", color: "#c0392b", fontSize: 12, marginBottom: 10 }}>{createError}</div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => { setShowCreate(false); setCreateError(null); setNewUsername(""); setNewPassword(""); }}
                  style={{ padding: "8px 14px", fontSize: 13, background: "transparent", border: "1px solid #e0e0e0", borderRadius: 8, cursor: "pointer", color: "#555" }}>
                  Cancel
                </button>
                <button type="submit" disabled={creating}
                  style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, background: creating ? "#ccc" : "#111", color: "#fff", border: "none", borderRadius: 8, cursor: creating ? "not-allowed" : "pointer" }}>
                  {creating ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {users.map(u => {
          const open = expandedId === u.id;
          const userGames = gamesByUser[u.id] || [];
          const isSelf = u.id === currentUser?.id;
          const deleteStage = deleteStages[u.id] ?? 0;
          return (
            <li key={u.id} style={{ border: "1px solid #e8e8e8", borderRadius: 14, marginBottom: 10, overflow: "hidden", background: "#fff", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer" }}
                onClick={() => setExpandedId(open ? null : u.id)}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: u.is_admin ? "#fff3e0" : "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                  {u.is_admin ? "⭐" : "👤"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#111" }}>{displayName(u.email)}</span>
                    {isSelf && <span style={{ fontSize: 10, fontWeight: 700, color: "#1a6bab", background: "#eef4fb", borderRadius: 6, padding: "2px 6px", letterSpacing: "0.06em" }}>YOU</span>}
                    {u.is_admin && <span style={{ fontSize: 10, fontWeight: 700, color: "#d4820a", background: "#fff8ec", borderRadius: 6, padding: "2px 6px", letterSpacing: "0.06em", textTransform: "uppercase" }}>Admin</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>{userGames.length} game{userGames.length !== 1 ? "s" : ""}</div>
                </div>
                {!isSelf && (
                  <>
                    <button
                      disabled={togglingId === u.id}
                      onClick={e => { e.stopPropagation(); toggleAdmin(u.id, u.is_admin); }}
                      style={{ padding: "5px 11px", fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: "pointer", border: "1px solid", flexShrink: 0,
                        background: u.is_admin ? "#fff8ec" : "#f5f5f5",
                        color: u.is_admin ? "#d4820a" : "#555",
                        borderColor: u.is_admin ? "#f0d080" : "#ddd",
                      }}>
                      {togglingId === u.id ? "…" : u.is_admin ? "Revoke admin" : "Make admin"}
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteStage(u.id, deleteStage === 0 ? 1 : null); }}
                      style={{ padding: "5px 9px", fontSize: 14, background: "transparent", border: "1px solid #f0a0a0", borderRadius: 8, cursor: "pointer", color: "#c0392b", lineHeight: 1, flexShrink: 0 }}>
                      🗑
                    </button>
                  </>
                )}
                <div style={{ fontSize: 14, color: "#ccc", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s", marginLeft: isSelf ? 0 : 4 }}>›</div>
              </div>

              {deleteStage === 1 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: "#fff5f5", borderTop: "1px solid #fdd" }}>
                  <span style={{ fontSize: 13, color: "#c0392b", fontWeight: 500 }}>Delete this user?</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={{ padding: "5px 12px", fontSize: 12, background: "transparent", border: "1px solid #ddd", borderRadius: 7, cursor: "pointer", color: "#555" }}
                      onClick={() => setDeleteStage(u.id, null)}>Cancel</button>
                    <button style={{ padding: "5px 12px", fontSize: 12, background: "transparent", border: "1px solid #e08080", borderRadius: 7, cursor: "pointer", color: "#c0392b", fontWeight: 600 }}
                      onClick={() => setDeleteStage(u.id, 2)}>Delete</button>
                  </div>
                </div>
              )}
              {deleteStage === 2 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: "#fef0f0", borderTop: "1px solid #e8a0a0" }}>
                  <span style={{ fontSize: 13, color: "#c0392b", fontWeight: 600 }}>Permanently delete? Cannot be undone.</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={{ padding: "5px 12px", fontSize: 12, background: "transparent", border: "1px solid #ddd", borderRadius: 7, cursor: "pointer", color: "#555" }}
                      onClick={() => setDeleteStage(u.id, null)}>Cancel</button>
                    <button style={{ padding: "5px 12px", fontSize: 12, background: "#c0392b", border: "none", borderRadius: 7, cursor: "pointer", color: "#fff", fontWeight: 600 }}
                      onClick={() => handleDeleteUser(u.id)}>Yes, delete</button>
                  </div>
                </div>
              )}

              {open && (
                <div style={{ borderTop: "1px solid #f0f0f0", padding: "12px 16px" }}>
                  {userGames.length === 0 ? (
                    <div style={{ fontSize: 13, color: "#aaa" }}>No games yet.</div>
                  ) : (
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                      {userGames.map(g => {
                        const info = getGameInfo(g);
                        return (
                          <li key={g.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "#fafafa", borderRadius: 9, border: "1px solid #efefef" }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>
                                {info ? `${info.t0.name} vs ${info.t1.name}` : g.name}
                              </div>
                              <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{formatDate(g.created_at)}</div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              {info?.gameOver ? (
                                <span style={{ fontSize: 11, fontWeight: 600, color: "#888", background: "#f0f0f0", borderRadius: 20, padding: "2px 8px" }}>Final</span>
                              ) : info?.started ? (
                                <span style={{ fontSize: 11, fontWeight: 700, color: "#2a7a3b", background: "#eaf6ec", borderRadius: 20, padding: "2px 8px" }}>● Live{info.latestTime ? ` · ${info.latestTime} ${qLabel(info.currentQuarter)}` : ""}</span>
                              ) : (
                                <span style={{ fontSize: 11, fontWeight: 700, color: "#d4820a", background: "#fff8ec", borderRadius: 20, padding: "2px 8px" }}>Pending</span>
                              )}
                              {info && (
                                <span style={{ fontSize: 13, fontWeight: 700, color: "#111", fontVariantNumeric: "tabular-nums" }}>
                                  {info.score0}–{info.score1}
                                </span>
                              )}
                              <button style={{ padding: "3px 8px", fontSize: 11, fontWeight: 500, background: "transparent", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", color: "#555" }}
                                onClick={() => navigate(`/games/${g.id}/view`)}>View</button>
                              <button style={{ padding: "3px 8px", fontSize: 11, fontWeight: 600, background: "#111", border: "none", borderRadius: 6, cursor: "pointer", color: "#fff" }}
                                onClick={() => navigate(`/games/${g.id}/score`)}>{info?.started ? "Score" : "Setup"}</button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Admin Share Panel ─────────────────────────────────────────────────────────
// Uses security-definer RPCs so admin can manage shares on any roster
function AdminSharePanel({ rosterId }) {
  const [shares, setShares] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [username, setUsername] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState(null);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => {
    supabase.rpc("get_roster_shares", { p_roster_id: rosterId })
      .then(({ data }) => { setShares(data || []); setLoaded(true); });
  }, [rosterId]);

  async function handleSearch() {
    setSearching(true); setSearchResult(null); setSearchError(null);
    const { data, error: err } = await supabase.rpc("find_user_by_username", { p_username: username.trim() });
    if (err || !data?.length) setSearchError("User not found.");
    else if (shares.some(s => s.shared_with_user_id === data[0].id)) setSearchError("Already shared with this user.");
    else setSearchResult(data[0]);
    setSearching(false);
  }

  async function handleAdd() {
    if (!searchResult) return;
    setAdding(true);
    const { error: err } = await supabase.rpc("admin_add_roster_share", { p_roster_id: rosterId, p_user_id: searchResult.id });
    if (!err) {
      setSearchResult(null); setUsername("");
      supabase.rpc("get_roster_shares", { p_roster_id: rosterId }).then(({ data }) => setShares(data || []));
    }
    setAdding(false);
  }

  async function handleRemove(shareId) {
    setRemovingId(shareId);
    await supabase.rpc("admin_remove_roster_share", { p_share_id: shareId });
    setShares(prev => prev.filter(s => s.share_id !== shareId));
    setRemovingId(null);
  }

  if (!loaded) return <div style={{ fontSize: 12, color: "#aaa", paddingTop: 12 }}>Loading shares…</div>;

  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px dashed #e8e8e8" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Sharing</div>
      {shares.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 10px" }}>
          {shares.map(s => (
            <li key={s.share_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f5f5f5" }}>
              <span style={{ fontSize: 13, color: "#444" }}>{s.display_name}</span>
              <button onClick={() => handleRemove(s.share_id)} disabled={removingId === s.share_id}
                style={{ fontSize: 11, color: "#c0392b", background: "none", border: "1px solid #f0a0a0", borderRadius: 6, cursor: "pointer", padding: "2px 8px" }}>
                {removingId === s.share_id ? "…" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        <input
          style={{ flex: 1, padding: "7px 10px", fontSize: 13, border: "1px solid #e0e0e0", borderRadius: 8, fontFamily: "system-ui, sans-serif", boxSizing: "border-box" }}
          placeholder="Username or email"
          value={username}
          autoCapitalize="off" autoCorrect="off"
          onChange={e => { setUsername(e.target.value); setSearchResult(null); setSearchError(null); }}
          onKeyDown={e => e.key === "Enter" && username.trim() && handleSearch()}
        />
        <button onClick={handleSearch} disabled={!username.trim() || searching}
          style={{ padding: "7px 12px", fontSize: 13, fontWeight: 600, background: username.trim() && !searching ? "#111" : "#ccc", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap" }}>
          {searching ? "…" : "Find"}
        </button>
      </div>
      {searchError && <div style={{ fontSize: 12, color: "#c0392b", marginBottom: 6 }}>{searchError}</div>}
      {searchResult && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", background: "#f5f5f5", borderRadius: 8 }}>
          <span style={{ fontSize: 13, color: "#111" }}>{searchResult.display_name}</span>
          <button onClick={handleAdd} disabled={adding}
            style={{ fontSize: 12, fontWeight: 600, color: "#2a7a3b", background: "#eaf6ec", border: "1px solid #b5e0c0", borderRadius: 6, cursor: "pointer", padding: "3px 10px" }}>
            {adding ? "…" : "Share"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Owner Select ──────────────────────────────────────────────────────────────
function OwnerSelect({ currentUserId, users, onSave }) {
  const [selectedId, setSelectedId] = useState(currentUserId || "");
  const [saving, setSaving] = useState(false);
  async function handleSave() {
    if (!selectedId || selectedId === currentUserId) return;
    setSaving(true);
    await onSave(selectedId);
    setSaving(false);
  }
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
        style={{ flex: 1, padding: "6px 8px", fontSize: 13, border: "1px solid #e0e0e0", borderRadius: 8, background: "#fff" }}>
        <option value="">Select user…</option>
        {users.map(u => <option key={u.id} value={u.id}>{displayName(u.email)}</option>)}
      </select>
      <button onClick={handleSave} disabled={!selectedId || selectedId === currentUserId || saving}
        style={{ padding: "6px 14px", fontSize: 13, fontWeight: 600, background: (selectedId && selectedId !== currentUserId && !saving) ? "#111" : "#ccc", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", flexShrink: 0 }}>
        {saving ? "…" : "Save"}
      </button>
    </div>
  );
}

// ── Rosters Admin Tab ─────────────────────────────────────────────────────────
function RostersAdminTab() {
  const [rosters, setRosters] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedOwner, setExpandedOwner] = useState(null);
  const [editingRosterId, setEditingRosterId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [newForUserId, setNewForUserId] = useState("");

  useEffect(() => {
    Promise.all([
      supabase.rpc("admin_get_all_rosters"),
      supabase.rpc("admin_get_users"),
    ]).then(([rostersRes, usersRes]) => {
      if (rostersRes.error) setError(rostersRes.error.message);
      else setRosters(rostersRes.data || []);
      setUsers(usersRes.data || []);
      setLoading(false);
    });
  }, []);

  const userMap = useMemo(() => {
    const m = {};
    users.forEach(u => { m[u.id] = u; });
    return m;
  }, [users]);

  const byOwner = useMemo(() => {
    const map = {};
    rosters.forEach(r => {
      const key = r.user_id || "unowned";
      if (!map[key]) map[key] = { owner_name: r.owner_name || "Unowned", rosters: [] };
      map[key].rosters.push(r);
    });
    return Object.entries(map);
  }, [rosters]);

  function playerCount(roster) {
    if (!roster) return 0;
    return roster.split("\n").map(l => l.trim()).filter(Boolean).length;
  }

  async function handleCreate(fields) {
    if (!newForUserId) return;
    const { data, error: err } = await supabase.rpc("admin_create_roster", {
      p_user_id: newForUserId,
      p_name: fields.name,
      p_roster: fields.roster,
      p_color: fields.color,
    });
    if (err) { setError(err.message); return; }
    // Reload full rosters list to get owner_name populated correctly
    const { data: fresh } = await supabase.rpc("admin_get_all_rosters");
    if (fresh) setRosters(fresh);
    setShowNew(false);
    setNewForUserId("");
    // Expand the owner section for the new roster's user
    setExpandedOwner(newForUserId);
  }

  async function handleUpdate(rosterId, fields) {
    const { error: err } = await supabase.from("saved_teams").update(fields).eq("id", rosterId);
    if (err) { setError(err.message); return; }
    setRosters(prev => prev.map(r => r.id === rosterId ? { ...r, ...fields } : r));
    setEditingRosterId(null);
  }

  async function handleReassignRoster(rosterId, newUserId) {
    const { error: err } = await supabase.rpc("admin_reassign_roster", { p_roster_id: rosterId, p_user_id: newUserId });
    if (err) { setError(err.message); return; }
    // Reload to update owner_name display
    const { data: fresh } = await supabase.rpc("admin_get_all_rosters");
    if (fresh) setRosters(fresh);
    setEditingRosterId(null);
  }

  if (loading) return <div style={{ textAlign: "center", padding: "48px 0", color: "#aaa", fontSize: 14 }}>Loading…</div>;
  if (error) return <div style={{ background: "#fff5f5", border: "1px solid #fdd", borderRadius: 10, padding: "12px 16px", color: "#c0392b", fontSize: 13 }}>{error}</div>;

  return (
    <div>
      {/* Create roster for user */}
      <div style={{ marginBottom: 14 }}>
        {!showNew ? (
          <button onClick={() => setShowNew(true)}
            style={{ padding: "7px 16px", fontSize: 13, fontWeight: 600, background: "#111", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer" }}>
            + New Roster for User
          </button>
        ) : (
          <div style={{ border: "1px solid #e0e0e0", borderRadius: 14, padding: 16, background: "#fafafa" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>New Roster</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Owner</label>
              <select value={newForUserId} onChange={e => setNewForUserId(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #e0e0e0", borderRadius: 8, background: "#fff", boxSizing: "border-box" }}>
                <option value="">Select user…</option>
                {users.map(u => <option key={u.id} value={u.id}>{displayName(u.email)}</option>)}
              </select>
            </div>
            {newForUserId && (
              <RosterEditor isNew
                onSave={handleCreate}
                onCancel={() => { setShowNew(false); setNewForUserId(""); }}
              />
            )}
            {!newForUserId && (
              <button onClick={() => { setShowNew(false); setNewForUserId(""); }}
                style={{ padding: "8px 14px", fontSize: 13, background: "transparent", border: "1px solid #e0e0e0", borderRadius: 8, cursor: "pointer", color: "#555" }}>
                Cancel
              </button>
            )}
          </div>
        )}
      </div>

      {rosters.length === 0 && <div style={{ textAlign: "center", padding: "48px 0", color: "#aaa", fontSize: 14 }}>No rosters yet.</div>}

      {byOwner.map(([ownerId, { owner_name, rosters: ownerRosters }]) => {
        const open = expandedOwner === ownerId;
        return (
          <div key={ownerId} style={{ border: "1px solid #e8e8e8", borderRadius: 14, marginBottom: 10, overflow: "hidden", background: "#fff", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer" }}
              onClick={() => { setExpandedOwner(open ? null : ownerId); setEditingRosterId(null); }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#111" }}>{owner_name}</div>
                <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>{ownerRosters.length} roster{ownerRosters.length !== 1 ? "s" : ""}</div>
              </div>
              <div style={{ fontSize: 14, color: "#ccc", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>›</div>
            </div>
            {open && (
              <div style={{ borderTop: "1px solid #f0f0f0", padding: "10px 16px 14px" }}>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  {ownerRosters.map(r => {
                    const editing = editingRosterId === r.id;
                    return (
                      <li key={r.id} style={{ background: "#fafafa", borderRadius: 9, border: "1px solid #efefef", overflow: "hidden" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", cursor: "pointer" }}
                          onClick={() => setEditingRosterId(editing ? null : r.id)}>
                          <div style={{ width: 20, height: 20, borderRadius: "50%", background: r.color, flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{r.name}</div>
                            <div style={{ fontSize: 11, color: "#aaa" }}>{playerCount(r.roster)} players</div>
                          </div>
                          <div style={{ fontSize: 12, color: "#aaa", transform: editing ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>›</div>
                        </div>
                        {editing && (
                          <div style={{ padding: "0 12px 12px", borderTop: "1px solid #efefef" }}>
                            <RosterEditor
                              initial={r}
                              onSave={(fields) => handleUpdate(r.id, fields)}
                              onCancel={() => setEditingRosterId(null)}
                            />

                            {/* Owner reassignment */}
                            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px dashed #e8e8e8" }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Owner</div>
                              <OwnerSelect
                                currentUserId={r.user_id}
                                users={users}
                                onSave={(newUserId) => handleReassignRoster(r.id, newUserId)}
                              />
                            </div>

                            {/* Sharing */}
                            <AdminSharePanel rosterId={r.id} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Orgs Tab ──────────────────────────────────────────────────────────────────
const PLANS          = ["free", "starter", "pro", "enterprise"];
const PLAN_STATUS    = ["active", "trialing", "past_due", "canceled"];
const ORG_ROLES      = ["org_admin", "coach", "scorekeeper", "viewer"];
// Features whose limit is semantically on/off (1 = enabled, 0 = disabled)
const BOOLEAN_FEATURES = new Set(["pressbox", "season_stats", "multi_scorekeeper"]);

const PLAN_COLOR = {
  free: { bg: "#f5f5f5", color: "#888" },
  starter: { bg: "#eef4fb", color: "#1a6bab" },
  pro: { bg: "#eaf6ec", color: "#2a7a3b" },
  enterprise: { bg: "#fff8ec", color: "#d4820a" },
};
const STATUS_COLOR = {
  active: "#2a7a3b", trialing: "#1a6bab", past_due: "#d4820a", canceled: "#c0392b",
};

function OrgCard({ org, users, onUpdated, onDeleted }) {
  const navigate = useNavigate();
  const [open, setOpen]               = useState(false);
  const [members, setMembers]         = useState([]);
  const [features, setFeatures]       = useState([]);
  const [teams, setTeams]             = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError]             = useState(null);

  // Create team
  const [showNewTeam, setShowNewTeam]   = useState(false);
  const [newTeamName, setNewTeamName]   = useState("");
  const [newTeamColor, setNewTeamColor] = useState("#444444");
  const [creatingTeam, setCreatingTeam] = useState(false);

  // Create game
  const [showNewGame, setShowNewGame]   = useState(false);
  const [gameOwner, setGameOwner]       = useState("");

  // Plan editing
  const [editPlan, setEditPlan]       = useState(false);
  const [plan, setPlan]               = useState(org.plan);
  const [planStatus, setPlanStatus]   = useState(org.plan_status);
  const [savingPlan, setSavingPlan]   = useState(false);

  // Add member
  const [addUsername, setAddUsername] = useState("");
  const [addRole, setAddRole]         = useState("viewer");
  const [addSearchResult, setAddSearchResult] = useState(null);
  const [addError, setAddError]       = useState(null);
  const [searching, setSearching]     = useState(false);
  const [adding, setAdding]           = useState(false);

  // Delete org
  const [deleteStage, setDeleteStage] = useState(0);
  const [deleting, setDeleting]       = useState(false);

  async function loadDetail() {
    setLoadingDetail(true);
    const [mRes, fRes, tRes] = await Promise.all([
      supabase.rpc("admin_get_org_members", { p_org_id: org.id }),
      supabase.rpc("admin_get_org_features", { p_org_id: org.id }),
      supabase.from("teams").select("id, name, color").eq("org_id", org.id).order("name"),
    ]);
    if (mRes.error) setError(mRes.error.message);
    else setMembers(mRes.data || []);
    if (fRes.data) setFeatures(fRes.data);
    if (tRes.data) setTeams(tRes.data);
    setLoadingDetail(false);
  }

  async function handleCreateTeam() {
    if (!newTeamName.trim()) return;
    setCreatingTeam(true);
    const { data, error: err } = await supabase
      .from("teams")
      .insert({ name: newTeamName.trim(), color: newTeamColor, org_id: org.id })
      .select("id, name, color")
      .single();
    if (err) { setError(err.message); setCreatingTeam(false); return; }
    setTeams(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setNewTeamName("");
    setNewTeamColor("#444444");
    setShowNewTeam(false);
    setCreatingTeam(false);
    onUpdated({ ...org, team_count: Number(org.team_count) + 1 });
  }

  function handleCreateGame() {
    if (!gameOwner) return;
    const membership = {
      org_id: org.id,
      role: "org_admin",
      org: { id: org.id, name: org.name, slug: org.slug },
    };
    navigate("/games/new", { state: { orgMembership: membership, adminOwnerOverride: gameOwner } });
  }

  function toggle() {
    if (!open) loadDetail();
    setOpen(o => !o);
  }

  async function savePlan() {
    setSavingPlan(true);
    const { error: err } = await supabase.rpc("admin_set_org_plan", {
      p_org_id: org.id, p_plan: plan, p_plan_status: planStatus,
    });
    setSavingPlan(false);
    if (err) { setError(err.message); return; }
    setEditPlan(false);
    onUpdated({ ...org, plan, plan_status: planStatus });
  }

  async function handleSearch() {
    setSearching(true); setAddSearchResult(null); setAddError(null);
    const { data, error: err } = await supabase.rpc("find_user_by_username", { p_username: addUsername.trim() });
    if (err || !data?.length) setAddError("User not found.");
    else if (members.some(m => m.user_id === data[0].id)) setAddError("Already a member.");
    else setAddSearchResult(data[0]);
    setSearching(false);
  }

  async function handleAddMember() {
    if (!addSearchResult) return;
    setAdding(true);
    const { error: err } = await supabase.rpc("admin_add_org_member", {
      p_org_id: org.id, p_user_id: addSearchResult.id, p_role: addRole,
    });
    if (err) { setAddError(err.message); setAdding(false); return; }
    setAddUsername(""); setAddRole("viewer"); setAddSearchResult(null);
    await loadDetail();
    setAdding(false);
    onUpdated({ ...org, member_count: Number(org.member_count) + 1 });
  }

  async function handleRoleChange(userId, newRole) {
    const { error: err } = await supabase.rpc("admin_set_org_member_role", {
      p_org_id: org.id, p_user_id: userId, p_role: newRole,
    });
    if (err) setError(err.message);
    else setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, role: newRole } : m));
  }

  async function handleRemoveMember(userId) {
    const { error: err } = await supabase.rpc("admin_remove_org_member", {
      p_org_id: org.id, p_user_id: userId,
    });
    if (err) setError(err.message);
    else {
      setMembers(prev => prev.filter(m => m.user_id !== userId));
      onUpdated({ ...org, member_count: Math.max(0, Number(org.member_count) - 1) });
    }
  }

  async function handleFeatureOverride(featureId, rawVal) {
    const val = rawVal === "" ? null : parseInt(rawVal, 10);
    const resolved = isNaN(val) ? null : val;
    const { error: err } = await supabase.rpc("admin_set_feature_override", {
      p_org_id: org.id, p_feature_id: featureId, p_override_limit: resolved,
    });
    if (err) setError(err.message);
    else setFeatures(prev => prev.map(f =>
      f.feature_id === featureId ? { ...f, override_limit: resolved } : f
    ));
  }

  async function handleDelete() {
    setDeleting(true);
    const { error: err } = await supabase.rpc("admin_delete_org", { p_org_id: org.id });
    if (err) { setError(err.message); setDeleting(false); setDeleteStage(0); return; }
    onDeleted(org.id);
  }

  const pc = PLAN_COLOR[org.plan] || PLAN_COLOR.free;
  const inp = { padding: "6px 9px", fontSize: 13, border: "1px solid #e0e0e0", borderRadius: 8, fontFamily: "system-ui, sans-serif", background: "#fff", boxSizing: "border-box" };

  return (
    <div style={{ border: "1px solid #e8e8e8", borderRadius: 14, marginBottom: 10, overflow: "hidden", background: "#fff", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer" }} onClick={toggle}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>{org.name}</span>
            <span style={{ fontSize: 11, color: "#aaa" }}>/{org.slug}</span>
            <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "2px 7px", background: pc.bg, color: pc.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>{org.plan}</span>
            <span style={{ fontSize: 11, color: STATUS_COLOR[org.plan_status] || "#888" }}>{org.plan_status}</span>
          </div>
          <div style={{ fontSize: 12, color: "#aaa", marginTop: 3 }}>
            {org.member_count} member{org.member_count !== 1 ? "s" : ""} · {org.game_count} game{org.game_count !== 1 ? "s" : ""} · {org.season_count} season{org.season_count !== 1 ? "s" : ""} · {org.team_count} team{org.team_count !== 1 ? "s" : ""}
          </div>
        </div>
        <div style={{ fontSize: 14, color: "#ccc", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>›</div>
      </div>

      {open && (
        <div style={{ borderTop: "1px solid #f0f0f0", padding: "16px" }}>
          {error && <div style={{ background: "#fff5f5", border: "1px solid #fdd", borderRadius: 8, padding: "8px 12px", color: "#c0392b", fontSize: 12, marginBottom: 12 }}>{error}</div>}
          {loadingDetail ? (
            <div style={{ color: "#aaa", fontSize: 13 }}>Loading…</div>
          ) : (
            <>
              {/* ── Plan ── */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Plan</div>
                {!editPlan ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 13, color: "#111" }}>{org.plan} · {org.plan_status}</span>
                    <button onClick={() => setEditPlan(true)} style={{ fontSize: 12, color: "#1a6bab", background: "none", border: "1px solid #c0d8f0", borderRadius: 6, padding: "2px 9px", cursor: "pointer" }}>Edit</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <select value={plan} onChange={e => setPlan(e.target.value)} style={{ ...inp }}>
                      {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <select value={planStatus} onChange={e => setPlanStatus(e.target.value)} style={{ ...inp }}>
                      {PLAN_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button onClick={savePlan} disabled={savingPlan} style={{ padding: "6px 14px", fontSize: 13, fontWeight: 600, background: "#111", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>{savingPlan ? "…" : "Save"}</button>
                    <button onClick={() => { setEditPlan(false); setPlan(org.plan); setPlanStatus(org.plan_status); }} style={{ padding: "6px 12px", fontSize: 13, background: "transparent", border: "1px solid #e0e0e0", borderRadius: 8, cursor: "pointer", color: "#555" }}>Cancel</button>
                  </div>
                )}
              </div>

              {/* ── Members ── */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Members</div>
                {members.length === 0 ? (
                  <div style={{ fontSize: 13, color: "#aaa", marginBottom: 10 }}>No members.</div>
                ) : (
                  <div style={{ marginBottom: 10 }}>
                    {members.map(m => (
                      <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid #f5f5f5" }}>
                        <span style={{ flex: 1, fontSize: 13, color: "#111" }}>{displayName(m.email)}</span>
                        <select value={m.role} onChange={e => handleRoleChange(m.user_id, e.target.value)}
                          style={{ ...inp, padding: "4px 7px", fontSize: 12 }}>
                          {ORG_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <button onClick={() => handleRemoveMember(m.user_id)}
                          style={{ fontSize: 11, color: "#c0392b", background: "none", border: "1px solid #f0a0a0", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>Remove</button>
                      </div>
                    ))}
                  </div>
                )}
                {/* Add member */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <input style={{ ...inp, flex: 1, minWidth: 120 }} placeholder="Username or email" value={addUsername}
                    autoCapitalize="off" autoCorrect="off"
                    onChange={e => { setAddUsername(e.target.value); setAddSearchResult(null); setAddError(null); }}
                    onKeyDown={e => e.key === "Enter" && addUsername.trim() && handleSearch()} />
                  <select value={addRole} onChange={e => setAddRole(e.target.value)} style={{ ...inp }}>
                    {ORG_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {!addSearchResult ? (
                    <button onClick={handleSearch} disabled={!addUsername.trim() || searching}
                      style={{ padding: "6px 12px", fontSize: 13, fontWeight: 600, background: addUsername.trim() ? "#111" : "#ccc", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
                      {searching ? "…" : "Find"}
                    </button>
                  ) : (
                    <button onClick={handleAddMember} disabled={adding}
                      style={{ padding: "6px 12px", fontSize: 13, fontWeight: 600, background: "#2a7a3b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
                      {adding ? "…" : `Add ${addSearchResult.display_name}`}
                    </button>
                  )}
                </div>
                {addError && <div style={{ fontSize: 12, color: "#c0392b", marginTop: 4 }}>{addError}</div>}
              </div>

              {/* ── Feature overrides ── */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Feature Limits</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "6px 12px", alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#aaa" }}>Feature</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#aaa" }}>Plan default</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#aaa" }}>Override</span>
                  {features.map(f => {
                    const isBool = BOOLEAN_FEATURES.has(f.feature_id);
                    const planLabel = isBool
                      ? (f.plan_limit === 0 ? "false" : "true")
                      : (f.plan_limit === null ? "∞" : f.plan_limit === 0 ? "off" : String(f.plan_limit));
                    return (
                      <>
                        <span key={f.feature_id + "_n"} style={{ fontSize: 13, color: "#111" }}>{f.description || f.feature_id}</span>
                        <span key={f.feature_id + "_p"} style={{ fontSize: 12, color: "#aaa", textAlign: "right" }}>
                          {planLabel}
                        </span>
                        {isBool ? (
                          <select key={f.feature_id + "_o"}
                            value={f.override_limit === null ? "" : String(f.override_limit)}
                            onChange={e => handleFeatureOverride(f.feature_id, e.target.value)}
                            style={{ ...inp, padding: "4px 6px", fontSize: 12, minWidth: 90 }}>
                            <option value="">Plan default</option>
                            <option value="1">true</option>
                            <option value="0">false</option>
                          </select>
                        ) : (
                          <input key={f.feature_id + "_o"}
                            style={{ ...inp, width: 64, textAlign: "center", padding: "4px 6px", fontSize: 12 }}
                            placeholder="—"
                            defaultValue={f.override_limit ?? ""}
                            onBlur={e => handleFeatureOverride(f.feature_id, e.target.value)} />
                        )}
                      </>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11, color: "#bbb", marginTop: 6 }}>
                  Boolean features: Plan default / true / false. Numeric: blank = plan default, number = override limit.
                </div>
              </div>

              {/* ── Teams ── */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em" }}>Teams</div>
                  {!showNewTeam && (
                    <button onClick={() => setShowNewTeam(true)}
                      style={{ fontSize: 12, fontWeight: 600, color: "#1a6bab", background: "none", border: "1px solid #c0d8f0", borderRadius: 6, padding: "2px 9px", cursor: "pointer" }}>
                      + New Team
                    </button>
                  )}
                </div>
                {teams.length === 0 && !showNewTeam && (
                  <div style={{ fontSize: 13, color: "#aaa", marginBottom: 8 }}>No teams yet.</div>
                )}
                {teams.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    {teams.map(t => (
                      <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #f5f5f5" }}>
                        <div style={{ width: 12, height: 12, borderRadius: "50%", background: t.color || "#888", flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: "#111", flex: 1 }}>{t.name}</span>
                        <button
                          onClick={() => navigate(`/orgs/${org.slug}/teams`)}
                          style={{ fontSize: 11, color: "#555", background: "none", border: "1px solid #ddd", borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}>
                          Manage
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {showNewTeam && (
                  <div style={{ background: "#f7f7f7", borderRadius: 10, padding: "12px 14px", border: "1px solid #e8e8e8" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <input
                        style={{ ...inp, flex: 1, minWidth: 120 }}
                        placeholder="Team name"
                        value={newTeamName}
                        onChange={e => setNewTeamName(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleCreateTeam()}
                        autoFocus
                      />
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 24, height: 24, borderRadius: "50%", background: newTeamColor, border: "1px solid #ddd", flexShrink: 0 }} />
                        <input
                          type="color"
                          value={newTeamColor}
                          onChange={e => setNewTeamColor(e.target.value)}
                          style={{ width: 36, height: 28, padding: 2, border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", background: "#fff" }}
                          title="Team color"
                        />
                      </div>
                      <button onClick={handleCreateTeam} disabled={!newTeamName.trim() || creatingTeam}
                        style={{ padding: "6px 14px", fontSize: 13, fontWeight: 600, background: newTeamName.trim() && !creatingTeam ? "#111" : "#ccc", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", flexShrink: 0 }}>
                        {creatingTeam ? "…" : "Create"}
                      </button>
                      <button onClick={() => { setShowNewTeam(false); setNewTeamName(""); setNewTeamColor("#444444"); }}
                        style={{ padding: "6px 10px", fontSize: 13, background: "transparent", border: "1px solid #e0e0e0", borderRadius: 8, cursor: "pointer", color: "#555", flexShrink: 0 }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Create Game ── */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Create Game</div>
                {!showNewGame ? (
                  <button onClick={() => setShowNewGame(true)}
                    style={{ padding: "6px 14px", fontSize: 13, fontWeight: 600, background: "#111", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
                    + New Game in {org.name}
                  </button>
                ) : (
                  <div style={{ background: "#f7f7f7", borderRadius: 10, padding: "12px 14px", border: "1px solid #e8e8e8" }}>
                    <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>Owner — org admin, coach, or scorekeeper</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <select value={gameOwner} onChange={e => setGameOwner(e.target.value)}
                        style={{ ...inp, flex: 1 }}>
                        <option value="">Select member…</option>
                        {members
                          .filter(m => ["org_admin", "coach", "scorekeeper"].includes(m.role))
                          .map(m => <option key={m.user_id} value={m.user_id}>{displayName(m.email)} — {m.role.replace("org_", "")}</option>)
                        }
                      </select>
                      <button onClick={handleCreateGame} disabled={!gameOwner}
                        style={{ padding: "6px 14px", fontSize: 13, fontWeight: 600, background: gameOwner ? "#111" : "#ccc", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", flexShrink: 0 }}>
                        Go to Setup →
                      </button>
                      <button onClick={() => { setShowNewGame(false); setGameOwner(""); }}
                        style={{ padding: "6px 10px", fontSize: 13, background: "transparent", border: "1px solid #e0e0e0", borderRadius: 8, cursor: "pointer", color: "#555", flexShrink: 0 }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Danger zone ── */}
              <div style={{ borderTop: "1px solid #f5f5f5", paddingTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#c0392b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Danger Zone</div>
                {deleteStage === 0 && (
                  <button onClick={() => setDeleteStage(1)} style={{ padding: "6px 14px", fontSize: 13, color: "#c0392b", background: "transparent", border: "1px solid #f0a0a0", borderRadius: 8, cursor: "pointer" }}>Delete org…</button>
                )}
                {deleteStage === 1 && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "#c0392b" }}>Delete <strong>{org.name}</strong> and all its data?</span>
                    <button onClick={() => setDeleteStage(0)} style={{ padding: "5px 12px", fontSize: 12, background: "transparent", border: "1px solid #ddd", borderRadius: 7, cursor: "pointer", color: "#555" }}>Cancel</button>
                    <button onClick={() => setDeleteStage(2)} style={{ padding: "5px 12px", fontSize: 12, color: "#c0392b", background: "transparent", border: "1px solid #e08080", borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>Delete</button>
                  </div>
                )}
                {deleteStage === 2 && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "#c0392b", fontWeight: 600 }}>Cannot be undone. Confirm?</span>
                    <button onClick={() => setDeleteStage(0)} style={{ padding: "5px 12px", fontSize: 12, background: "transparent", border: "1px solid #ddd", borderRadius: 7, cursor: "pointer", color: "#555" }}>Cancel</button>
                    <button onClick={handleDelete} disabled={deleting} style={{ padding: "5px 12px", fontSize: 12, background: "#c0392b", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>{deleting ? "…" : "Yes, delete"}</button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function OrgsTab() {
  const [orgs, setOrgs]       = useState([]);
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  // Create org state
  const [showCreate, setShowCreate]   = useState(false);
  const [newName, setNewName]         = useState("");
  const [newSlug, setNewSlug]         = useState("");
  const [newOwner, setNewOwner]       = useState("");
  const [newPlan, setNewPlan]         = useState("free");
  const [creating, setCreating]       = useState(false);
  const [createError, setCreateError] = useState(null);
  const [slugEdited, setSlugEdited]   = useState(false);

  const inp = { padding: "7px 10px", fontSize: 13, border: "1px solid #e0e0e0", borderRadius: 8, fontFamily: "system-ui, sans-serif", background: "#fff", boxSizing: "border-box" };

  useEffect(() => {
    Promise.all([
      supabase.rpc("admin_get_orgs"),
      supabase.rpc("admin_get_users"),
    ]).then(([orgsRes, usersRes]) => {
      if (orgsRes.error) setError(orgsRes.error.message);
      else setOrgs(orgsRes.data || []);
      setUsers(usersRes.data || []);
      setLoading(false);
    });
  }, []);

  function handleNameChange(val) {
    setNewName(val);
    if (!slugEdited) setNewSlug(slugify(val));
  }

  async function handleCreateOrg(e) {
    e.preventDefault();
    if (!newName.trim() || !newSlug.trim() || !newOwner) return;
    setCreating(true);
    setCreateError(null);

    // Insert org
    const { data: orgRow, error: orgErr } = await supabase
      .from("organizations")
      .insert({ name: newName.trim(), slug: newSlug.trim(), plan: newPlan, plan_status: "active" })
      .select("id, slug, name, plan, plan_status")
      .single();

    if (orgErr) { setCreateError(orgErr.message); setCreating(false); return; }

    // Add owner as org_admin
    const { error: memberErr } = await supabase
      .from("org_members")
      .insert({ org_id: orgRow.id, user_id: newOwner, role: "org_admin" });

    if (memberErr) { setCreateError(memberErr.message); setCreating(false); return; }

    // Reload orgs list to pick up all computed columns
    const { data: fresh } = await supabase.rpc("admin_get_orgs");
    if (fresh) setOrgs(fresh);

    setShowCreate(false);
    setNewName(""); setNewSlug(""); setNewOwner(""); setNewPlan("free"); setSlugEdited(false);
    setCreating(false);
  }

  if (loading) return <div style={{ textAlign: "center", padding: "48px 0", color: "#aaa", fontSize: 14 }}>Loading…</div>;
  if (error)   return <div style={{ background: "#fff5f5", border: "1px solid #fdd", borderRadius: 10, padding: "12px 16px", color: "#c0392b", fontSize: 13 }}>{error}</div>;

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Create org */}
      <div style={{ marginBottom: 16 }}>
        {!showCreate ? (
          <button onClick={() => setShowCreate(true)}
            style={{ padding: "7px 16px", fontSize: 13, fontWeight: 600, background: "#111", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer" }}>
            + Create Org
          </button>
        ) : (
          <div style={{ border: "1px solid #e0e0e0", borderRadius: 14, padding: 16, background: "#fafafa", marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>New Organization</div>
            <form onSubmit={handleCreateOrg}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Name</label>
                  <input style={{ ...inp, width: "100%" }} value={newName}
                    onChange={e => handleNameChange(e.target.value)}
                    placeholder="My League" required />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Slug</label>
                  <input style={{ ...inp, width: "100%", fontFamily: "monospace" }} value={newSlug}
                    onChange={e => { setNewSlug(e.target.value); setSlugEdited(true); }}
                    placeholder="my-league" required pattern="[a-z0-9\-]+" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Owner</label>
                  <select style={{ ...inp, width: "100%" }} value={newOwner} onChange={e => setNewOwner(e.target.value)} required>
                    <option value="">Select user…</option>
                    {users.map(u => <option key={u.id} value={u.id}>{displayName(u.email)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Plan</label>
                  <select style={{ ...inp, width: "100%" }} value={newPlan} onChange={e => setNewPlan(e.target.value)}>
                    {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              {createError && (
                <div style={{ background: "#fff5f5", border: "1px solid #fdd", borderRadius: 8, padding: "8px 12px", color: "#c0392b", fontSize: 12, marginBottom: 10 }}>{createError}</div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => { setShowCreate(false); setCreateError(null); setNewName(""); setNewSlug(""); setNewOwner(""); setSlugEdited(false); }}
                  style={{ padding: "8px 14px", fontSize: 13, background: "transparent", border: "1px solid #e0e0e0", borderRadius: 8, cursor: "pointer", color: "#555" }}>
                  Cancel
                </button>
                <button type="submit" disabled={!newName.trim() || !newSlug.trim() || !newOwner || creating}
                  style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, background: (!newName.trim() || !newSlug.trim() || !newOwner || creating) ? "#ccc" : "#111", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
                  {creating ? "Creating…" : "Create Org"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {orgs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#aaa", fontSize: 14 }}>No organizations yet.</div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: "#aaa", marginBottom: 12 }}>{orgs.length} org{orgs.length !== 1 ? "s" : ""}</div>
          {orgs.map(org => (
            <OrgCard
              key={org.id}
              org={org}
              users={users}
              onUpdated={updated => setOrgs(prev => prev.map(o => o.id === updated.id ? { ...o, ...updated } : o))}
              onDeleted={id => setOrgs(prev => prev.filter(o => o.id !== id))}
            />
          ))}
        </>
      )}
    </div>
  );
}

// ── Migration Tab ─────────────────────────────────────────────────────────────
function MigrationTab() {
  const [running, setRunning]   = useState(false);
  const [result,  setResult]    = useState(null);
  const [error,   setError]     = useState(null);

  async function run(dryRun) {
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/migrate_v1_games`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ dry_run: dryRun }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }

  const btnBase = { padding: "10px 20px", fontSize: 14, fontWeight: 700, border: "none", borderRadius: 10, cursor: "pointer" };

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 20, marginBottom: 16, border: "1px solid #e8e8e8" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#111", marginBottom: 6 }}>v1 → v2 Game Migration</div>
        <div style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>
          Translates JSONB <code>state.log</code> from all <code>schema_ver=1</code> games into normalized <code>game_events</code> rows.
          Verifies goal counts before committing. Idempotent — already-migrated games are skipped.
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={{ ...btnBase, background: "#f0f0f0", color: "#555" }} onClick={() => run(true)} disabled={running}>
            {running ? "Running…" : "Dry Run"}
          </button>
          <button style={{ ...btnBase, background: "#111", color: "#fff" }} onClick={() => run(false)} disabled={running}>
            {running ? "Migrating…" : "Run Migration"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "#fff5f5", border: "1px solid #fdd", borderRadius: 10, padding: "12px 16px", color: "#c0392b", fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #f0f0f0", display: "flex", gap: 24 }}>
            {result.dry_run && <span style={{ fontSize: 11, fontWeight: 700, color: "#d4820a", background: "rgba(212,130,10,0.1)", borderRadius: 6, padding: "2px 8px", letterSpacing: "0.06em" }}>DRY RUN</span>}
            <span style={{ fontSize: 13, color: "#2a7a3b", fontWeight: 600 }}>✓ {result.migrated} migrated</span>
            <span style={{ fontSize: 13, color: "#888" }}>{result.skipped} skipped</span>
            {result.errors > 0 && <span style={{ fontSize: 13, color: "#c0392b", fontWeight: 600 }}>✗ {result.errors} errors</span>}
            <span style={{ fontSize: 13, color: "#bbb" }}>{result.total} total</span>
          </div>
          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {result.details.map((d, i) => (
              <div key={i} style={{ padding: "10px 18px", borderBottom: "1px solid #f8f8f8", display: "flex", gap: 10, alignItems: "baseline" }}>
                <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 4, padding: "1px 6px",
                  color: d.status === "migrated" || d.status === "dry_run" ? "#2a7a3b" : d.status === "skipped" ? "#888" : "#c0392b",
                  background: d.status === "migrated" || d.status === "dry_run" ? "#eaf6ec" : d.status === "skipped" ? "#f5f5f5" : "#fff5f5",
                }}>{d.status}</span>
                <span style={{ fontSize: 13, color: "#111", flex: 1 }}>{d.name || d.game_id}</span>
                {d.events != null && <span style={{ fontSize: 12, color: "#aaa" }}>{d.events} events</span>}
                {d.error && <span style={{ fontSize: 12, color: "#c0392b" }}>{d.error}</span>}
                {d.reason && <span style={{ fontSize: 12, color: "#aaa" }}>{d.reason}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Admin Page ────────────────────────────────────────────────────────────────
export default function Admin() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState("games");

  // Redirect non-admins away
  if (!isAdmin) {
    navigate("/");
    return null;
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", minHeight: "100%", background: "#f5f5f5" }}>
      {/* Sticky header + tabs */}
      <div style={{ position: "sticky", top: 0, zIndex: 10 }}>
        {/* Header */}
        <div style={{ background: "#111", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={() => navigate("/")} style={{
            background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 13,
            fontWeight: 500, cursor: "pointer", padding: 0, fontFamily: "system-ui, sans-serif",
          }}>← Games</button>
          <span style={{ fontSize: 17, fontWeight: 700, color: "#fff", flex: 1 }}>Admin</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#d4820a", background: "rgba(212,130,10,0.2)", borderRadius: 6, padding: "3px 8px", letterSpacing: "0.08em", textTransform: "uppercase" }}>Admin</span>
        </div>

        {/* Tabs */}
        <div style={{ background: "#fff" }}>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 16px" }}>
        <div style={{ display: "flex", gap: 4, padding: "12px 0 0", marginBottom: 0, borderBottom: "1px solid #e8e8e8" }}>
          {[["games", "All Games"], ["users", "Users"], ["rosters", "Rosters"], ["orgs", "Orgs"], ["migration", "Migration"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: "8px 18px", fontSize: 14, fontWeight: tab === id ? 700 : 500,
              border: "none", background: "transparent", cursor: "pointer",
              color: tab === id ? "#111" : "#aaa",
              borderBottom: tab === id ? "2px solid #111" : "2px solid transparent",
              marginBottom: -1,
            }}>{label}</button>
          ))}
        </div>
        </div>
        </div>
      </div>

      {/* Tab content */}
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "16px 16px 32px" }}>
        {tab === "games"     && <AllGamesTab />}
        {tab === "users"     && <UsersTab />}
        {tab === "rosters"   && <RostersAdminTab />}
        {tab === "orgs"      && <OrgsTab />}
        {tab === "migration" && <MigrationTab />}
      </div>
    </div>
  );
}
