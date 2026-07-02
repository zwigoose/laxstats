import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { C, F } from "../../styles/tokens";

const PLANS = ["pro", "max", "giga"];
const PLAN_LABELS = { pro: "Pro", max: "Max", giga: "Giga" };
const PLAN_COLORS = {
  pro:  C.blue600,
  max:  C.green600,
  giga: C.orange600,
};

const PERSONAL_PLANS = ["free", "basic", "plus"];
const PERSONAL_PLAN_LABELS = { free: "Free", basic: "Basic", plus: "Plus" };
const PERSONAL_PLAN_COLORS = { free: C.gray500, basic: C.blue600, plus: C.green600 };

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
            border: `1px solid ${error ? C.red600 : C.blue600}`,
            borderRadius: 6, textAlign: "center", outline: "none",
            fontFamily: F.ui,
            opacity: saving ? 0.5 : 1,
          }}
        />
        {error && <div style={{ fontSize: 10, color: C.red600, marginTop: 2 }}>{error}</div>}
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
        background: isOff ? C.gray50 : isUnlim ? C.green50 : C.gray75,
        color: isOff ? C.gray300 : isUnlim ? C.green600 : C.gray900,
        border: "1px solid transparent",
        transition: "border-color 0.1s",
      }}
        onMouseEnter={e => e.currentTarget.style.borderColor = C.gray250}
        onMouseLeave={e => e.currentTarget.style.borderColor = "transparent"}
      >
        {display}
      </span>
    </td>
  );
}

function PersonalLimitCell({ plan, value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState("");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);

  function startEdit() {
    setDraft(value === null ? "" : String(value));
    setEditing(true);
    setError(null);
  }

  async function commit() {
    const parsed = parseInput(draft);
    if (parsed === value) { setEditing(false); return; }
    setSaving(true);
    const { error: err } = await supabase.rpc("admin_set_personal_plan_limit", {
      p_plan:       plan,
      p_game_limit: parsed,
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
          autoFocus value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit} onKeyDown={onKeyDown}
          placeholder="∞"
          style={{
            width: 52, padding: "3px 6px", fontSize: 13, fontWeight: 600,
            border: `1px solid ${error ? C.red600 : C.blue600}`,
            borderRadius: 6, textAlign: "center", outline: "none",
            fontFamily: F.ui, opacity: saving ? 0.5 : 1,
          }}
        />
        {error && <div style={{ fontSize: 10, color: C.red600, marginTop: 2 }}>{error}</div>}
      </td>
    );
  }

  return (
    <td onClick={startEdit} title="Click to edit"
      style={{ padding: "6px 8px", textAlign: "center", verticalAlign: "middle", cursor: "pointer" }}>
      <span style={{
        display: "inline-block", minWidth: 36, padding: "2px 8px", borderRadius: 6,
        fontSize: 13, fontWeight: 700,
        background: isOff ? C.gray50 : isUnlim ? C.green50 : C.gray75,
        color: isOff ? C.gray300 : isUnlim ? C.green600 : C.gray900,
        border: "1px solid transparent", transition: "border-color 0.1s",
      }}
        onMouseEnter={e => e.currentTarget.style.borderColor = C.gray250}
        onMouseLeave={e => e.currentTarget.style.borderColor = "transparent"}
      >{display}</span>
    </td>
  );
}

export default function PlanLimitsTab() {
  const [features, setFeatures] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [personalLimits, setPersonalLimits] = useState([]);
  const [personalLoading, setPersonalLoading] = useState(true);

  useEffect(() => {
    supabase.rpc("admin_get_plan_features").then(({ data, error: err }) => {
      if (err) setError(err.message);
      else setFeatures(data || []);
      setLoading(false);
    });
    supabase.rpc("admin_get_personal_plan_limits").then(({ data }) => {
      setPersonalLimits(data || []);
      setPersonalLoading(false);
    });
  }, []);

  function handleSave(featureId, plan, newVal) {
    setFeatures(prev =>
      prev.map(f => f.feature_id === featureId ? { ...f, [`${plan}_limit`]: newVal } : f)
    );
  }

  function handlePersonalSave(plan, newVal) {
    setPersonalLimits(prev =>
      prev.map(r => r.plan === plan ? { ...r, game_limit: newVal } : r)
    );
  }

  if (loading) return <div style={{ textAlign: "center", padding: "48px 0", color: C.gray400, fontSize: 14 }}>Loading…</div>;
  if (error)   return <div style={{ background: C.red50, border: `1px solid ${C.red100}`, borderRadius: 10, padding: "12px 16px", color: C.red600, fontSize: 13 }}>{error}</div>;

  return (
    <div>
      <div style={{ fontSize: 11, color: C.gray400, marginBottom: 16 }}>
        Click any cell to edit. <strong>∞</strong> = unlimited · <strong>off</strong> = disabled · positive integer = cap. Changes apply immediately.
      </div>

      {/* Org plan limits */}
      <div style={{ fontSize: 12, fontWeight: 700, color: C.gray650, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Org Plans</div>
      <div style={{ background: C.white, border: `1px solid ${C.gray100}`, borderRadius: 14, overflow: "hidden", marginBottom: 24 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: F.ui }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${C.gray75}`, background: C.gray25 }}>
              <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, fontSize: 11, color: C.gray400, textTransform: "uppercase", letterSpacing: "0.07em" }}>Feature</th>
              {PLANS.map(p => (
                <th key={p} style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, fontSize: 11, color: PLAN_COLORS[p], textTransform: "uppercase", letterSpacing: "0.07em", width: 72 }}>
                  {PLAN_LABELS[p]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {features.map((f, i) => (
              <tr key={f.feature_id} style={{ borderBottom: i < features.length - 1 ? `1px solid ${C.gray50}` : "none", background: i % 2 === 0 ? C.white : C.gray25 }}>
                <td style={{ padding: "10px 16px", verticalAlign: "middle" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.gray900 }}>{f.feature_id}</div>
                  <div style={{ fontSize: 11, color: C.gray400, marginTop: 1 }}>{f.description}</div>
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

      {/* Personal plan limits */}
      <div style={{ fontSize: 12, fontWeight: 700, color: C.gray650, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Personal Plans</div>
      {personalLoading ? (
        <div style={{ fontSize: 13, color: C.gray400, padding: "8px 0" }}>Loading…</div>
      ) : (
        <div style={{ background: C.white, border: `1px solid ${C.gray100}`, borderRadius: 14, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: F.ui }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.gray75}`, background: C.gray25 }}>
                <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, fontSize: 11, color: C.gray400, textTransform: "uppercase", letterSpacing: "0.07em" }}>Limit</th>
                {PERSONAL_PLANS.map(p => (
                  <th key={p} style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, fontSize: 11, color: PERSONAL_PLAN_COLORS[p], textTransform: "uppercase", letterSpacing: "0.07em", width: 72 }}>
                    {PERSONAL_PLAN_LABELS[p]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: "10px 16px", verticalAlign: "middle" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.gray900 }}>game_limit</div>
                  <div style={{ fontSize: 11, color: C.gray400, marginTop: 1 }}>Max personal games per user</div>
                </td>
                {PERSONAL_PLANS.map(plan => {
                  const row = personalLimits.find(r => r.plan === plan);
                  return (
                    <PersonalLimitCell
                      key={plan}
                      plan={plan}
                      value={row?.game_limit ?? null}
                      onSave={val => handlePersonalSave(plan, val)}
                    />
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
