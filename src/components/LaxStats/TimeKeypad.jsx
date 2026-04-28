import { useState } from "react";

function parseClockDigits(digits) {
  if (!digits) return { valid: false };
  if (!/^\d{1,4}$/.test(digits)) return { valid: false, error: "Enter up to 4 digits" };
  let minutes, seconds;
  if (digits.length <= 2) {
    minutes = 0;
    seconds = Number(digits);
  } else {
    seconds = Number(digits.slice(-2));
    minutes = Number(digits.slice(0, -2));
  }
  if (seconds > 59) return { valid: false, error: "Seconds must be 00–59" };
  const totalSeconds = minutes * 60 + seconds;
  return { valid: true, minutes, seconds, totalSeconds, label: `${minutes}:${String(seconds).padStart(2, "0")}` };
}

function timeStringToDigits(str) {
  const [m, s] = str.split(":").map(Number);
  return m === 0 ? String(s) : String(m) + String(s).padStart(2, "0");
}

export default function TimeKeypad({ maxSeconds, ceilingSecs, allowEqualToCeiling = false, onConfirm, showSameAsLatest = false, latestLabel = null }) {
  const [digits, setDigits] = useState("");
  const parsed = parseClockDigits(digits);
  const exceedsMax = parsed.valid && parsed.totalSeconds > maxSeconds;
  const violatesCeiling = parsed.valid && ceilingSecs != null && (
    allowEqualToCeiling ? parsed.totalSeconds > ceilingSecs : parsed.totalSeconds >= ceilingSecs
  );
  const canUse = parsed.valid && !exceedsMax && !violatesCeiling;

  const errorMsg = digits.length > 0 && !parsed.valid
    ? (parsed.error || "Invalid time")
    : exceedsMax
    ? `Max is ${Math.floor(maxSeconds / 60)}:${String(maxSeconds % 60).padStart(2, "0")}`
    : violatesCeiling
    ? `Must be ${allowEqualToCeiling ? "at or before" : "before"} ${Math.floor(ceilingSecs / 60)}:${String(ceilingSecs % 60).padStart(2, "0")}`
    : null;

  function pressDigit(d) {
    if (digits.length >= 4) return;
    setDigits(prev => prev + d);
  }

  const keyStyle = (special) => ({
    padding: "16px 0",
    fontSize: special ? 18 : 22,
    fontWeight: special ? 500 : 400,
    background: special ? "#f0f0f0" : "#f7f7f7",
    border: "1px solid #e8e8e8",
    borderRadius: 10,
    cursor: "pointer",
    color: "#111",
    fontFamily: "system-ui, sans-serif",
    userSelect: "none",
    WebkitUserSelect: "none",
  });

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ textAlign: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 48, fontWeight: 300, letterSpacing: "0.04em", fontVariantNumeric: "tabular-nums", color: canUse ? "#111" : digits.length > 0 ? "#111" : "#ccc" }}>
          {parsed.valid ? parsed.label : digits.length > 0 ? "—:——" : "--:--"}
        </span>
      </div>
      <div style={{ textAlign: "center", height: 18, marginBottom: 10 }}>
        {errorMsg
          ? <span style={{ fontSize: 12, color: "#c0392b" }}>{errorMsg}</span>
          : digits.length > 0
          ? <span style={{ fontSize: 12, color: "#aaa" }}>Typed: {digits}</span>
          : <span style={{ fontSize: 12, color: "#ddd" }}>Enter time remaining</span>}
      </div>
      {showSameAsLatest && latestLabel && (
        <button
          onClick={() => setDigits(timeStringToDigits(latestLabel))}
          style={{ width: "100%", marginBottom: 10, padding: "10px 0", fontSize: 13, fontWeight: 600, background: "#f0f8ff", border: "1px solid #c0d8f0", borderRadius: 10, cursor: "pointer", color: "#1a6bab" }}>
          Same as latest: {latestLabel}
        </button>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
        {[1,2,3,4,5,6,7,8,9].map(d => (
          <button key={d} style={keyStyle(false)} onClick={() => pressDigit(String(d))}>{d}</button>
        ))}
        <button style={keyStyle(true)} onClick={() => setDigits(prev => prev.slice(0, -1))}>⌫</button>
        <button style={keyStyle(false)} onClick={() => pressDigit("0")}>0</button>
        <button
          style={{ ...keyStyle(true), background: canUse ? "#111" : "#ccc", color: "#fff", fontWeight: 600, fontSize: 15 }}
          disabled={!canUse}
          onClick={() => canUse && onConfirm(parsed.label)}>
          Use
        </button>
      </div>
    </div>
  );
}
