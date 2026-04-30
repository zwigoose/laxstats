import { useState } from "react";
import { PRESET_COLORS } from "../constants/lacrosse";
import { findDuplicateNums } from "../utils/stats";

export default function RosterEditor({ initial, onSave, onDelete, onCancel, isNew }) {
  const [name, setName]     = useState(initial?.name   || "");
  const [roster, setRoster] = useState(initial?.roster || "");
  const [color, setColor]   = useState(initial?.color  || PRESET_COLORS[0]);
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
