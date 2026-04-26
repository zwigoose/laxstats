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

// ── Roster import helpers ────────────────────────────────────────────────────

function parseTextRoster(text) {
  return text.split("\n").map(l => l.trim()).filter(Boolean).map(line => {
    const m = line.match(/^#?(\d+)\s+(.+)$/) || line.match(/^(.+)\s+#?(\d+)$/);
    if (m) {
      if (/^\d+$/.test(m[1])) return { number: m[1], name: m[2].trim(), position: null };
      return { number: m[2], name: m[1].trim(), position: null };
    }
    const n = line.match(/^#?(\d+)$/);
    if (n) return { number: n[1], name: `#${n[1]}`, position: null };
    return { number: null, name: line, position: null };
  }).filter(p => p.name);
}

function parseCsvText(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const sep = lines[0].includes("\t") ? "\t" : ",";
  const rows = lines.map(l => l.split(sep).map(c => c.trim().replace(/^"|"$/g, "")));

  // Detect header row
  const first = rows[0];
  const hasHeader = first.some(c => /^(number|num|#|name|position|pos)$/i.test(c));

  if (hasHeader) {
    const hdr = first.map(h => h.toLowerCase());
    const numIdx  = hdr.findIndex(h => /^(number|num|#)$/.test(h));
    const nameIdx = hdr.findIndex(h => h === "name");
    const posIdx  = hdr.findIndex(h => /^(position|pos)$/.test(h));
    return rows.slice(1).map(row => ({
      number:   numIdx  >= 0 ? (row[numIdx]?.replace(/\D/g, "") || null) : null,
      name:     nameIdx >= 0 ? (row[nameIdx] || "") : "",
      position: posIdx  >= 0 ? (row[posIdx]  || null) : null,
    })).filter(p => p.name.trim());
  }

  // No header: heuristic — first numeric-looking cell = number, first text cell = name, short leftover = position
  return rows.map(row => {
    let number = null, name = "", position = null;
    for (const cell of row) {
      const clean = cell.replace(/^#/, "");
      if (!number && /^\d{1,3}$/.test(clean))                    { number = clean; continue; }
      if (!name   && cell && !/^\d+$/.test(clean))               { name = cell;   continue; }
      if (name    && !position && cell && cell.length <= 6)      { position = cell; }
    }
    return { number, name, position };
  }).filter(p => p.name.trim());
}

// ── ImportRoster component ───────────────────────────────────────────────────

function ImportRoster({ teamId, orgId, existingPlayers, onImported, onCancel }) {
  const [mode, setMode]         = useState("csv");
  const [rows, setRows]         = useState(null);   // null = not yet parsed
  const [textBlob, setTextBlob] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [savedTeams, setSavedTeams]   = useState([]);

  useEffect(() => {
    supabase.from("saved_teams").select("id, name, roster").order("name")
      .then(({ data }) => { if (data) setSavedTeams(data); });
  }, []);

  const existingNums = new Set((existingPlayers || []).map(p => String(p.number)));

  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => setRows(parseCsvText(e.target.result).map(r => ({ ...r })));
    reader.readAsText(file);
  }

  function handleSavedTeamSelect(stId) {
    const t = savedTeams.find(s => s.id === stId);
    if (t) setRows(parseTextRoster(t.roster).map(r => ({ ...r })));
  }

  async function handleImport() {
    if (!rows?.length) return;
    setImporting(true);
    setImportError(null);

    // Step 1: create players in the org pool
    const { data: newPlayers, error: pErr } = await supabase
      .from("players")
      .insert(rows.map(r => ({
        org_id:   orgId,
        name:     r.name,
        number:   r.number ? parseInt(r.number, 10) : null,
        position: r.position || null,
      })))
      .select("id, name, number, position");
    if (pErr) { setImportError(pErr.message); setImporting(false); return; }

    // Step 2: assign all to this team
    const { error: tErr } = await supabase
      .from("team_players")
      .insert(newPlayers.map(p => ({ team_id: teamId, player_id: p.id, jersey_num: null })));
    setImporting(false);
    if (tErr) { setImportError(tErr.message); return; }

    onImported(newPlayers.map(p => ({ ...p, jersey_num: null })));
  }

  const dupeNums = rows ? rows.filter(r => r.number && existingNums.has(r.number)).map(r => `#${r.number}`) : [];

  const modeTab = (id, label) => (
    <button key={id} onClick={() => { setMode(id); setRows(null); setTextBlob(""); }}
      style={{ padding: "5px 12px", fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: "pointer",
        background: mode === id ? "#111" : "transparent", color: mode === id ? "#fff" : "#555",
        border: mode === id ? "none" : "1px solid #ddd" }}>
      {label}
    </button>
  );

  return (
    <div style={{ background: "#f7f8fa", border: "1px solid #e0e0e0", borderRadius: 12, padding: 14, marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em" }}>Import Roster</div>
        <button style={S.btnOut} onClick={onCancel}>Cancel</button>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {modeTab("csv",   "CSV file")}
        {modeTab("text",  "Text")}
        {modeTab("saved", "Saved team")}
      </div>

      {/* ── Input panels ── */}
      {!rows && mode === "csv" && (
        <div>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>
            Upload a CSV — columns: <code>number, name, position</code> (position optional). Header row auto-detected.
          </div>
          <label style={{ display: "inline-block", padding: "8px 14px", fontSize: 12, fontWeight: 600,
            background: "#111", color: "#fff", borderRadius: 8, cursor: "pointer" }}>
            Choose CSV file
            <input type="file" accept=".csv,text/csv" style={{ display: "none" }}
              onChange={e => { handleFile(e.target.files[0]); e.target.value = ""; }} />
          </label>
        </div>
      )}

      {!rows && mode === "text" && (
        <div>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>
            One player per line — <code>#22 First Last</code>. Position can be filled in after preview.
          </div>
          <textarea value={textBlob} onChange={e => setTextBlob(e.target.value)}
            placeholder={"#2 First Last\n#7 First Last\n#11 First Last"}
            style={{ width: "100%", height: 120, padding: 10, fontSize: 13, fontFamily: "monospace",
              border: "1px solid #ddd", borderRadius: 8, background: "#fff", resize: "vertical",
              boxSizing: "border-box" }} />
          <button style={{ ...S.btnSm, marginTop: 8, opacity: !textBlob.trim() ? 0.4 : 1 }}
            disabled={!textBlob.trim()}
            onClick={() => setRows(parseTextRoster(textBlob).map(r => ({ ...r })))}>
            Preview →
          </button>
        </div>
      )}

      {!rows && mode === "saved" && (
        <div>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>
            Saved teams don't include position — you can fill it in after preview.
          </div>
          <select style={{ ...S.input, maxWidth: 300, marginTop: 0 }} defaultValue=""
            onChange={e => e.target.value && handleSavedTeamSelect(e.target.value)}>
            <option value="" disabled>Select a saved team…</option>
            {savedTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}

      {/* ── Preview ── */}
      {rows !== null && (
        <div>
          {rows.length === 0 ? (
            <div style={{ fontSize: 13, color: "#c0392b", marginBottom: 8 }}>
              No players found — check the format and try again.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>
                {rows.length} player{rows.length !== 1 ? "s" : ""} · Edit the Pos. column as needed
              </div>
              {dupeNums.length > 0 && (
                <div style={{ fontSize: 11, color: "#7a5c00", background: "#fffbf0",
                  border: "1px solid #e0d080", borderRadius: 6, padding: "5px 10px", marginBottom: 8 }}>
                  Already on roster: {dupeNums.join(", ")}
                </div>
              )}
              <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid #e5e5e5", borderRadius: 8, background: "#fff" }}>
                {rows.map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
                    borderBottom: i < rows.length - 1 ? "1px solid #f0f0f0" : "none" }}>
                    <span style={{ fontSize: 12, color: "#bbb", width: 32, textAlign: "right", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                      {r.number ? `#${r.number}` : "—"}
                    </span>
                    <span style={{ flex: 1, fontSize: 13, color: "#111" }}>{r.name}</span>
                    <input value={r.position || ""} placeholder="Pos."
                      onChange={e => setRows(prev => prev.map((row, j) => j === i ? { ...row, position: e.target.value || null } : row))}
                      style={{ width: 52, padding: "3px 6px", fontSize: 12, border: "1px solid #e0e0e0",
                        borderRadius: 6, fontFamily: "system-ui, sans-serif" }} />
                    <button onClick={() => setRows(prev => prev.filter((_, j) => j !== i))}
                      style={{ fontSize: 11, color: "#c0392b", background: "none", border: "none",
                        cursor: "pointer", padding: "2px 4px", flexShrink: 0, lineHeight: 1 }}>✕</button>
                  </div>
                ))}
              </div>
            </>
          )}
          {importError && <div style={{ ...S.err, marginTop: 8 }}>{importError}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button style={S.btnOut} onClick={() => { setRows(null); setImportError(null); }}>← Back</button>
            {rows.length > 0 && (
              <button style={{ ...S.btn, opacity: importing ? 0.5 : 1, marginLeft: "auto" }}
                disabled={importing} onClick={handleImport}>
                {importing ? "Adding…" : `Add ${rows.length} player${rows.length !== 1 ? "s" : ""} →`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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

function TeamCard({ team, orgId, canManage, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [players, setPlayers] = useState(null);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [playerError, setPlayerError] = useState(null);
  const [importingRoster, setImportingRoster] = useState(false);

  async function loadPlayers() {
    if (players !== null) return;
    setLoadingPlayers(true);
    const { data } = await supabase
      .from("team_players")
      .select("jersey_num, player:players!inner(id, name, number, position)")
      .eq("team_id", team.id);
    const flat = (data || [])
      .map(tp => ({ ...tp.player, jersey_num: tp.jersey_num }))
      .sort((a, b) => {
        const na = a.jersey_num ?? a.number;
        const nb = b.jersey_num ?? b.number;
        if (na != null && nb != null) return na - nb;
        if (na != null) return -1;
        if (nb != null) return 1;
        return a.name.localeCompare(b.name);
      });
    setPlayers(flat);
    setLoadingPlayers(false);
  }

  function handleToggle() {
    if (!expanded) loadPlayers();
    setExpanded(v => !v);
    setEditing(false);
    setAddingPlayer(false);
    setEditingPlayerId(null);
    setConfirmDelete(false);
    setImportingRoster(false);
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
    // Create the player in the org pool
    const { data: player, error: pErr } = await supabase
      .from("players")
      .insert({ org_id: orgId, name: fields.name, number: fields.number, position: fields.position })
      .select("id, name, number, position")
      .single();
    if (pErr) { setPlayerError(pErr.message); setSaving(false); return; }
    // Assign to this team
    const { error: tErr } = await supabase
      .from("team_players")
      .insert({ team_id: team.id, player_id: player.id, jersey_num: null });
    if (tErr) { setPlayerError(tErr.message); setSaving(false); return; }
    const entry = { ...player, jersey_num: null };
    setPlayers(prev => {
      const next = [...(prev || []), entry];
      return next.sort((a, b) => {
        const na = a.jersey_num ?? a.number, nb = b.jersey_num ?? b.number;
        if (na != null && nb != null) return na - nb;
        if (na != null) return -1; if (nb != null) return 1;
        return a.name.localeCompare(b.name);
      });
    });
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
    // Remove from this team only; player stays in the org pool
    const { error: err } = await supabase.from("team_players")
      .delete().eq("team_id", team.id).eq("player_id", id);
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
                        {(p.jersey_num ?? p.number) != null && (
                          <span style={{ fontSize: 12, color: "#bbb", width: 24, textAlign: "right", flexShrink: 0 }}>#{p.jersey_num ?? p.number}</span>
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

              {canManage && !addingPlayer && !importingRoster && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ ...S.btnOut, fontSize: 12 }} onClick={() => setAddingPlayer(true)}>+ Add player</button>
                  <button style={{ ...S.btnOut, fontSize: 12 }} onClick={() => { setAddingPlayer(false); setImportingRoster(true); }}>Import roster</button>
                </div>
              )}

              {canManage && addingPlayer && (
                <PlayerForm teamId={team.id} saving={saving}
                  onSave={handleAddPlayer}
                  onCancel={() => setAddingPlayer(false)} />
              )}

              {canManage && importingRoster && (
                <ImportRoster
                  teamId={team.id}
                  orgId={orgId}
                  existingPlayers={players || []}
                  onImported={newPlayers => {
                    setPlayers(prev => {
                      const merged = [...(prev || []), ...newPlayers].sort((a, b) => {
                        if (a.number != null && b.number != null) return a.number - b.number;
                        if (a.number != null) return -1;
                        if (b.number != null) return 1;
                        return a.name.localeCompare(b.name);
                      });
                      return merged;
                    });
                    setImportingRoster(false);
                  }}
                  onCancel={() => setImportingRoster(false)}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export { TeamCard, TeamForm, ColorPicker, PRESET_COLORS };

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
            <TeamCard key={team.id} team={team} orgId={org.id} canManage={isCoach}
              onUpdate={handleUpdateTeam}
              onDelete={handleDeleteTeam} />
          ))
        )}
      </div>
    </div>
  );
}
