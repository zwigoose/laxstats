import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useOrgRole } from "../hooks/useOrgRole";

const PRESET_COLORS = ["#1a6bab","#b84e1a","#2a7a3b","#8b1a8b","#c0392b","#d4820a","#1a7a7a","#555","#1a2e8b","#8b3a1a"];

const S = {
  page:   { fontFamily: "system-ui, sans-serif", minHeight: "100vh", background: "#f5f5f5" },
  wrap:   { maxWidth: 600, margin: "0 auto", padding: "32px 20px" },
  back:   { fontSize: 13, color: "#888", background: "none", border: "none", cursor: "pointer", padding: "0 0 20px", display: "block" },
  h1:     { fontSize: 24, fontWeight: 800, color: "#111", margin: "0 0 24px", letterSpacing: "-0.02em" },
  label:  { display: "block", fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, marginTop: 16 },
  input:  { width: "100%", padding: "10px 12px", fontSize: 14, border: "1px solid #e0e0e0", borderRadius: 10, background: "#fff", boxSizing: "border-box", fontFamily: "system-ui, sans-serif" },
  btn:    { padding: "9px 18px", fontSize: 13, fontWeight: 700, background: "#111", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer" },
  btnSm:  { padding: "6px 12px", fontSize: 12, fontWeight: 600, background: "#111", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" },
  btnOut: { padding: "6px 12px", fontSize: 12, fontWeight: 500, background: "transparent", color: "#555", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer" },
  btnDanger: { padding: "6px 12px", fontSize: 12, fontWeight: 500, background: "transparent", color: "#c0392b", border: "1px solid #f0a0a0", borderRadius: 8, cursor: "pointer" },
  card:   { background: "#fff", border: "1px solid #e8e8e8", borderRadius: 14, overflow: "hidden", marginBottom: 10, boxShadow: "0 1px 6px rgba(0,0,0,0.05)" },
  err:    { background: "#fff5f5", border: "1px solid #fdd", borderRadius: 10, padding: "10px 14px", color: "#c0392b", fontSize: 13, marginBottom: 16 },
};

function ColorPicker({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
      {PRESET_COLORS.map(c => (
        <div key={c} onClick={() => onChange(c)}
          style={{ width: 24, height: 24, borderRadius: "50%", background: c, cursor: "pointer",
            border: value === c ? "3px solid #111" : "2px solid transparent",
            boxSizing: "border-box", boxShadow: value === c ? "none" : "0 0 0 1px #ddd" }} />
      ))}
      <input type="color" value={value} onChange={e => onChange(e.target.value)}
        style={{ width: 28, height: 24, border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", padding: 2 }} />
    </div>
  );
}

function TeamForm({ initial, onSave, onCancel, saving }) {
  const [name, setName] = useState(initial?.name || "");
  const [color, setColor] = useState(initial?.color || PRESET_COLORS[0]);

  function handleSubmit() {
    if (!name.trim() || saving) return;
    onSave({ name: name.trim(), color });
  }

  return (
    <div>
      <span style={S.label}>Team name</span>
      <input style={S.input} value={name} autoFocus
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === "Enter" && handleSubmit()}
        placeholder="Eagles" />
      <span style={S.label}>Color</span>
      <ColorPicker value={color} onChange={setColor} />
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        {onCancel && <button style={S.btnOut} onClick={onCancel}>Cancel</button>}
        <button style={{ ...S.btn, opacity: (!name.trim() || saving) ? 0.4 : 1, marginLeft: onCancel ? "auto" : 0 }}
          disabled={!name.trim() || saving} onClick={handleSubmit}>
          {saving ? "Saving…" : initial ? "Save changes" : "Create team"}
        </button>
      </div>
    </div>
  );
}

function PlayerForm({ teamId, initial, onSave, onCancel, saving }) {
  const [name, setName] = useState(initial?.name || "");
  const [number, setNumber] = useState(initial?.number != null ? String(initial.number) : "");
  const [position, setPosition] = useState(initial?.position || "");

  function handleSubmit() {
    if (!name.trim() || saving) return;
    onSave({ name: name.trim(), number: number.trim() ? parseInt(number, 10) : null, position: position.trim() || null });
  }

  return (
    <div style={{ background: "#fafafa", border: "1px solid #e8e8e8", borderRadius: 10, padding: 14, marginBottom: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 80px", gap: 8, marginBottom: 10 }}>
        <div>
          <span style={{ ...S.label, marginTop: 0 }}>#</span>
          <input style={S.input} value={number} onChange={e => setNumber(e.target.value.replace(/\D/g, ""))}
            placeholder="22" maxLength={3} />
        </div>
        <div>
          <span style={{ ...S.label, marginTop: 0 }}>Name</span>
          <input style={S.input} value={name} autoFocus
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
            placeholder="First Last" />
        </div>
        <div>
          <span style={{ ...S.label, marginTop: 0 }}>Pos.</span>
          <input style={S.input} value={position} onChange={e => setPosition(e.target.value)}
            placeholder="A" maxLength={4} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {onCancel && <button style={S.btnOut} onClick={onCancel}>Cancel</button>}
        <button style={{ ...S.btnSm, opacity: (!name.trim() || saving) ? 0.4 : 1, marginLeft: "auto" }}
          disabled={!name.trim() || saving} onClick={handleSubmit}>
          {saving ? "…" : initial ? "Save" : "Add"}
        </button>
      </div>
    </div>
  );
}

function TeamCard({ team, canManage, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [players, setPlayers] = useState(null);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [playerError, setPlayerError] = useState(null);

  async function loadPlayers() {
    if (players !== null) return;
    setLoadingPlayers(true);
    const { data } = await supabase
      .from("players")
      .select("id, name, number, position")
      .eq("team_id", team.id)
      .order("number", { nullsFirst: false })
      .order("name");
    setPlayers(data || []);
    setLoadingPlayers(false);
  }

  function handleToggle() {
    if (!expanded) loadPlayers();
    setExpanded(v => !v);
    setEditing(false);
    setAddingPlayer(false);
    setEditingPlayerId(null);
    setConfirmDelete(false);
  }

  async function handleSaveTeam(fields) {
    setSaving(true);
    await onUpdate(team.id, fields);
    setSaving(false);
    setEditing(false);
  }

  async function handleAddPlayer(fields) {
    setSaving(true);
    setPlayerError(null);
    const { data, error: err } = await supabase
      .from("players")
      .insert({ team_id: team.id, ...fields })
      .select("id, name, number, position")
      .single();
    if (err) { setPlayerError(err.message); setSaving(false); return; }
    setPlayers(prev => [...(prev || []), data].sort((a, b) => {
      if (a.number != null && b.number != null) return a.number - b.number;
      if (a.number != null) return -1;
      if (b.number != null) return 1;
      return a.name.localeCompare(b.name);
    }));
    setAddingPlayer(false);
    setSaving(false);
  }

  async function handleUpdatePlayer(id, fields) {
    setSaving(true);
    setPlayerError(null);
    const { error: err } = await supabase.from("players").update(fields).eq("id", id);
    if (err) { setPlayerError(err.message); setSaving(false); return; }
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, ...fields } : p));
    setEditingPlayerId(null);
    setSaving(false);
  }

  async function handleDeletePlayer(id) {
    const { error: err } = await supabase.from("players").delete().eq("id", id);
    if (err) { setPlayerError(err.message); return; }
    setPlayers(prev => prev.filter(p => p.id !== id));
  }

  return (
    <div style={S.card}>
      <div onClick={handleToggle}
        style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: team.color, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>{team.name}</div>
          {players !== null && (
            <div style={{ fontSize: 12, color: "#aaa", marginTop: 1 }}>{players.length} player{players.length !== 1 ? "s" : ""}</div>
          )}
        </div>
        <div style={{ fontSize: 14, color: "#ccc", transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>›</div>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid #f0f0f0", padding: "14px 16px" }}>
          {editing ? (
            <TeamForm initial={team} saving={saving}
              onSave={handleSaveTeam}
              onCancel={() => setEditing(false)} />
          ) : (
            <>
              {canManage && (
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <button style={S.btnOut} onClick={() => setEditing(true)}>Edit team</button>
                  {!confirmDelete ? (
                    <button style={S.btnDanger} onClick={() => setConfirmDelete(true)}>Delete</button>
                  ) : (
                    <>
                      <button style={{ ...S.btnDanger, background: "#c0392b", color: "#fff" }} onClick={() => onDelete(team.id)}>
                        Confirm delete
                      </button>
                      <button style={S.btnOut} onClick={() => setConfirmDelete(false)}>Cancel</button>
                    </>
                  )}
                </div>
              )}

              {/* Players list */}
              <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Roster</div>

              {playerError && <div style={S.err}>{playerError}</div>}

              {loadingPlayers && <div style={{ fontSize: 13, color: "#aaa", padding: "8px 0" }}>Loading…</div>}

              {players !== null && players.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  {players.map(p => (
                    editingPlayerId === p.id ? (
                      <PlayerForm key={p.id} teamId={team.id} initial={p} saving={saving}
                        onSave={(fields) => handleUpdatePlayer(p.id, fields)}
                        onCancel={() => setEditingPlayerId(null)} />
                    ) : (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", padding: "7px 0", borderBottom: "1px solid #f5f5f5", gap: 8 }}>
                        {p.number != null && (
                          <span style={{ fontSize: 12, color: "#bbb", width: 24, textAlign: "right", flexShrink: 0 }}>#{p.number}</span>
                        )}
                        <span style={{ flex: 1, fontSize: 14, color: "#111" }}>{p.name}</span>
                        {p.position && <span style={{ fontSize: 11, color: "#aaa" }}>{p.position}</span>}
                        {canManage && (
                          <div style={{ display: "flex", gap: 4 }}>
                            <button style={{ ...S.btnOut, padding: "3px 8px", fontSize: 11 }} onClick={() => setEditingPlayerId(p.id)}>Edit</button>
                            <button style={{ ...S.btnDanger, padding: "3px 8px", fontSize: 11 }} onClick={() => handleDeletePlayer(p.id)}>✕</button>
                          </div>
                        )}
                      </div>
                    )
                  ))}
                </div>
              )}

              {players !== null && players.length === 0 && (
                <div style={{ fontSize: 13, color: "#aaa", marginBottom: 10 }}>No players yet.</div>
              )}

              {canManage && !addingPlayer && (
                <button style={{ ...S.btnOut, fontSize: 12 }} onClick={() => setAddingPlayer(true)}>+ Add player</button>
              )}

              {canManage && addingPlayer && (
                <PlayerForm teamId={team.id} saving={saving}
                  onSave={handleAddPlayer}
                  onCancel={() => setAddingPlayer(false)} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function TeamManager() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [org, setOrg] = useState(null);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNewTeam, setShowNewTeam] = useState(false);
  const [saving, setSaving] = useState(false);

  const { isCoach, canView } = useOrgRole(org?.id);

  useEffect(() => { load(); }, [slug]);

  async function load() {
    setLoading(true);
    setError(null);

    const { data: orgData, error: orgErr } = await supabase
      .from("organizations")
      .select("id, name, slug")
      .eq("slug", slug)
      .single();
    if (orgErr || !orgData) { setError("Organization not found."); setLoading(false); return; }
    setOrg(orgData);

    const { data: teamsData, error: teamsErr } = await supabase
      .from("teams")
      .select("id, name, color")
      .eq("org_id", orgData.id)
      .order("name");
    if (teamsErr) { setError(teamsErr.message); setLoading(false); return; }
    setTeams(teamsData || []);
    setLoading(false);
  }

  async function handleCreateTeam(fields) {
    if (!org) return;
    setSaving(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("teams")
      .insert({ org_id: org.id, ...fields })
      .select("id, name, color")
      .single();
    if (err) { setError(err.message); setSaving(false); return; }
    setTeams(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setShowNewTeam(false);
    setSaving(false);
  }

  async function handleUpdateTeam(id, fields) {
    const { error: err } = await supabase.from("teams").update(fields).eq("id", id);
    if (err) { setError(err.message); return; }
    setTeams(prev => prev.map(t => t.id === id ? { ...t, ...fields } : t).sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function handleDeleteTeam(id) {
    const { error: err } = await supabase.from("teams").delete().eq("id", id);
    if (err) { setError(err.message); return; }
    setTeams(prev => prev.filter(t => t.id !== id));
  }

  if (loading) return (
    <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 14, color: "#888" }}>Loading…</div>
    </div>
  );

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <button style={S.back} onClick={() => navigate(`/orgs/${slug}`)}>← {org?.name}</button>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h1 style={{ ...S.h1, margin: 0 }}>Teams</h1>
          {isCoach && !showNewTeam && (
            <button style={S.btn} onClick={() => setShowNewTeam(true)}>+ New Team</button>
          )}
        </div>

        {error && <div style={S.err}>{error}</div>}

        {showNewTeam && (
          <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 14, padding: 18, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>New Team</div>
            <TeamForm saving={saving} onSave={handleCreateTeam} onCancel={() => setShowNewTeam(false)} />
          </div>
        )}

        {teams.length === 0 && !showNewTeam ? (
          <div style={{ textAlign: "center", padding: "48px 20px" }}>
            <div style={{ fontSize: 14, color: "#888", marginBottom: 20 }}>No teams yet.</div>
            {isCoach && (
              <button style={{ ...S.btn, padding: "11px 24px", fontSize: 14 }} onClick={() => setShowNewTeam(true)}>
                + Create first team
              </button>
            )}
          </div>
        ) : (
          teams.map(team => (
            <TeamCard key={team.id} team={team} canManage={isCoach}
              onUpdate={handleUpdateTeam}
              onDelete={handleDeleteTeam} />
          ))
        )}
      </div>
    </div>
  );
}
