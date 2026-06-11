import { useState } from "react";

// Dialpad for entering a jersey number mid-flow (modeled on TimeKeypad UX).
// Accepts 1–2 digits; leading zeros are preserved so "0" and "00" are distinct,
// matching how the roster parser keys players by number string.
export default function NumberKeypad({ onConfirm, onCancel, error = null }) {
  const [digits, setDigits] = useState("");
  const canUse = digits.length >= 1;

  function pressDigit(d) {
    if (digits.length >= 2) return;
    setDigits(prev => prev + d);
  }

  const keyStyle = (special) => ({
    padding: "16px 0",
    fontSize: special ? 18 : 22,
    fontWeight: special ? 600 : 400,
    background: special ? "#f0f0f0" : "#f7f7f7",
    border: "1px solid #e8e8e8",
    borderRadius: 14,
    cursor: "pointer",
    color: "#111",
    fontFamily: "system-ui, sans-serif",
    userSelect: "none",
    WebkitUserSelect: "none",
  });

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ textAlign: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 48, fontWeight: 300, letterSpacing: "0.04em", fontVariantNumeric: "tabular-nums", color: digits.length > 0 ? "#111" : "#ccc" }}>
          #{digits.length > 0 ? digits : "––"}
        </span>
      </div>
      <div style={{ textAlign: "center", height: 18, marginBottom: 10 }}>
        {error
          ? <span style={{ fontSize: 12, color: "#c0392b" }}>{error}</span>
          : <span style={{ fontSize: 12, color: digits.length > 0 ? "#aaa" : "#ddd" }}>Enter jersey number</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => (
          <button key={d} style={keyStyle(false)} onClick={() => pressDigit(String(d))}>{d}</button>
        ))}
        <button style={keyStyle(true)} onClick={() => setDigits(prev => prev.slice(0, -1))}>⌫</button>
        <button style={keyStyle(false)} onClick={() => pressDigit("0")}>0</button>
        <button
          style={{ ...keyStyle(true), background: canUse ? "#111" : "#ccc", color: "#fff", fontWeight: 600, fontSize: 15 }}
          disabled={!canUse}
          onClick={() => canUse && onConfirm(digits)}>
          Add
        </button>
      </div>
      <button
        style={{ width: "100%", padding: "10px 0", fontSize: 13, color: "#888", background: "none", border: "1px solid #ddd", borderRadius: 10, cursor: "pointer" }}
        onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
