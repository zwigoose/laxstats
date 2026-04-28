import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { getGameInfo } from "../../utils/game";
import { displayName } from "./helpers";
import AdminGameRow from "./AdminGameRow";
import OrgGameGroup from "./OrgGameGroup";
import SectionToggle from "./SectionToggle";

export default function AllGamesTab() {
  const navigate = useNavigate();
  const [games, setGames]     = useState([]);
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [showPersonalPending, setShowPersonalPending] = useState(false);
  const [showPersonalFinal, setShowPersonalFinal]     = useState(false);
  const [showCreateGame, setShowCreateGame]           = useState(false);
  const [createForUserId, setCreateForUserId]         = useState("");
  const [creating, setCreating]                       = useState(false);

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
    setLoading(true); setError(null);
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
  if (error)   return <div style={{ background: "#fff5f5", border: "1px solid #fdd", borderRadius: 10, padding: "12px 16px", color: "#c0392b", fontSize: 13, marginBottom: 16 }}>{error}</div>;

  return (
    <div>
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
