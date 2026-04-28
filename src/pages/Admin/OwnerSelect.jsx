import { useState } from "react";
import { displayName } from "./helpers";

export default function OwnerSelect({ currentUserId, users, onSave }) {
  const [selectedId, setSelectedId] = useState(currentUserId || "");
  const [saving, setSaving]         = useState(false);

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
