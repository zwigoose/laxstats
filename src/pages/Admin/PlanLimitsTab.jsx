import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

const PLANS = ["free", "pro", "max", "giga"];
const PLAN_LABELS = { free: "Free", pro: "Pro", max: "Max", giga: "Giga" };
const PLAN_COLORS = {
  free: "#888",
  pro:  "#1a6bab",
  max:  "#2a7a3b",
  giga: "#d4820a",
};

function limitDisplay(val) {
  if (val === null || val === undefined) return "∞";
  if (val === 0) return "off";
  return String(val);
}

function parseInput(str) {
  const s = str.trim();
  if (s === "" || s === "∞") return null;       // unlimited
  if (s === "off" || s === "0") return 0;        // disabled
  const n = parseInt(s, 10);
  return isNaN(n) || n < 0 ? null : n;
}

function LimitCell({ featureId, plan, value, onSave }) {
  const [editing, setEditing]   = useState(false);
  const [draft,   setDraft]     = useState("");
  const [saving,  setSaving]    = useState(false);
  const [error,   setError]     = useState(null);

  function startEdit() {
    setDraft(value === null ? "" : String(value));
    setEditing(true);
    setError(null);
  }

  async function commit() {
    const parsed = parseInput(draft);
    if (parsed === value) { setEditing(false); return; }
    setSaving(true);
    const { error: err } = await supabase.rpc("admin_set_plan_limit", {
      p_feature_id: featureId,
      p_plan:       plan,
      p_limit:      parsed,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSave(parsed);
    setEditing(false);
  }

  function onKeyDown(e) {
    if (e.key === "Enter")  commit();
    if (e.key === "Escape") setEditing(false);
  }

  const display = limitDisplay(value);
  const isOff   = value === 0;
  const isUnlim = value === null || value === undefined;

  if (editing) {
    return (
      <td style={{ padding: "6px 8px", textAlign: "center", verticalAlign: "middle" }}>
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
          placeholder="∞"
          style={{
            width: 52, padding: "3px 6px", fontSize: 13, fontWeight: 600,
            border: `1px solid ${error ? "#c0392b" : "#1a6bab"}`,
            borderRadius: 6, textAlign: "center", outline: "none",
            fontFamily: "system-ui, sans-serif",
            opacity: saving ? 0.5 : 1,
          }}
        />
        {error && <div style={{ fontSize: 10, color: "#c0392b", marginTop: 2 }}>{error}</div>}
      </td>
    );
  }

  return (
    <td
      onClick={startEdit}
      title="Click to edit"
      style={{
        padding: "6px 8px", textAlign: "center", verticalAlign: "middle",
        cursor: "pointer",
      }}
    >
      <span style={{
        display: "inline-block",
        minWidth: 36,
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: 13, fontWeight: 700,
        background: isOff ? "#f5f5f5" : isUnlim ? "#eaf6ec" : "#f0f0f0",
        color: isOff ? "#ccc" : isUnlim ? "#2a7a3b" : "#111",
        border: "1px solid transparent",
        transition: "border-color 0.1s",
      }}
        onMouseEnter={e => e.currentTarget.style.borderColor = "#ddd"}
        onMouseLeave={e => e.currentTarget.style.borderColor = "transparent"}
      >
        {display}
      </span>
    </td>
  );
}

export default function PlanLimitsTab() {
  const [features, setFeatures] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    supabase.rpc("admin_get_plan_features").then(({ data, error: err }) => {
      if (err) setError(err.message);
      else setFeatures(data || []);
      setLoading(false);
    });
  }, []);

  function handleSave(featureId, plan, newVal) {
    setFeatures(prev =>
      prev.map(f => f.feature_id === featureId ? { ...f, [`${plan}_limit`]: newVal } : f)
    );
  }

  if (loading) return <div style={{ textAlign: "center", padding: "48px 0", color: "#aaa", fontSize: 14 }}>Loading…</div>;
  if (error)   return <div style={{ background: "#fff5f5", border: "1px solid #fdd", borderRadius: 10, padding: "12px 16px", color: "#c0392b", fontSize: 13 }}>{error}</div>;

  return (
    <div>
      <div style={{ fontSize: 11, color: "#aaa", marginBottom: 16 }}>
        Click any cell to edit. <strong>∞</strong> = unlimited · <strong>off</strong> = disabled · positive integer = cap. Changes apply immediately.
      </div>
      <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "system-ui, sans-serif" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #f0f0f0", background: "#fafafa" }}>
              <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.07em" }}>Feature</th>
              {PLANS.map(p => (
                <th key={p} style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, fontSize: 11, color: PLAN_COLORS[p], textTransform: "uppercase", letterSpacing: "0.07em", width: 72 }}>
                  {PLAN_LABELS[p]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {features.map((f, i) => (
              <tr key={f.feature_id} style={{ borderBottom: i < features.length - 1 ? "1px solid #f5f5f5" : "none", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                <td style={{ padding: "10px 16px", verticalAlign: "middle" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{f.feature_id}</div>
                  <div style={{ fontSize: 11, color: "#aaa", marginTop: 1 }}>{f.description}</div>
                </td>
                {PLANS.map(plan => (
                  <LimitCell
                    key={plan}
                    featureId={f.feature_id}
                    plan={plan}
                    value={f[`${plan}_limit`]}
                    onSave={val => handleSave(f.feature_id, plan, val)}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
