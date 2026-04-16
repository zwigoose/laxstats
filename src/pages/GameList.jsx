import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const PRESET_COLORS = ["#1a6bab","#b84e1a","#2a7a3b","#8b1a8b","#c0392b","#d4820a","#1a7a7a","#555","#1a2e8b","#8b3a1a"];

const S = {
  page: { fontFamily: "system-ui, sans-serif", maxWidth: 600, margin: "0 auto", padding: "24px 16px 40px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 600, margin: 0 },
  tabs: { display: "flex", borderBottom: "2px solid #e5e5e5", marginBottom: 20 },
  tab: (active) => ({ padding: "8px 18px", fontSize: 14, fontWeight: 500, border: "none", background: "transparent", cursor: "pointer", color: active ? "#111" : "#888", borderBottom: active ? "2px solid #111" : "2px solid transparent", marginBottom: -2 }),
  newBtn: { padding: "10px 18px", fontSize: 14, fontWeight: 500, background: "#111", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer" },

  // Games list
  list: { listStyle: "none", padding: 0, margin: 0 },
  item: { border: "1px solid #e5e5e5", borderRadius: 12, marginBottom: 10, overflow: "hidden" },
  itemRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "#fff" },
  itemLeft: { display: "flex", flexDirection: "column", gap: 3, minWidth: 0 },
  itemName: { fontSize: 15, fontWeight: 500, color: "#111" },
  itemDate: { fontSize: 12, color: "#888" },
  itemActions: { display: "flex", gap: 8, flexShrink: 0, marginLeft: 12 },
  viewBtn: { padding: "6px 12px", fontSize: 12, fontWeight: 500, background: "transparent", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", color: "#555" },
  scoreBtn: { padding: "6px 12px", fontSize: 12, fontWeight: 500, background: "#111", border: "none", borderRadius: 8, cursor: "pointer", color: "#fff" },
  deleteBtn: { padding: "6px 10px", fontSize: 12, fontWeight: 500, background: "transparent", border: "1px solid #f0a0a0", borderRadius: 8, cursor: "pointer", color: "#c0392b" },

  // Delete confirm strips
  confirmStrip1: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: "#fff5f5", borderTop: "1px solid #f0d0d0" },
  confirmStrip2: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: "#fef0f0", borderTop: "1px solid #e8a0a0" },
  confirmText: { fontSize: 13, color: "#c0392b", fontWeight: 500 },
  confirmCancel: { padding: "5px 12px", fontSize: 12, background: "transparent", border: "1px solid #ddd", borderRadius: 7, cursor: "pointer", color: "#555" },
  confirmDelete1: { padding: "5px 12px", fontSize: 12, background: "transparent", border: "1px solid #e08080", borderRadius: 7, cursor: "pointer", color: "#c0392b", fontWeight: 500 },
  confirmDelete2: { padding: "5px 12px", fontSize: 12, background: "#c0392b", border: "none", borderRadius: 7, cursor: "pointer", color: "#fff", fontWeight: 500 },

  empty: { textAlign: "center", padding: "60px 20px", color: "#aaa", fontSize: 14 },
  error: { background: "#fff5f5", border: "1px solid #f0a0a0", borderRadius: 8, padding: "12px 16px", color: "#c0392b", fontSize: 13, marginBottom: 16 },
  loading: { textAlign: "center", padding: "40px 20px", color: "#aaa", fontSize: 14 },

  // Roster manager
  rosterList: { listStyle: "none", padding: 0, margin: 0 },
  rosterItem: { border: "1px solid #e5e5e5", borderRadius: 12, marginBottom: 10, overflow: "hidden" },
  rosterItemRow: { display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", background: "#fff", cursor: "pointer" },
  colorDot: (c) => ({ width: 12, height: 12, borderRadius: "50%", background: c, flexShrink: 0 }),
  rosterName: { fontSize: 15, fontWeight: 500, color: "#111", flex: 1 },
  rosterMeta: { fontSize: 12, color: "#888" },
  rosterChevron: (open) => ({ fontSize: 12, color: "#aaa", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }),
  rosterEditBody: { padding: "0 16px 16px", background: "#fafafa", borderTop: "1px solid #e5e5e5" },
  label: { fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, marginTop: 14, display: "block" },
  textInput: { width: "100%", padding: "8px 10px", fontSize: 15, fontWeight: 500, border: "1px solid #ddd", borderRadius: 8, background: "#fff", marginBottom: 0, boxSizing: "border-box" },
  textarea: { width: "100%", height: 140, padding: 10, fontSize: 13, fontFamily: "monospace", border: "1px solid #ddd", borderRadius: 8, background: "#fff", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box" },
  hint: { fontSize: 11, color: "#aaa", marginTop: 5 },
  colorRow: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  colorSwatch: (c, sel) => ({ width: 24, height: 24, borderRadius: "50%", background: c, border: sel ? "3px solid #111" : "2px solid #e5e5e5", cursor: "pointer", flexShrink: 0, boxSizing: "border-box" }),
  colorPickerInput: { width: 30, height: 24, border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", padding: 2 },
  rosterActions: { display: "flex", gap: 8, marginTop: 14 },
  saveRosterBtn: (disabled) => ({ flex: 1, padding: "10px", fontSize: 14, fontWeight: 500, background: disabled ? "#ccc" : "#111", color: "#fff", border: "none", borderRadius: 9, cursor: disabled ? "not-allowed" : "pointer" }),
  deleteRosterBtn: { padding: "10px 16px", fontSize: 14, fontWeight: 500, background: "transparent", border: "1px solid #f0a0a0", borderRadius: 9, cursor: "pointer", color: "#c0392b" },
  deleteRosterConfirmBtn: { padding: "10px 16px", fontSize: 14, fontWeight: 500, background: "#c0392b", border: "none", borderRadius: 9, cursor: "pointer", color: "#fff" },

  // New roster form (inline card)
  newRosterCard: { border: "1px solid #e5e5e5", borderRadius: 12, padding: "16px", marginBottom: 10, background: "#fafafa" },
  newRosterTitle: { fontSize: 14, fontWeight: 600, color: "#111", marginBottom: 12 },
};

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function playerCount(roster) {
  if (!roster) return 0;
  return roster.split("\n").map(l => l.trim()).filter(Boolean).length;
}

// ── Games Tab ────────────────────────────────────────────────────────────────
function GamesTab() {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  // deleteStage: { id, stage: 1 | 2 }
  const [deleteStage, setDeleteStage] = useState(null);

  useEffect(() => { loadGames(); }, []);

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
      .from("games").insert({ name, state: null }).select().single();
    setCreating(false);
    if (err) { setError(err.message); return; }
    navigate(`/games/${data.id}/score`);
  }

  async function handleDeleteConfirmed(id) {
    const { error: err } = await supabase.from("games").delete().eq("id", id);
    if (err) { setError(err.message); }
    else { setGames(prev => prev.filter(g => g.id !== id)); }
    setDeleteStage(null);
  }

  function getScore(game) {
    if (!game.state?.log) return null;
    const { log, teams } = game.state;
    const s0 = log.filter(e => e.event === "goal" && e.teamIdx === 0).length;
    const s1 = log.filter(e => e.event === "goal" && e.teamIdx === 1).length;
    return `${teams?.[0]?.name || "Home"} ${s0} – ${s1} ${teams?.[1]?.name || "Away"}`;
  }

  return (
    <div>
      <div style={S.header}>
        <h1 style={S.title}>Games</h1>
        <button style={S.newBtn} onClick={handleNewGame} disabled={creating}>
          {creating ? "Creating…" : "+ New Game"}
        </button>
      </div>

      {error && <div style={S.error}>{error}</div>}

      {loading ? (
        <div style={S.loading}>Loading…</div>
      ) : games.length === 0 ? (
        <div style={S.empty}>No games yet. Hit "+ New Game" to get started.</div>
      ) : (
        <ul style={S.list}>
          {games.map(game => {
            const stage = deleteStage?.id === game.id ? deleteStage.stage : 0;
            return (
              <li key={game.id} style={S.item}>
                <div style={S.itemRow}>
                  <div style={S.itemLeft}>
                    <span style={S.itemName}>{game.name}</span>
                    <span style={S.itemDate}>
                      {formatDate(game.created_at)}
                      {getScore(game) && ` · ${getScore(game)}`}
                    </span>
                  </div>
                  <div style={S.itemActions}>
                    <button style={S.viewBtn} onClick={() => navigate(`/games/${game.id}/view`)}>View</button>
                    <button style={S.scoreBtn} onClick={() => navigate(`/games/${game.id}/score`)}>Score</button>
                    <button style={S.deleteBtn}
                      onClick={() => setDeleteStage(stage === 0 ? { id: game.id, stage: 1 } : null)}>
                      🗑
                    </button>
                  </div>
                </div>

                {stage === 1 && (
                  <div style={S.confirmStrip1}>
                    <span style={S.confirmText}>Delete this game?</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={S.confirmCancel} onClick={() => setDeleteStage(null)}>Cancel</button>
                      <button style={S.confirmDelete1} onClick={() => setDeleteStage({ id: game.id, stage: 2 })}>Delete</button>
                    </div>
                  </div>
                )}

                {stage === 2 && (
                  <div style={S.confirmStrip2}>
                    <span style={S.confirmText}>Permanently delete? This cannot be undone.</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={S.confirmCancel} onClick={() => setDeleteStage(null)}>Cancel</button>
                      <button style={S.confirmDelete2} onClick={() => handleDeleteConfirmed(game.id)}>Yes, delete</button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Roster Editor (shared between new and existing) ───────────────────────────
function RosterEditor({ initial, onSave, onDelete, onCancel, isNew }) {
  const [name, setName] = useState(initial?.name || "");
  const [roster, setRoster] = useState(initial?.roster || "");
  const [color, setColor] = useState(initial?.color || PRESET_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ name: name.trim(), roster, color });
    setSaving(false);
  }

  return (
    <div>
      <span style={S.label}>Team name</span>
      <input style={S.textInput} value={name} onChange={e => setName(e.target.value)} placeholder="Team name" />

      <span style={S.label}>Color</span>
      <div style={S.colorRow}>
        {PRESET_COLORS.map(c => (
          <div key={c} style={S.colorSwatch(c, color === c)} onClick={() => setColor(c)} />
        ))}
        <input type="color" style={S.colorPickerInput} value={color} onChange={e => setColor(e.target.value)} />
      </div>

      <span style={S.label}>Roster</span>
      <textarea style={S.textarea} value={roster}
        onChange={e => setRoster(e.target.value)}
        placeholder={"#2 First Last\n#7 First Last\n#11 First Last"} />
      <div style={S.hint}>One player per line — #number Name</div>

      <div style={S.rosterActions}>
        {!isNew && !confirmDelete && (
          <button style={S.deleteRosterBtn} onClick={() => setConfirmDelete(true)}>Delete</button>
        )}
        {!isNew && confirmDelete && (
          <button style={S.deleteRosterConfirmBtn} onClick={onDelete}>Confirm delete</button>
        )}
        {onCancel && (
          <button style={{ ...S.deleteRosterBtn, border: "1px solid #ddd", color: "#555" }} onClick={onCancel}>Cancel</button>
        )}
        <button style={{ ...S.saveRosterBtn(!name.trim() || saving), marginLeft: "auto" }}
          disabled={!name.trim() || saving} onClick={handleSave}>
          {saving ? "Saving…" : isNew ? "Save team" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

// ── Rosters Tab ───────────────────────────────────────────────────────────────
function RostersTab() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => { loadTeams(); }, []);

  async function loadTeams() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("saved_teams")
      .select("id, name, roster, color")
      .order("name");
    if (err) setError(err.message);
    else setTeams(data || []);
    setLoading(false);
  }

  async function handleCreate(fields) {
    const { data, error: err } = await supabase
      .from("saved_teams").insert(fields).select().single();
    if (err) { setError(err.message); return; }
    setTeams(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setShowNew(false);
  }

  async function handleUpdate(id, fields) {
    const { error: err } = await supabase
      .from("saved_teams").update(fields).eq("id", id);
    if (err) { setError(err.message); return; }
    setTeams(prev => prev.map(t => t.id === id ? { ...t, ...fields } : t)
      .sort((a, b) => a.name.localeCompare(b.name)));
    setExpandedId(null);
  }

  async function handleDelete(id) {
    const { error: err } = await supabase
      .from("saved_teams").delete().eq("id", id);
    if (err) { setError(err.message); return; }
    setTeams(prev => prev.filter(t => t.id !== id));
    setExpandedId(null);
  }

  return (
    <div>
      <div style={S.header}>
        <h1 style={S.title}>Rosters</h1>
        <button style={S.newBtn} onClick={() => { setShowNew(true); setExpandedId(null); }}>
          + New Team
        </button>
      </div>

      {error && <div style={S.error}>{error}</div>}

      {showNew && (
        <div style={S.newRosterCard}>
          <div style={S.newRosterTitle}>New saved team</div>
          <RosterEditor isNew onSave={handleCreate} onCancel={() => setShowNew(false)} />
        </div>
      )}

      {loading ? (
        <div style={S.loading}>Loading…</div>
      ) : teams.length === 0 && !showNew ? (
        <div style={S.empty}>No saved teams yet. Hit "+ New Team" to create one.</div>
      ) : (
        <ul style={S.rosterList}>
          {teams.map(team => {
            const open = expandedId === team.id;
            return (
              <li key={team.id} style={S.rosterItem}>
                <div style={S.rosterItemRow} onClick={() => setExpandedId(open ? null : team.id)}>
                  <div style={S.colorDot(team.color)} />
                  <span style={S.rosterName}>{team.name}</span>
                  <span style={S.rosterMeta}>{playerCount(team.roster)} players</span>
                  <span style={S.rosterChevron(open)}>›</span>
                </div>
                {open && (
                  <div style={S.rosterEditBody}>
                    <RosterEditor
                      initial={team}
                      onSave={(fields) => handleUpdate(team.id, fields)}
                      onDelete={() => handleDelete(team.id)}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Root ─────────────────────────────────────────────────────────────────────
export default function GameList() {
  const [tab, setTab] = useState("games");

  return (
    <div style={S.page}>
      <div style={S.tabs}>
        <button style={S.tab(tab === "games")} onClick={() => setTab("games")}>Games</button>
        <button style={S.tab(tab === "rosters")} onClick={() => setTab("rosters")}>Rosters</button>
      </div>
      {tab === "games" ? <GamesTab /> : <RostersTab />}
    </div>
  );
}
