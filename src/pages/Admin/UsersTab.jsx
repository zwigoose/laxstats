import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { qLabel } from "../../utils/stats";
import { formatDate, getGameInfo } from "../../utils/game";
import { displayName, toEmail, makeTempClient } from "./helpers";

export default function UsersTab() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers]     = useState([]);
  const [games, setGames]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [expandedId, setExpandedId]   = useState(null);
  const [togglingId, setTogglingId]   = useState(null);
  const [deleteStages, setDeleteStages] = useState({});

  const [showCreate, setShowCreate]   = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating]       = useState(false);
  const [createError, setCreateError] = useState(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true); setError(null);
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
    setCreateError(null); setCreating(true);
    const email = toEmail(newUsername);
    const tempClient = makeTempClient();
    const { data, error: err } = await tempClient.auth.signUp({ email, password: newPassword });
    if (err) {
      setCreateError(err.message);
    } else if (data?.user) {
      setShowCreate(false); setNewUsername(""); setNewPassword("");
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
  if (error)   return <div style={{ background: "#fff5f5", border: "1px solid #fdd", borderRadius: 10, padding: "12px 16px", color: "#c0392b", fontSize: 13, marginBottom: 16 }}>{error}</div>;

  const inputStyle = { width: "100%", padding: "8px 10px", fontSize: 14, border: "1px solid #e0e0e0", borderRadius: 8, background: "#fff", boxSizing: "border-box", fontFamily: "system-ui, sans-serif" };

  return (
    <div>
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
                  style={{ padding: "8px 14px", fontSize: 13, background: "transparent", border: "1px solid #e0e0e0", borderRadius: 8, cursor: "pointer", color: "#555" }}>Cancel</button>
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
                    <button disabled={togglingId === u.id}
                      onClick={e => { e.stopPropagation(); toggleAdmin(u.id, u.is_admin); }}
                      style={{ padding: "5px 11px", fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: "pointer", border: "1px solid", flexShrink: 0,
                        background: u.is_admin ? "#fff8ec" : "#f5f5f5", color: u.is_admin ? "#d4820a" : "#555", borderColor: u.is_admin ? "#f0d080" : "#ddd" }}>
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
