import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import RosterEditor from "../../components/RosterEditor";
import { displayName } from "./helpers";
import AdminSharePanel from "./AdminSharePanel";
import OwnerSelect from "./OwnerSelect";

function playerCount(roster) {
  if (!roster) return 0;
  return roster.split("\n").map(l => l.trim()).filter(Boolean).length;
}

export default function RostersAdminTab() {
  const [rosters, setRosters]           = useState([]);
  const [users, setUsers]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [expandedOwner, setExpandedOwner]   = useState(null);
  const [editingRosterId, setEditingRosterId] = useState(null);
  const [showNew, setShowNew]           = useState(false);
  const [newForUserId, setNewForUserId] = useState("");

  useEffect(() => {
    Promise.all([
      supabase.rpc("admin_get_all_rosters"),
      supabase.rpc("admin_get_users"),
    ]).then(([rostersRes, usersRes]) => {
      if (rostersRes.error) setError(rostersRes.error.message);
      else setRosters(rostersRes.data || []);
      setUsers(usersRes.data || []);
      setLoading(false);
    });
  }, []);

  const userMap = useMemo(() => {
    const m = {};
    users.forEach(u => { m[u.id] = u; });
    return m;
  }, [users]);

  const byOwner = useMemo(() => {
    const map = {};
    rosters.forEach(r => {
      const key = r.user_id || "unowned";
      if (!map[key]) map[key] = { owner_name: r.owner_name || "Unowned", rosters: [] };
      map[key].rosters.push(r);
    });
    return Object.entries(map);
  }, [rosters]);

  async function handleCreate(fields) {
    if (!newForUserId) return;
    const { data, error: err } = await supabase.rpc("admin_create_roster", {
      p_user_id: newForUserId, p_name: fields.name, p_roster: fields.roster, p_color: fields.color,
    });
    if (err) { setError(err.message); return; }
    const { data: fresh } = await supabase.rpc("admin_get_all_rosters");
    if (fresh) setRosters(fresh);
    setShowNew(false); setNewForUserId("");
    setExpandedOwner(newForUserId);
  }

  async function handleUpdate(rosterId, fields) {
    const { error: err } = await supabase.from("saved_teams").update(fields).eq("id", rosterId);
    if (err) { setError(err.message); return; }
    setRosters(prev => prev.map(r => r.id === rosterId ? { ...r, ...fields } : r));
    setEditingRosterId(null);
  }

  async function handleReassignRoster(rosterId, newUserId) {
    const { error: err } = await supabase.rpc("admin_reassign_roster", { p_roster_id: rosterId, p_user_id: newUserId });
    if (err) { setError(err.message); return; }
    const { data: fresh } = await supabase.rpc("admin_get_all_rosters");
    if (fresh) setRosters(fresh);
    setEditingRosterId(null);
  }

  if (loading) return <div style={{ textAlign: "center", padding: "48px 0", color: "#aaa", fontSize: 14 }}>Loading…</div>;
  if (error)   return <div style={{ background: "#fff5f5", border: "1px solid #fdd", borderRadius: 10, padding: "12px 16px", color: "#c0392b", fontSize: 13 }}>{error}</div>;

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        {!showNew ? (
          <button onClick={() => setShowNew(true)}
            style={{ padding: "7px 16px", fontSize: 13, fontWeight: 600, background: "#111", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer" }}>
            + New Roster for User
          </button>
        ) : (
          <div style={{ border: "1px solid #e0e0e0", borderRadius: 14, padding: 16, background: "#fafafa" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>New Roster</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Owner</label>
              <select value={newForUserId} onChange={e => setNewForUserId(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #e0e0e0", borderRadius: 8, background: "#fff", boxSizing: "border-box" }}>
                <option value="">Select user…</option>
                {users.map(u => <option key={u.id} value={u.id}>{displayName(u.email)}</option>)}
              </select>
            </div>
            {newForUserId && (
              <RosterEditor isNew onSave={handleCreate} onCancel={() => { setShowNew(false); setNewForUserId(""); }} />
            )}
            {!newForUserId && (
              <button onClick={() => { setShowNew(false); setNewForUserId(""); }}
                style={{ padding: "8px 14px", fontSize: 13, background: "transparent", border: "1px solid #e0e0e0", borderRadius: 8, cursor: "pointer", color: "#555" }}>Cancel</button>
            )}
          </div>
        )}
      </div>

      {rosters.length === 0 && <div style={{ textAlign: "center", padding: "48px 0", color: "#aaa", fontSize: 14 }}>No rosters yet.</div>}

      {byOwner.map(([ownerId, { owner_name, rosters: ownerRosters }]) => {
        const open = expandedOwner === ownerId;
        return (
          <div key={ownerId} style={{ border: "1px solid #e8e8e8", borderRadius: 14, marginBottom: 10, overflow: "hidden", background: "#fff", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer" }}
              onClick={() => { setExpandedOwner(open ? null : ownerId); setEditingRosterId(null); }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#111" }}>{owner_name}</div>
                <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>{ownerRosters.length} roster{ownerRosters.length !== 1 ? "s" : ""}</div>
              </div>
              <div style={{ fontSize: 14, color: "#ccc", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>›</div>
            </div>
            {open && (
              <div style={{ borderTop: "1px solid #f0f0f0", padding: "10px 16px 14px" }}>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  {ownerRosters.map(r => {
                    const editing = editingRosterId === r.id;
                    return (
                      <li key={r.id} style={{ background: "#fafafa", borderRadius: 9, border: "1px solid #efefef", overflow: "hidden" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", cursor: "pointer" }}
                          onClick={() => setEditingRosterId(editing ? null : r.id)}>
                          <div style={{ width: 20, height: 20, borderRadius: "50%", background: r.color, flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{r.name}</div>
                            <div style={{ fontSize: 11, color: "#aaa" }}>{playerCount(r.roster)} players</div>
                          </div>
                          <div style={{ fontSize: 12, color: "#aaa", transform: editing ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>›</div>
                        </div>
                        {editing && (
                          <div style={{ padding: "0 12px 12px", borderTop: "1px solid #efefef" }}>
                            <RosterEditor initial={r} onSave={(fields) => handleUpdate(r.id, fields)} onCancel={() => setEditingRosterId(null)} />
                            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px dashed #e8e8e8" }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Owner</div>
                              <OwnerSelect currentUserId={r.user_id} users={users} onSave={(newUserId) => handleReassignRoster(r.id, newUserId)} />
                            </div>
                            <AdminSharePanel rosterId={r.id} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
