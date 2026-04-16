import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const S = {
  page: { fontFamily: "system-ui, sans-serif", maxWidth: 600, margin: "0 auto", padding: "24px 16px 40px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  title: { fontSize: 22, fontWeight: 600, margin: 0 },
  newBtn: { padding: "10px 18px", fontSize: 14, fontWeight: 500, background: "#111", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer" },
  list: { listStyle: "none", padding: 0, margin: 0 },
  item: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", border: "1px solid #e5e5e5", borderRadius: 12, marginBottom: 10, cursor: "pointer", background: "#fff", transition: "background 0.15s" },
  itemLeft: { display: "flex", flexDirection: "column", gap: 3 },
  itemName: { fontSize: 15, fontWeight: 500, color: "#111" },
  itemDate: { fontSize: 12, color: "#888" },
  itemActions: { display: "flex", gap: 8 },
  viewBtn: { padding: "6px 12px", fontSize: 12, fontWeight: 500, background: "transparent", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", color: "#555" },
  scoreBtn: { padding: "6px 12px", fontSize: 12, fontWeight: 500, background: "#111", border: "none", borderRadius: 8, cursor: "pointer", color: "#fff" },
  empty: { textAlign: "center", padding: "60px 20px", color: "#aaa", fontSize: 14 },
  error: { background: "#fff5f5", border: "1px solid #f0a0a0", borderRadius: 8, padding: "12px 16px", color: "#c0392b", fontSize: 13, marginBottom: 16 },
  loading: { textAlign: "center", padding: "40px 20px", color: "#aaa", fontSize: 14 },
};

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export default function GameList() {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadGames();
  }, []);

  async function loadGames() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("games")
      .select("id, created_at, name, state")
      .order("created_at", { ascending: false });
    if (err) setError(err.message);
    else setGames(data || []);
    setLoading(false);
  }

  async function handleNewGame() {
    setCreating(true);
    setError(null);
    const name = `Game — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    const { data, error: err } = await supabase
      .from("games")
      .insert({ name, state: null })
      .select()
      .single();
    setCreating(false);
    if (err) { setError(err.message); return; }
    navigate(`/games/${data.id}/score`);
  }

  function getScore(game) {
    if (!game.state?.log) return null;
    const log = game.state.log;
    const teams = game.state.teams;
    const s0 = log.filter(e => e.event === "goal" && e.teamIdx === 0).length;
    const s1 = log.filter(e => e.event === "goal" && e.teamIdx === 1).length;
    const t0 = teams?.[0]?.name || "Home";
    const t1 = teams?.[1]?.name || "Away";
    return `${t0} ${s0} – ${s1} ${t1}`;
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>NDPBLAX Games</h1>
        <button style={S.newBtn} onClick={handleNewGame} disabled={creating}>
          {creating ? "Creating…" : "+ New Game"}
        </button>
      </div>

      {error && <div style={S.error}>{error}</div>}

      {loading ? (
        <div style={S.loading}>Loading games…</div>
      ) : games.length === 0 ? (
        <div style={S.empty}>No games yet. Hit "New Game" to get started.</div>
      ) : (
        <ul style={S.list}>
          {games.map(game => (
            <li key={game.id} style={S.item}>
              <div style={S.itemLeft}>
                <span style={S.itemName}>{game.name}</span>
                <span style={S.itemDate}>
                  {formatDate(game.created_at)}
                  {getScore(game) && ` · ${getScore(game)}`}
                </span>
              </div>
              <div style={S.itemActions}>
                <button style={S.viewBtn} onClick={() => navigate(`/games/${game.id}/view`)}>
                  View
                </button>
                <button style={S.scoreBtn} onClick={() => navigate(`/games/${game.id}/score`)}>
                  Score
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
