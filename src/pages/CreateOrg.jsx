import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useDocTitle } from "../hooks/useDocTitle";
import { ColorPicker, PRESET_COLORS } from "./TeamManager";
import { C, F } from "../styles/tokens";

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const input = {
  width: "100%", padding: "10px 12px", fontSize: 15,
  border: `1px solid ${C.gray200}`, borderRadius: 10, background: C.white,
  boxSizing: "border-box", fontFamily: F.ui,
  outline: "none",
};
const label = {
  display: "block", fontSize: 11, fontWeight: 700, color: C.gray500,
  textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6,
};

export default function CreateOrg() {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  useDocTitle("New Organization");
  const [name, setName]             = useState("");
  const [slug, setSlug]             = useState("");
  const [color, setColor]           = useState(PRESET_COLORS[0]);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState(null);

  function handleNameChange(val) {
    setName(val);
    if (!slugTouched) setSlug(slugify(val));
  }

  function handleSlugChange(val) {
    setSlugTouched(true);
    setSlug(slugify(val));
  }

  async function handleSubmit() {
    if (!name.trim() || !slug.trim() || saving) return;
    setSaving(true);
    setError(null);

    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .insert({ name: name.trim(), slug: slug.trim(), color, created_by: user.id })
      .select("id, slug")
      .single();

    if (orgErr) { setError(orgErr.message); setSaving(false); return; }

    const { error: memberErr } = await supabase
      .from("org_members")
      .insert({ org_id: org.id, user_id: user.id, role: "org_admin" });

    if (memberErr) {
      const msg = memberErr.message.includes("org_members_user_id_unique")
        ? "You are already a member of another organization. Each user can only belong to one org."
        : memberErr.message;
      setError(msg); setSaving(false); return;
    }

    navigate(`/orgs/${org.slug}`);
  }

  const canSubmit = name.trim() && slug.trim() && !saving;

  if (!loading && !isAdmin) {
    navigate("/orgs", { replace: true });
    return null;
  }

  return (
    <div style={{ fontFamily: F.ui, minHeight: "100vh", background: C.gray50 }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "32px 20px" }}>
        <button onClick={() => navigate("/")}
          style={{ fontSize: 13, color: C.gray500, background: "none", border: "none", cursor: "pointer", padding: "0 0 28px", display: "block" }}>
          ← Back
        </button>

        <h1 style={{ fontSize: 24, fontWeight: 800, color: C.gray900, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
          New Organization
        </h1>
        <p style={{ fontSize: 14, color: C.gray500, margin: "0 0 28px", lineHeight: 1.5 }}>
          Manage teams, seasons, and scorekeepers across all your games.
        </p>

        {error && (
          <div style={{ background: C.red50, border: `1px solid ${C.red100}`, borderRadius: 10, padding: "10px 14px", color: C.red600, fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: 18 }}>
          <span style={label}>Organization name</span>
          <input style={input} value={name} autoFocus
            onChange={e => handleNameChange(e.target.value)}
            onKeyDown={e => e.key === "Enter" && canSubmit && handleSubmit()}
            placeholder="Notre Dame Prep" />
        </div>

        <div style={{ marginBottom: 20 }}>
          <span style={label}>Org color</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: color, border: `2px solid ${C.gray200}`, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: C.gray500, fontFamily: F.mono }}>{color}</span>
          </div>
          <ColorPicker value={color} onChange={setColor} />
        </div>

        <div style={{ marginBottom: 28 }}>
          <span style={label}>URL slug</span>
          <div style={{ display: "flex", alignItems: "center", border: `1px solid ${C.gray200}`, borderRadius: 10, overflow: "hidden", background: C.white }}>
            <span style={{ padding: "10px 8px 10px 12px", fontSize: 14, color: C.gray350, whiteSpace: "nowrap", userSelect: "none" }}>/orgs/</span>
            <input
              style={{ ...input, border: "none", borderRadius: 0, flex: 1, padding: "10px 12px 10px 0" }}
              value={slug}
              onChange={e => handleSlugChange(e.target.value)}
              onKeyDown={e => e.key === "Enter" && canSubmit && handleSubmit()}
              placeholder="notre-dame-prep"
            />
          </div>
          <div style={{ fontSize: 11, color: C.gray350, marginTop: 5 }}>Lowercase letters, numbers, and hyphens · cannot be changed later</div>
        </div>

        <button onClick={handleSubmit} disabled={!canSubmit}
          style={{
            width: "100%", padding: "13px", fontSize: 15, fontWeight: 700,
            background: canSubmit ? C.gray900 : C.gray300, color: C.white,
            border: "none", borderRadius: 12, cursor: canSubmit ? "pointer" : "not-allowed",
          }}>
          {saving ? "Creating…" : "Create Organization →"}
        </button>
      </div>
    </div>
  );
}
