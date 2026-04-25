import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const input = {
  width: "100%", padding: "10px 12px", fontSize: 15,
  border: "1px solid #e0e0e0", borderRadius: 10, background: "#fff",
  boxSizing: "border-box", fontFamily: "system-ui, sans-serif",
  outline: "none",
};
const label = {
  display: "block", fontSize: 11, fontWeight: 700, color: "#888",
  textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6,
};

export default function CreateOrg() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [name, setName]             = useState("");
  const [slug, setSlug]             = useState("");
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
      .insert({ name: name.trim(), slug: slug.trim(), created_by: user.id })
      .select("id, slug")
      .single();

    if (orgErr) { setError(orgErr.message); setSaving(false); return; }

    const { error: memberErr } = await supabase
      .from("org_members")
      .insert({ org_id: org.id, user_id: user.id, role: "org_admin" });

    if (memberErr) { setError(memberErr.message); setSaving(false); return; }

    navigate(`/orgs/${org.slug}`);
  }

  const canSubmit = name.trim() && slug.trim() && !saving;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", minHeight: "100vh", background: "#f5f5f5" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "32px 20px" }}>
        <button onClick={() => navigate("/")}
          style={{ fontSize: 13, color: "#888", background: "none", border: "none", cursor: "pointer", padding: "0 0 28px", display: "block" }}>
          ← Back
        </button>

        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#111", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
          New Organization
        </h1>
        <p style={{ fontSize: 14, color: "#888", margin: "0 0 28px", lineHeight: 1.5 }}>
          Manage teams, seasons, and scorekeepers across all your games.
        </p>

        {error && (
          <div style={{ background: "#fff5f5", border: "1px solid #fdd", borderRadius: 10, padding: "10px 14px", color: "#c0392b", fontSize: 13, marginBottom: 16 }}>
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

        <div style={{ marginBottom: 28 }}>
          <span style={label}>URL slug</span>
          <div style={{ display: "flex", alignItems: "center", border: "1px solid #e0e0e0", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
            <span style={{ padding: "10px 8px 10px 12px", fontSize: 14, color: "#bbb", whiteSpace: "nowrap", userSelect: "none" }}>/orgs/</span>
            <input
              style={{ ...input, border: "none", borderRadius: 0, flex: 1, padding: "10px 12px 10px 0" }}
              value={slug}
              onChange={e => handleSlugChange(e.target.value)}
              onKeyDown={e => e.key === "Enter" && canSubmit && handleSubmit()}
              placeholder="notre-dame-prep"
            />
          </div>
          <div style={{ fontSize: 11, color: "#bbb", marginTop: 5 }}>Lowercase letters, numbers, and hyphens · cannot be changed later</div>
        </div>

        <button onClick={handleSubmit} disabled={!canSubmit}
          style={{
            width: "100%", padding: "13px", fontSize: 15, fontWeight: 700,
            background: canSubmit ? "#111" : "#ccc", color: "#fff",
            border: "none", borderRadius: 12, cursor: canSubmit ? "pointer" : "not-allowed",
          }}>
          {saving ? "Creating…" : "Create Organization →"}
        </button>
      </div>
    </div>
  );
}
