import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { PLANS } from "../../constants/lacrosse";
import { displayName } from "./helpers";
import OrgCard from "./OrgCard";

function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function OrgsTab() {
  const [orgs, setOrgs]       = useState([]);
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const [showCreate, setShowCreate]   = useState(false);
  const [newName, setNewName]         = useState("");
  const [newSlug, setNewSlug]         = useState("");
  const [newOwner, setNewOwner]       = useState("");
  const [newPlan, setNewPlan]         = useState("free");
  const [creating, setCreating]       = useState(false);
  const [createError, setCreateError] = useState(null);
  const [slugEdited, setSlugEdited]   = useState(false);

  const inp = { padding: "7px 10px", fontSize: 13, border: "1px solid #e0e0e0", borderRadius: 8, fontFamily: "system-ui, sans-serif", background: "#fff", boxSizing: "border-box" };

  useEffect(() => {
    Promise.all([
      supabase.rpc("admin_get_orgs"),
      supabase.rpc("admin_get_users"),
    ]).then(([orgsRes, usersRes]) => {
      if (orgsRes.error) setError(orgsRes.error.message);
      else setOrgs(orgsRes.data || []);
      setUsers(usersRes.data || []);
      setLoading(false);
    });
  }, []);

  function handleNameChange(val) {
    setNewName(val);
    if (!slugEdited) setNewSlug(slugify(val));
  }

  async function handleCreateOrg(e) {
    e.preventDefault();
    if (!newName.trim() || !newSlug.trim() || !newOwner) return;
    setCreating(true); setCreateError(null);

    const { data: orgRow, error: orgErr } = await supabase
      .from("organizations")
      .insert({ name: newName.trim(), slug: newSlug.trim(), plan: newPlan, plan_status: "active" })
      .select("id, slug, name, plan, plan_status")
      .single();
    if (orgErr) { setCreateError(orgErr.message); setCreating(false); return; }

    const { error: memberErr } = await supabase
      .from("org_members")
      .insert({ org_id: orgRow.id, user_id: newOwner, role: "org_admin" });
    if (memberErr) { setCreateError(memberErr.message); setCreating(false); return; }

    const { data: fresh } = await supabase.rpc("admin_get_orgs");
    if (fresh) setOrgs(fresh);

    setShowCreate(false);
    setNewName(""); setNewSlug(""); setNewOwner(""); setNewPlan("free"); setSlugEdited(false);
    setCreating(false);
  }

  if (loading) return <div style={{ textAlign: "center", padding: "48px 0", color: "#aaa", fontSize: 14 }}>Loading…</div>;
  if (error)   return <div style={{ background: "#fff5f5", border: "1px solid #fdd", borderRadius: 10, padding: "12px 16px", color: "#c0392b", fontSize: 13 }}>{error}</div>;

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ marginBottom: 16 }}>
        {!showCreate ? (
          <button onClick={() => setShowCreate(true)}
            style={{ padding: "7px 16px", fontSize: 13, fontWeight: 600, background: "#111", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer" }}>
            + Create Org
          </button>
        ) : (
          <div style={{ border: "1px solid #e0e0e0", borderRadius: 14, padding: 16, background: "#fafafa", marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>New Organization</div>
            <form onSubmit={handleCreateOrg}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Name</label>
                  <input style={{ ...inp, width: "100%" }} value={newName} onChange={e => handleNameChange(e.target.value)} placeholder="My League" required />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Slug</label>
                  <input style={{ ...inp, width: "100%", fontFamily: "monospace" }} value={newSlug}
                    onChange={e => { setNewSlug(e.target.value); setSlugEdited(true); }}
                    placeholder="my-league" required pattern="[a-z0-9\-]+" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Owner</label>
                  <select style={{ ...inp, width: "100%" }} value={newOwner} onChange={e => setNewOwner(e.target.value)} required>
                    <option value="">Select user…</option>
                    {users.map(u => <option key={u.id} value={u.id}>{displayName(u.email)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Plan</label>
                  <select style={{ ...inp, width: "100%" }} value={newPlan} onChange={e => setNewPlan(e.target.value)}>
                    {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              {createError && (
                <div style={{ background: "#fff5f5", border: "1px solid #fdd", borderRadius: 8, padding: "8px 12px", color: "#c0392b", fontSize: 12, marginBottom: 10 }}>{createError}</div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => { setShowCreate(false); setCreateError(null); setNewName(""); setNewSlug(""); setNewOwner(""); setSlugEdited(false); }}
                  style={{ padding: "8px 14px", fontSize: 13, background: "transparent", border: "1px solid #e0e0e0", borderRadius: 8, cursor: "pointer", color: "#555" }}>Cancel</button>
                <button type="submit" disabled={!newName.trim() || !newSlug.trim() || !newOwner || creating}
                  style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, background: (!newName.trim() || !newSlug.trim() || !newOwner || creating) ? "#ccc" : "#111", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
                  {creating ? "Creating…" : "Create Org"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {orgs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#aaa", fontSize: 14 }}>No organizations yet.</div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: "#aaa", marginBottom: 12 }}>{orgs.length} org{orgs.length !== 1 ? "s" : ""}</div>
          {orgs.map(org => (
            <OrgCard
              key={org.id}
              org={org}
              users={users}
              onUpdated={updated => setOrgs(prev => prev.map(o => o.id === updated.id ? { ...o, ...updated } : o))}
              onDeleted={id => setOrgs(prev => prev.filter(o => o.id !== id))}
            />
          ))}
        </>
      )}
    </div>
  );
}
