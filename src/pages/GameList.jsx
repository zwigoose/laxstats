import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { qLabel } from "../components/LaxStats";

const PRESET_COLORS = ["#1a6bab","#b84e1a","#2a7a3b","#8b1a8b","#c0392b","#d4820a","#1a7a7a","#555","#1a2e8b","#8b3a1a"];

// ── Men's lacrosse field SVG (110yd × 60yd) ──────────────────────────────────
// Scale: 820px / 110yd = 7.45 px/yd (H), 420px / 60yd = 7.0 px/yd (V)
// Key positions (from left end line):
//   Goal line: 15yd → x=142    Restraining line: 35yd → x=291
//   Center: x=440              Mirror right: x=589 / x=738
// Wing hash marks: 10yd from each sideline at center line → y=100, y=380
const FIELD_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 880 480'>
  <!-- Field boundary -->
  <rect x='30' y='30' width='820' height='420' fill='none' stroke='rgba(255,255,255,0.22)' stroke-width='2'/>

  <!-- Center line -->
  <line x1='440' y1='30' x2='440' y2='450' stroke='rgba(255,255,255,0.22)' stroke-width='2'/>

  <!-- Restraining lines (attack/defense area, 35yd from each end) -->
  <line x1='291' y1='30' x2='291' y2='450' stroke='rgba(255,255,255,0.16)' stroke-width='1.5'/>
  <line x1='589' y1='30' x2='589' y2='450' stroke='rgba(255,255,255,0.16)' stroke-width='1.5'/>

  <!-- Goal lines (15yd from each end) -->
  <line x1='142' y1='30' x2='142' y2='450' stroke='rgba(255,255,255,0.13)' stroke-width='1.5'/>
  <line x1='738' y1='30' x2='738' y2='450' stroke='rgba(255,255,255,0.13)' stroke-width='1.5'/>

  <!-- Crease circles — full circles, 9ft radius (men's field, NOT a shooting arc) -->
  <circle cx='142' cy='240' r='32' fill='none' stroke='rgba(255,255,255,0.22)' stroke-width='2'/>
  <circle cx='738' cy='240' r='32' fill='none' stroke='rgba(255,255,255,0.22)' stroke-width='2'/>

  <!-- Face-off X at center (replaces circle) -->
  <line x1='430' y1='230' x2='450' y2='250' stroke='rgba(255,255,255,0.22)' stroke-width='2' stroke-linecap='round'/>
  <line x1='450' y1='230' x2='430' y2='250' stroke='rgba(255,255,255,0.22)' stroke-width='2' stroke-linecap='round'/>

  <!-- Wing hash marks at midfield: 10yd from each sideline, 5yd long toward center -->
  <line x1='440' y1='100' x2='440' y2='135' stroke='rgba(255,255,255,0.14)' stroke-width='2'/>
  <line x1='440' y1='380' x2='440' y2='345' stroke='rgba(255,255,255,0.14)' stroke-width='2'/>

  <!-- Goals: triangular frame viewed from above, apex points toward near end line -->
  <!-- Left goal: mouth on goal line (x=142), apex aims left toward end line -->
  <polygon points='142,233 142,247 125,240' fill='none' stroke='rgba(255,255,255,0.35)' stroke-width='2.5' stroke-linejoin='round'/>
  <!-- Right goal: mouth on goal line (x=738), apex aims right toward end line -->
  <polygon points='738,233 738,247 755,240' fill='none' stroke='rgba(255,255,255,0.35)' stroke-width='2.5' stroke-linejoin='round'/>
</svg>`;
const FIELD_BG = `url("data:image/svg+xml,${encodeURIComponent(FIELD_SVG)}")`;

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function formatDateTime(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
function playerCount(roster) {
  if (!roster) return 0;
  return roster.split("\n").map(l => l.trim()).filter(Boolean).length;
}

function findDuplicateNums(rosterText) {
  if (!rosterText) return [];
  const lines = rosterText.split("\n").map(l => l.trim()).filter(Boolean);
  const nums = lines.map(line => { const m = line.match(/^#?(\d+)/); return m ? m[1] : null; }).filter(Boolean);
  const seen = new Set(), dupes = new Set();
  nums.forEach(n => { if (seen.has(n)) dupes.add(`#${n}`); else seen.add(n); });
  return [...dupes];
}
function getLatestTime(state) {
  if (!state?.log || !state.currentQuarter) return null;
  const q = state.currentQuarter;
  const toS = t => { const [m, s] = t.split(":").map(Number); return m * 60 + s; };
  const timed = (state.log || [])
    .filter(e => e.quarter === q && (e.goalTime || e.timeoutTime))
    .map(e => ({ str: e.goalTime || e.timeoutTime, secs: toS(e.goalTime || e.timeoutTime) }));
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
  const latestTime = getLatestTime(s);
  const currentQuarter = s.currentQuarter || 1;
  return { t0, t1, score0, score1, gameOver: s.gameOver, started, latestTime, currentQuarter };
}

// ── Game Card ─────────────────────────────────────────────────────────────────
function GameCard({ game, onDelete, deleteStage, onDeleteStage }) {
  const navigate = useNavigate();
  const info = getGameInfo(game);
  const c0 = info?.t0?.color || "#444";
  const c1 = info?.t1?.color || "#888";

  return (
    <div style={{ borderRadius: 16, overflow: "hidden", marginBottom: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", border: "1px solid #e8e8e8", background: "#fff" }}>
      {/* Color bar */}
      <div style={{ height: 5, background: info ? `linear-gradient(90deg, ${c0} 50%, ${c1} 50%)` : "#e0e0e0" }} />

      {/* Main content */}
      <div style={{ padding: "14px 16px 12px" }}>
        {info ? (
          /* Game with state — show scoreboard */
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, marginBottom: 8 }}>
              {/* Team 0 */}
              <div>
                <div style={{ fontSize: 30, fontWeight: 700, color: c0, lineHeight: 1 }}>
                  {info.t0.name}
                </div>
              </div>
              {/* Score */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                <span style={{ fontSize: 30, fontWeight: 700, color: info.score0 >= info.score1 ? c0 : "#bbb", lineHeight: 1, minWidth: 28, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{info.score0}</span>
                <span style={{ fontSize: 18, color: "#ccc", fontWeight: 300 }}>—</span>
                <span style={{ fontSize: 30, fontWeight: 700, color: info.score1 >= info.score0 ? c1 : "#bbb", lineHeight: 1, minWidth: 28, textAlign: "left", fontVariantNumeric: "tabular-nums" }}>{info.score1}</span>
              </div>
              {/* Team 1 */}
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 30, fontWeight: 700, color: c1, lineHeight: 1 }}>
                  {info.t1.name}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* New / unstarted game */
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#111" }}>{game.name}</div>
          </div>
        )}

        {/* Footer row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {info?.gameOver ? (
              <span style={{ fontSize: 11, fontWeight: 600, color: "#888", background: "#f0f0f0", borderRadius: 20, padding: "3px 9px", letterSpacing: "0.04em", textTransform: "uppercase" }}>Final</span>
            ) : info?.started ? (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#2a7a3b", background: "#eaf6ec", borderRadius: 20, padding: "3px 9px", letterSpacing: "0.04em" }}>
                ● Live{info.latestTime ? ` · ${info.latestTime} ${qLabel(info.currentQuarter)}` : ""}
              </span>
            ) : (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#d4820a", background: "#fff8ec", borderRadius: 20, padding: "3px 9px", letterSpacing: "0.04em" }}>● Pending</span>
            )}
            <span style={{ fontSize: 11, color: "#bbb" }}>{formatDate(game.created_at)}</span>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button style={{ padding: "5px 10px", fontSize: 12, fontWeight: 500, background: "transparent", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", color: "#555" }}
              onClick={() => navigate(`/games/${game.id}/view`)}>View</button>
            <button style={{ padding: "5px 12px", fontSize: 12, fontWeight: 600, background: "#111", border: "none", borderRadius: 8, cursor: "pointer", color: "#fff" }}
              onClick={() => navigate(`/games/${game.id}/score`)}>{info?.started ? "Score" : "Setup"}</button>
            <button style={{ padding: "5px 8px", fontSize: 13, background: "transparent", border: "1px solid #f0a0a0", borderRadius: 8, cursor: "pointer", color: "#c0392b", lineHeight: 1 }}
              onClick={() => onDeleteStage(deleteStage === 0 ? 1 : null)}>🗑</button>
          </div>
        </div>
      </div>

      {/* Delete confirm strips */}
      {deleteStage === 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: "#fff5f5", borderTop: "1px solid #fdd" }}>
          <span style={{ fontSize: 13, color: "#c0392b", fontWeight: 500 }}>Delete this game?</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ padding: "5px 12px", fontSize: 12, background: "transparent", border: "1px solid #ddd", borderRadius: 7, cursor: "pointer", color: "#555" }} onClick={() => onDeleteStage(null)}>Cancel</button>
            <button style={{ padding: "5px 12px", fontSize: 12, background: "transparent", border: "1px solid #e08080", borderRadius: 7, cursor: "pointer", color: "#c0392b", fontWeight: 600 }} onClick={() => onDeleteStage(2)}>Delete</button>
          </div>
        </div>
      )}
      {deleteStage === 2 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: "#fef0f0", borderTop: "1px solid #e8a0a0" }}>
          <span style={{ fontSize: 13, color: "#c0392b", fontWeight: 600 }}>Permanently delete? Cannot be undone.</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ padding: "5px 12px", fontSize: 12, background: "transparent", border: "1px solid #ddd", borderRadius: 7, cursor: "pointer", color: "#555" }} onClick={() => onDeleteStage(null)}>Cancel</button>
            <button style={{ padding: "5px 12px", fontSize: 12, background: "#c0392b", border: "none", borderRadius: 7, cursor: "pointer", color: "#fff", fontWeight: 600 }} onClick={onDelete}>Yes, delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Games Tab ─────────────────────────────────────────────────────────────────
function GamesTab({ onNewGame, creating }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteStages, setDeleteStages] = useState({});

  useEffect(() => { loadGames(); }, []);

  async function loadGames() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("games").select("id, created_at, name, state").order("created_at", { ascending: false });
    if (err) setError(err.message);
    else setGames(data || []);
    setLoading(false);
  }

  async function handleDelete(id) {
    const { error: err } = await supabase.from("games").delete().eq("id", id);
    if (err) setError(err.message);
    else setGames(prev => prev.filter(g => g.id !== id));
    setDeleteStages(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

  if (loading) return <div style={{ textAlign: "center", padding: "48px 0", color: "#aaa", fontSize: 14 }}>Loading…</div>;
  if (error) return <div style={{ background: "#fff5f5", border: "1px solid #fdd", borderRadius: 10, padding: "12px 16px", color: "#c0392b", fontSize: 13, marginBottom: 16 }}>{error}</div>;

  if (games.length === 0) return (
    <div style={{ textAlign: "center", padding: "64px 20px" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🥍</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: "#111", marginBottom: 6 }}>No games yet</div>
      <div style={{ fontSize: 14, color: "#888", marginBottom: 24 }}>Create your first game to start tracking stats.</div>
      <button style={{ padding: "12px 28px", fontSize: 15, fontWeight: 600, background: "#111", color: "#fff", border: "none", borderRadius: 12, cursor: "pointer" }}
        onClick={onNewGame} disabled={creating}>{creating ? "Creating…" : "+ New Game"}</button>
    </div>
  );

  return (
    <div>
      {games.map(game => (
        <GameCard key={game.id} game={game}
          deleteStage={deleteStages[game.id] ?? 0}
          onDeleteStage={(stage) => setDeleteStages(prev => stage === null ? (({ [game.id]: _, ...rest }) => rest)(prev) : { ...prev, [game.id]: stage })}
          onDelete={() => handleDelete(game.id)}
        />
      ))}
    </div>
  );
}

// ── Roster Editor ─────────────────────────────────────────────────────────────
function RosterEditor({ initial, onSave, onDelete, onCancel, isNew }) {
  const [name, setName] = useState(initial?.name || "");
  const [roster, setRoster] = useState(initial?.roster || "");
  const [color, setColor] = useState(initial?.color || PRESET_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dupes = findDuplicateNums(roster);

  async function handleSave() {
    if (!name.trim() || dupes.length > 0) return;
    setSaving(true);
    await onSave({ name: name.trim(), roster, color });
    setSaving(false);
  }

  const labelStyle = { fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, marginTop: 14, display: "block" };
  const inputStyle = { width: "100%", padding: "8px 10px", fontSize: 14, border: "1px solid #e0e0e0", borderRadius: 8, background: "#fff", boxSizing: "border-box" };
  const textareaStyle = { width: "100%", height: 130, padding: 10, fontSize: 13, fontFamily: "monospace", border: "1px solid #e0e0e0", borderRadius: 8, background: "#fff", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box" };

  return (
    <div>
      <span style={labelStyle}>Team name</span>
      <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Team name" />

      <span style={labelStyle}>Color</span>
      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
        {PRESET_COLORS.map(c => (
          <div key={c} style={{ width: 24, height: 24, borderRadius: "50%", background: c, border: color === c ? "3px solid #111" : "2px solid transparent", cursor: "pointer", boxSizing: "border-box", boxShadow: color === c ? "none" : "0 0 0 1px #ddd" }}
            onClick={() => setColor(c)} />
        ))}
        <input type="color" style={{ width: 28, height: 24, border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", padding: 2 }} value={color} onChange={e => setColor(e.target.value)} />
      </div>

      <span style={labelStyle}>Roster</span>
      <textarea style={{ ...textareaStyle, borderColor: dupes.length > 0 ? "#f0a0a0" : "#e0e0e0" }}
        value={roster} onChange={e => setRoster(e.target.value)}
        placeholder={"#2 First Last\n#7 First Last\n#11 First Last"} />
      {dupes.length > 0
        ? <div style={{ fontSize: 11, color: "#c0392b", marginTop: 4, fontWeight: 500 }}>Duplicate number{dupes.length > 1 ? "s" : ""}: {dupes.join(", ")}</div>
        : <div style={{ fontSize: 11, color: "#bbb", marginTop: 4 }}>One player per line — #number Name</div>
      }

      <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
        {!isNew && !confirmDelete && (
          <button style={{ padding: "9px 14px", fontSize: 13, background: "transparent", border: "1px solid #f0a0a0", borderRadius: 9, cursor: "pointer", color: "#c0392b" }}
            onClick={() => setConfirmDelete(true)}>Delete</button>
        )}
        {!isNew && confirmDelete && (
          <button style={{ padding: "9px 14px", fontSize: 13, background: "#c0392b", border: "none", borderRadius: 9, cursor: "pointer", color: "#fff", fontWeight: 600 }}
            onClick={onDelete}>Confirm delete</button>
        )}
        {onCancel && (
          <button style={{ padding: "9px 14px", fontSize: 13, background: "transparent", border: "1px solid #e0e0e0", borderRadius: 9, cursor: "pointer", color: "#555" }}
            onClick={onCancel}>Cancel</button>
        )}
        <button style={{ marginLeft: "auto", padding: "9px 18px", fontSize: 13, fontWeight: 600, background: name.trim() && !saving && !dupes.length ? "#111" : "#ccc", color: "#fff", border: "none", borderRadius: 9, cursor: name.trim() && !saving && !dupes.length ? "pointer" : "not-allowed" }}
          disabled={!name.trim() || saving || dupes.length > 0} onClick={handleSave}>
          {saving ? "Saving…" : isNew ? "Save team" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

// ── Rosters Tab ───────────────────────────────────────────────────────────────
function RostersTab({ showNewInit = false }) {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [showNew, setShowNew] = useState(showNewInit);

  useEffect(() => { loadTeams(); }, []);

  async function loadTeams() {
    setLoading(true);
    const { data, error: err } = await supabase.from("saved_teams").select("id, name, roster, color").order("name");
    if (err) setError(err.message);
    else setTeams(data || []);
    setLoading(false);
  }

  async function handleCreate(fields) {
    const { data, error: err } = await supabase.from("saved_teams").insert(fields).select().single();
    if (err) { setError(err.message); return; }
    setTeams(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setShowNew(false);
  }

  async function handleUpdate(id, fields) {
    const { error: err } = await supabase.from("saved_teams").update(fields).eq("id", id);
    if (err) { setError(err.message); return; }
    setTeams(prev => prev.map(t => t.id === id ? { ...t, ...fields } : t).sort((a, b) => a.name.localeCompare(b.name)));
    setExpandedId(null);
  }

  async function handleDelete(id) {
    const { error: err } = await supabase.from("saved_teams").delete().eq("id", id);
    if (err) { setError(err.message); return; }
    setTeams(prev => prev.filter(t => t.id !== id));
    setExpandedId(null);
  }

  if (loading) return <div style={{ textAlign: "center", padding: "48px 0", color: "#aaa", fontSize: 14 }}>Loading…</div>;

  return (
    <div>
      {/* Tab-level action row */}
      {!showNew && teams.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button onClick={() => setShowNew(true)}
            style={{ padding: "7px 16px", fontSize: 13, fontWeight: 600, background: "#111", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer" }}>
            + New Team
          </button>
        </div>
      )}

      {error && <div style={{ background: "#fff5f5", border: "1px solid #fdd", borderRadius: 10, padding: "12px 16px", color: "#c0392b", fontSize: 13, marginBottom: 16 }}>{error}</div>}

      {showNew && (
        <div style={{ border: "1px solid #e0e0e0", borderRadius: 16, padding: 18, marginBottom: 12, background: "#fafafa" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>New Team</div>
          <RosterEditor isNew onSave={handleCreate} onCancel={() => setShowNew(false)} />
        </div>
      )}

      {teams.length === 0 && !showNew ? (
        <div style={{ textAlign: "center", padding: "64px 20px" }}>
          <div style={{ fontSize: 14, color: "#888", marginBottom: 20 }}>No saved teams yet.</div>
          <button style={{ padding: "11px 24px", fontSize: 14, fontWeight: 600, background: "#111", color: "#fff", border: "none", borderRadius: 12, cursor: "pointer" }}
            onClick={() => setShowNew(true)}>+ New Team</button>
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {teams.map(team => {
            const open = expandedId === team.id;
            const count = playerCount(team.roster);
            return (
              <li key={team.id} style={{ border: "1px solid #e8e8e8", borderRadius: 14, marginBottom: 10, overflow: "hidden", background: "#fff", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer" }}
                  onClick={() => setExpandedId(open ? null : team.id)}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: team.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#111" }}>{team.name}</div>
                    <div style={{ fontSize: 12, color: "#aaa", marginTop: 1 }}>{count} player{count !== 1 ? "s" : ""}</div>
                  </div>
                  <div style={{ fontSize: 14, color: "#ccc", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>›</div>
                </div>
                {open && (
                  <div style={{ padding: "0 16px 16px", borderTop: "1px solid #f0f0f0" }}>
                    <RosterEditor initial={team}
                      onSave={(fields) => handleUpdate(team.id, fields)}
                      onDelete={() => handleDelete(team.id)} />
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

// ── Root ──────────────────────────────────────────────────────────────────────
export default function GameList() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("games");
  const [creating, setCreating] = useState(false);

  async function handleNewGame() {
    setCreating(true);
    const name = `Game — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    const { data, error: err } = await supabase.from("games").insert({ name, state: null }).select().single();
    setCreating(false);
    if (err) return;
    navigate(`/games/${data.id}/score`);
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", minHeight: "100vh", background: "#f5f5f5" }}>

      {/* ── Hero ── */}
      <div style={{
        background: "#0f1117",
        backgroundImage: FIELD_BG,
        backgroundSize: "cover",
        backgroundPosition: "center",
        padding: "40px 24px 32px",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 0%, transparent 40%, rgba(0,0,0,0.6) 100%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", maxWidth: 560, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 36, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1 }}>LaxStats</span>
            <span style={{ fontSize: 22 }}>🥍</span>
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 28 }}>
            Stat Tracker
          </div>
          <button onClick={handleNewGame} disabled={creating} style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "11px 22px", fontSize: 14, fontWeight: 700,
            background: creating ? "rgba(255,255,255,0.15)" : "#fff",
            color: creating ? "rgba(255,255,255,0.5)" : "#111",
            border: "none", borderRadius: 12, cursor: creating ? "not-allowed" : "pointer",
          }}>
            {creating ? "Creating…" : "＋ New Game"}
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 16px" }}>
        <div style={{ display: "flex", gap: 4, padding: "12px 0 0", marginBottom: 16, borderBottom: "1px solid #e8e8e8" }}>
          {[["games", "Games"], ["rosters", "Rosters"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: "8px 18px", fontSize: 14, fontWeight: tab === id ? 700 : 500,
              border: "none", background: "transparent", cursor: "pointer",
              color: tab === id ? "#111" : "#aaa",
              borderBottom: tab === id ? "2px solid #111" : "2px solid transparent",
              marginBottom: -1,
            }}>{label}</button>
          ))}
        </div>

        {tab === "games"
          ? <GamesTab onNewGame={handleNewGame} creating={creating} />
          : <RostersTab />}
      </div>
    </div>
  );
}
