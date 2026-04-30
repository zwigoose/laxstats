import { useState } from "react";
import { getGameInfo } from "../../utils/game";
import AdminGameRow from "./AdminGameRow";
import SectionToggle from "./SectionToggle";

export default function OrgGameGroup({ orgName, orgSlug, games, userMap, users, onReassigned, onDeleted }) {
  const live    = games.filter(g => { const i = getGameInfo(g); return i?.started && !i?.gameOver; });
  const pending = games.filter(g => { const i = getGameInfo(g); return !i?.started; });
  const final   = games.filter(g => { const i = getGameInfo(g); return i?.gameOver; });

  const [open, setOpen]               = useState(live.length > 0);
  const [showPending, setShowPending] = useState(false);
  const [showFinal, setShowFinal]     = useState(false);

  return (
    <div style={{ marginBottom: 10 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%", padding: "10px 14px",
          display: "flex", alignItems: "center", gap: 10,
          background: "#fff", border: "1px solid #e0e0e0", borderRadius: open ? "12px 12px 0 0" : 12,
          cursor: "pointer", textAlign: "left",
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: "#111", flex: 1 }}>{orgName}</span>
        {live.length > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, color: "#2a7a3b", background: "#eaf6ec", borderRadius: 20, padding: "2px 8px" }}>
            ● {live.length} live
          </span>
        )}
        <span style={{ fontSize: 11, color: "#aaa" }}>{games.length} game{games.length !== 1 ? "s" : ""}</span>
        <span style={{ fontSize: 13, color: "#ccc", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }}>›</span>
      </button>

      {open && (
        <div style={{ border: "1px solid #e0e0e0", borderTop: "none", borderRadius: "0 0 12px 12px", padding: "10px 12px 12px", background: "#fafafa" }}>
          {live.length === 0 && pending.length === 0 && final.length === 0 && (
            <div style={{ fontSize: 13, color: "#aaa", padding: "8px 0" }}>No games.</div>
          )}
          {live.map(g => (
            <AdminGameRow key={g.id} game={g} userMap={userMap} users={users} onReassigned={onReassigned} onDeleted={onDeleted} />
          ))}
          <SectionToggle label="pending game" count={pending.length} open={showPending} onToggle={() => setShowPending(v => !v)} />
          {showPending && pending.map(g => (
            <AdminGameRow key={g.id} game={g} userMap={userMap} users={users} onReassigned={onReassigned} onDeleted={onDeleted} />
          ))}
          <SectionToggle label="completed game" count={final.length} open={showFinal} onToggle={() => setShowFinal(v => !v)} />
          {showFinal && final.map(g => (
            <AdminGameRow key={g.id} game={g} userMap={userMap} users={users} onReassigned={onReassigned} onDeleted={onDeleted} />
          ))}
        </div>
      )}
    </div>
  );
}
