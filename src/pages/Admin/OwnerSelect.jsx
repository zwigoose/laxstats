import { useState } from "react";
import { displayName } from "./helpers";
import { C } from "../../styles/tokens";

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
        style={{ flex: 1, padding: "6px 8px", fontSize: 13, border: `1px solid ${C.gray200}`, borderRadius: 8, background: C.white }}>
        <option value="">Select user…</option>
        {users.map(u => <option key={u.id} value={u.id}>{displayName(u.email)}</option>)}
      </select>
      <button onClick={handleSave} disabled={!selectedId || selectedId === currentUserId || saving}
        style={{ padding: "6px 14px", fontSize: 13, fontWeight: 600, background: (selectedId && selectedId !== currentUserId && !saving) ? C.gray900 : C.gray300, color: C.white, border: "none", borderRadius: 8, cursor: "pointer", flexShrink: 0 }}>
        {saving ? "…" : "Save"}
      </button>
    </div>
  );
}
