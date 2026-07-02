import { C } from "../../styles/tokens";
export default function SectionToggle({ label, count, open, onToggle }) {
  if (count === 0) return null;
  return (
    <button onClick={onToggle} style={{
      width: "100%", padding: "8px 12px", marginTop: 4, marginBottom: open ? 8 : 4,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      background: C.gray50, border: `1px solid ${C.gray100}`, borderRadius: 8,
      cursor: "pointer", fontSize: 12, fontWeight: 600, color: C.gray600,
    }}>
      <span>{count} {label}{count !== 1 ? "s" : ""}</span>
      <span style={{ fontSize: 12, color: C.gray400, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s", display: "inline-block" }}>›</span>
    </button>
  );
}
