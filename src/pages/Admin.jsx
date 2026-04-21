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
function AdminGameRow({ game, userMap, users, onReassigned }) {
  const navigate = useNavigate();
  const info = getGameInfo(game);
  const owner = userMap[game.user_id];
  const c0 = info?.t0?.color || "#444";
  const c1 = info?.t1?.color || "#888";
  const [adminOpen, setAdminOpen] = useState(false);
  const [newOwnerId, setNewOwnerId] = useState(game.user_id || "");
  const [reassigning, setReassigning] = useState(false);
  const [reassignError, setReassignError] = useState(null);

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
            <span style={{ fontSize: 11, color: "#ccc" }}>{formatDate(game.created_at)}</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={{ padding: "5px 10px", fontSize: 12, fontWeight: 500, background: "transparent", border: "1px solid #ddd", borderRadius: 7, cursor: "pointer", color: "#555" }}
              onClick={() => navigate(`/games/${game.id}/view`)}>View</button>
            <button style={{ padding: "5px 12px", fontSize: 12, fontWeight: 600, background: "#111", border: "none", borderRadius: 7, cursor: "pointer", color: "#fff" }}
              onClick={() => navigate(`/games/${game.id}/score`)}>{info?.started ? "Score" : "Setup"}</button>
            <button title="Reassign owner" style={{ padding: "5px 9px", fontSize: 12, background: adminOpen ? "#f0f0f0" : "transparent", border: "1px solid #ddd", borderRadius: 7, cursor: "pointer", color: "#888" }}
              onClick={() => setAdminOpen(v => !v)}>⚙</button>
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
        </div>
      )}
    </div>
  );
}

// ── All Games Tab ─────────────────────────────────────────────────────────────
function AllGamesTab() {
  const [games, setGames] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPending, setShowPending] = useState(false);
  const [showFinal, setShowFinal] = useState(false);
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
      supabase.from("games").select("id, name, created_at, state, user_id").order("created_at", { ascending: false }),
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

  const liveGames    = games.filter(g => { const i = getGameInfo(g); return i?.started && !i?.gameOver; });
  const pendingGames = games.filter(g => { const i = getGameInfo(g); return !i?.started; });
  const finalGames   = games.filter(g => { const i = getGameInfo(g); return i?.gameOver; });

  async function handleCreateGame() {
    if (!createForUserId) return;
    setCreating(true);
    const name = `Game — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    const { data: gameId, error: err } = await supabase.rpc("admin_create_game", { p_user_id: createForUserId, p_name: name });
    if (err) { setError(err.message); setCreating(false); return; }
    const { data: gameData } = await supabase.from("games").select("id, name, created_at, state, user_id").eq("id", gameId).single();
    if (gameData) setGames(prev => [gameData, ...prev]);
    setShowCreateGame(false);
    setCreateForUserId("");
    setCreating(false);
  }

  function handleGameReassigned(gameId, newUserId) {
    setGames(prev => prev.map(g => g.id === gameId ? { ...g, user_id: newUserId } : g));
  }

  function SectionToggle({ label, count, open, onToggle }) {
    if (count === 0) return null;
    return (
      <button onClick={onToggle} style={{
        width: "100%", padding: "10px 14px", marginTop: 4, marginBottom: open ? 10 : 4,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "#f5f5f5", border: "1px solid #e8e8e8", borderRadius: 10,
        cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#555",
      }}>
        <span>{count} {label}{count !== 1 ? "s" : ""}</span>
        <span style={{ fontSize: 12, color: "#aaa", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s", display: "inline-block" }}>›</span>
      </button>
    );
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
      {liveGames.length === 0 && games.length > 0 && (
        <div style={{ textAlign: "center", padding: "24px 0 12px", color: "#aaa", fontSize: 14 }}>No live games.</div>
      )}
      {liveGames.map(game => <AdminGameRow key={game.id} game={game} userMap={userMap} users={users} onReassigned={handleGameReassigned} />)}

      <SectionToggle label="pending game" count={pendingGames.length} open={showPending} onToggle={() => setShowPending(v => !v)} />
      {showPending && pendingGames.map(game => <AdminGameRow key={game.id} game={game} userMap={userMap} users={users} onReassigned={handleGameReassigned} />)}

      <SectionToggle label="completed game" count={finalGames.length} open={showFinal} onToggle={() => setShowFinal(v => !v)} />
      {showFinal && finalGames.map(game => <AdminGameRow key={game.id} game={game} userMap={userMap} users={users} onReassigned={handleGameReassigned} />)}
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
      supabase.from("games").select("id, name, created_at, state, user_id").order("created_at", { ascending: false }),
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
                            <SharePanel rosterId={r.id} />
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
    <div style={{ fontFamily: "system-ui, sans-serif", minHeight: "100vh", background: "#f5f5f5" }}>
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
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 16px" }}>
        <div style={{ display: "flex", gap: 4, padding: "12px 0 0", marginBottom: 16, borderBottom: "1px solid #e8e8e8" }}>
          {[["games", "All Games"], ["users", "Users"], ["rosters", "Rosters"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: "8px 18px", fontSize: 14, fontWeight: tab === id ? 700 : 500,
              border: "none", background: "transparent", cursor: "pointer",
              color: tab === id ? "#111" : "#aaa",
              borderBottom: tab === id ? "2px solid #111" : "2px solid transparent",
              marginBottom: -1,
            }}>{label}</button>
          ))}
        </div>

        {tab === "games" && <AllGamesTab />}
        {tab === "users" && <UsersTab />}
        {tab === "rosters" && <RostersAdminTab />}
      </div>
    </div>
  );
}
