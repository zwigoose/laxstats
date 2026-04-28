import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { getGameInfo } from "../../utils/game";
import { PLANS, PLAN_STATUS, ORG_ROLES, BOOLEAN_FEATURES, PLAN_COLOR, STATUS_COLOR } from "../../constants/lacrosse";
import { displayName } from "./helpers";

export default function OrgCard({ org, users, onUpdated, onDeleted }) {
  const navigate = useNavigate();
  const [open, setOpen]               = useState(false);
  const [members, setMembers]         = useState([]);
  const [features, setFeatures]       = useState([]);
  const [teams, setTeams]             = useState([]);
  const [orgGames, setOrgGames]       = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError]             = useState(null);

  const [showNewTeam, setShowNewTeam]   = useState(false);
  const [newTeamName, setNewTeamName]   = useState("");
  const [newTeamColor, setNewTeamColor] = useState("#444444");
  const [creatingTeam, setCreatingTeam] = useState(false);

  const [showNewGame, setShowNewGame] = useState(false);
  const [gameOwner, setGameOwner]     = useState("");

  const [editPlan, setEditPlan]       = useState(false);
  const [plan, setPlan]               = useState(org.plan);
  const [planStatus, setPlanStatus]   = useState(org.plan_status);
  const [savingPlan, setSavingPlan]   = useState(false);

  const [addUsername, setAddUsername] = useState("");
  const [addRole, setAddRole]         = useState("viewer");
  const [addSearchResult, setAddSearchResult] = useState(null);
  const [addError, setAddError]       = useState(null);
  const [searching, setSearching]     = useState(false);
  const [adding, setAdding]           = useState(false);

  const [deleteStage, setDeleteStage] = useState(0);
  const [deleting, setDeleting]       = useState(false);

  async function loadDetail() {
    setLoadingDetail(true);
    const [mRes, fRes, tRes, gRes] = await Promise.all([
      supabase.rpc("admin_get_org_members", { p_org_id: org.id }),
      supabase.rpc("admin_get_org_features", { p_org_id: org.id }),
      supabase.from("teams").select("id, name, color").eq("org_id", org.id).order("name"),
      supabase.from("games").select("id, name, created_at, state, schema_ver, game_date, user_id, pressbox_enabled, multi_scorer_enabled").eq("org_id", org.id).order("created_at", { ascending: false }),
    ]);
    if (mRes.error) setError(mRes.error.message);
    else setMembers(mRes.data || []);
    if (fRes.data) setFeatures(fRes.data);
    if (tRes.data) setTeams(tRes.data);
    if (gRes.data) setOrgGames(gRes.data);
    setLoadingDetail(false);
  }

  async function handleCreateTeam() {
    if (!newTeamName.trim()) return;
    setCreatingTeam(true);
    const { data, error: err } = await supabase
      .from("teams")
      .insert({ name: newTeamName.trim(), color: newTeamColor, org_id: org.id })
      .select("id, name, color")
      .single();
    if (err) { setError(err.message); setCreatingTeam(false); return; }
    setTeams(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setNewTeamName(""); setNewTeamColor("#444444"); setShowNewTeam(false); setCreatingTeam(false);
    onUpdated({ ...org, team_count: Number(org.team_count) + 1 });
  }

  function handleCreateGame() {
    if (!gameOwner) return;
    const membership = { org_id: org.id, role: "org_admin", org: { id: org.id, name: org.name, slug: org.slug } };
    navigate("/games/new", { state: { orgMembership: membership, adminOwnerOverride: gameOwner } });
  }

  function toggle() { if (!open) loadDetail(); setOpen(o => !o); }

  async function savePlan() {
    setSavingPlan(true);
    const { error: err } = await supabase.rpc("admin_set_org_plan", { p_org_id: org.id, p_plan: plan, p_plan_status: planStatus });
    setSavingPlan(false);
    if (err) { setError(err.message); return; }
    setEditPlan(false);
    onUpdated({ ...org, plan, plan_status: planStatus });
  }

  async function handleSearch() {
    setSearching(true); setAddSearchResult(null); setAddError(null);
    const { data, error: err } = await supabase.rpc("find_user_by_username", { p_username: addUsername.trim() });
    if (err) { setAddError(err.message); setSearching(false); return; }
    if (!data?.length) { setAddError("User not found."); setSearching(false); return; }
    if (members.some(m => m.user_id === data[0].id)) { setAddError("Already a member."); setSearching(false); return; }
    setAddSearchResult(data[0]); setSearching(false);
  }

  async function handleAddMember() {
    if (!addSearchResult) return;
    setAdding(true);
    const { error: err } = await supabase.rpc("admin_add_org_member", { p_org_id: org.id, p_user_id: addSearchResult.id, p_role: addRole });
    if (err) { setAddError(err.message); setAdding(false); return; }
    setAddUsername(""); setAddRole("viewer"); setAddSearchResult(null);
    await loadDetail();
    setAdding(false);
    onUpdated({ ...org, member_count: Number(org.member_count) + 1 });
  }

  async function handleRoleChange(userId, newRole) {
    const { error: err } = await supabase.rpc("admin_set_org_member_role", { p_org_id: org.id, p_user_id: userId, p_role: newRole });
    if (err) setError(err.message);
    else setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, role: newRole } : m));
  }

  async function handleRemoveMember(userId) {
    const { error: err } = await supabase.rpc("admin_remove_org_member", { p_org_id: org.id, p_user_id: userId });
    if (err) setError(err.message);
    else { setMembers(prev => prev.filter(m => m.user_id !== userId)); onUpdated({ ...org, member_count: Math.max(0, Number(org.member_count) - 1) }); }
  }

  async function handleFeatureOverride(featureId, rawVal) {
    const val = rawVal === "" ? null : parseInt(rawVal, 10);
    const resolved = isNaN(val) ? null : val;
    const { error: err } = await supabase.rpc("admin_set_feature_override", { p_org_id: org.id, p_feature_id: featureId, p_override_limit: resolved });
    if (err) setError(err.message);
    else setFeatures(prev => prev.map(f => f.feature_id === featureId ? { ...f, override_limit: resolved } : f));
  }

  async function handleDelete() {
    setDeleting(true);
    const { error: err } = await supabase.rpc("admin_delete_org", { p_org_id: org.id });
    if (err) { setError(err.message); setDeleting(false); setDeleteStage(0); return; }
    onDeleted(org.id);
  }

  const pc  = PLAN_COLOR[org.plan] || PLAN_COLOR.free;
  const inp = { padding: "6px 9px", fontSize: 13, border: "1px solid #e0e0e0", borderRadius: 8, fontFamily: "system-ui, sans-serif", background: "#fff", boxSizing: "border-box" };

  return (
    <div style={{ border: "1px solid #e8e8e8", borderRadius: 14, marginBottom: 10, overflow: "hidden", background: "#fff", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer" }} onClick={toggle}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>{org.name}</span>
            <span style={{ fontSize: 11, color: "#aaa" }}>/{org.slug}</span>
            <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "2px 7px", background: pc.bg, color: pc.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>{org.plan}</span>
            <span style={{ fontSize: 11, color: STATUS_COLOR[org.plan_status] || "#888" }}>{org.plan_status}</span>
          </div>
          <div style={{ fontSize: 12, color: "#aaa", marginTop: 3 }}>
            {org.member_count} member{org.member_count !== 1 ? "s" : ""} · {org.game_count} game{org.game_count !== 1 ? "s" : ""} · {org.season_count} season{org.season_count !== 1 ? "s" : ""} · {org.team_count} team{org.team_count !== 1 ? "s" : ""}
          </div>
        </div>
        <div style={{ fontSize: 14, color: "#ccc", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>›</div>
      </div>

      {open && (
        <div style={{ borderTop: "1px solid #f0f0f0", padding: "16px" }}>
          {error && <div style={{ background: "#fff5f5", border: "1px solid #fdd", borderRadius: 8, padding: "8px 12px", color: "#c0392b", fontSize: 12, marginBottom: 12 }}>{error}</div>}
          {loadingDetail ? (
            <div style={{ color: "#aaa", fontSize: 13 }}>Loading…</div>
          ) : (
            <>
              {/* Plan */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Plan</div>
                {!editPlan ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 13, color: "#111" }}>{org.plan} · {org.plan_status}</span>
                    <button onClick={() => setEditPlan(true)} style={{ fontSize: 12, color: "#1a6bab", background: "none", border: "1px solid #c0d8f0", borderRadius: 6, padding: "2px 9px", cursor: "pointer" }}>Edit</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <select value={plan} onChange={e => setPlan(e.target.value)} style={{ ...inp }}>
                      {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <select value={planStatus} onChange={e => setPlanStatus(e.target.value)} style={{ ...inp }}>
                      {PLAN_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button onClick={savePlan} disabled={savingPlan} style={{ padding: "6px 14px", fontSize: 13, fontWeight: 600, background: "#111", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>{savingPlan ? "…" : "Save"}</button>
                    <button onClick={() => { setEditPlan(false); setPlan(org.plan); setPlanStatus(org.plan_status); }} style={{ padding: "6px 12px", fontSize: 13, background: "transparent", border: "1px solid #e0e0e0", borderRadius: 8, cursor: "pointer", color: "#555" }}>Cancel</button>
                  </div>
                )}
              </div>

              {/* Members */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Members</div>
                {members.length === 0 ? (
                  <div style={{ fontSize: 13, color: "#aaa", marginBottom: 10 }}>No members.</div>
                ) : (
                  <div style={{ marginBottom: 10 }}>
                    {members.map(m => (
                      <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid #f5f5f5" }}>
                        <span style={{ flex: 1, fontSize: 13, color: "#111" }}>{displayName(m.email)}</span>
                        <select value={m.role} onChange={e => handleRoleChange(m.user_id, e.target.value)} style={{ ...inp, padding: "4px 7px", fontSize: 12 }}>
                          {ORG_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <button onClick={() => handleRemoveMember(m.user_id)}
                          style={{ fontSize: 11, color: "#c0392b", background: "none", border: "1px solid #f0a0a0", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>Remove</button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <input style={{ ...inp, flex: 1, minWidth: 120 }} placeholder="Username or email" value={addUsername}
                    autoCapitalize="off" autoCorrect="off"
                    onChange={e => { setAddUsername(e.target.value); setAddSearchResult(null); setAddError(null); }}
                    onKeyDown={e => e.key === "Enter" && addUsername.trim() && handleSearch()} />
                  <select value={addRole} onChange={e => setAddRole(e.target.value)} style={{ ...inp }}>
                    {ORG_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {!addSearchResult ? (
                    <button onClick={handleSearch} disabled={!addUsername.trim() || searching}
                      style={{ padding: "6px 12px", fontSize: 13, fontWeight: 600, background: addUsername.trim() ? "#111" : "#ccc", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
                      {searching ? "…" : "Find"}
                    </button>
                  ) : (
                    <button onClick={handleAddMember} disabled={adding}
                      style={{ padding: "6px 12px", fontSize: 13, fontWeight: 600, background: "#2a7a3b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
                      {adding ? "…" : `Add ${addSearchResult.display_name}`}
                    </button>
                  )}
                </div>
                {addError && <div style={{ fontSize: 12, color: "#c0392b", marginTop: 4 }}>{addError}</div>}
              </div>

              {/* Feature overrides */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Feature Limits</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "6px 12px", alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#aaa" }}>Feature</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#aaa" }}>Plan default</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#aaa" }}>Override</span>
                  {features.map(f => {
                    const isBool = BOOLEAN_FEATURES.has(f.feature_id);
                    const planLabel = isBool
                      ? (f.plan_limit === 0 ? "false" : "true")
                      : (f.plan_limit === null ? "∞" : f.plan_limit === 0 ? "off" : String(f.plan_limit));
                    return (
                      <>
                        <span key={f.feature_id + "_n"} style={{ fontSize: 13, color: "#111" }}>{f.description || f.feature_id}</span>
                        <span key={f.feature_id + "_p"} style={{ fontSize: 12, color: "#aaa", textAlign: "right" }}>{planLabel}</span>
                        {isBool ? (
                          <select key={f.feature_id + "_o"} value={f.override_limit === null ? "" : String(f.override_limit)}
                            onChange={e => handleFeatureOverride(f.feature_id, e.target.value)}
                            style={{ ...inp, padding: "4px 6px", fontSize: 12, minWidth: 90 }}>
                            <option value="">Plan default</option>
                            <option value="1">true</option>
                            <option value="0">false</option>
                          </select>
                        ) : (
                          <input key={f.feature_id + "_o"} style={{ ...inp, width: 64, textAlign: "center", padding: "4px 6px", fontSize: 12 }}
                            placeholder="—" defaultValue={f.override_limit ?? ""}
                            onBlur={e => handleFeatureOverride(f.feature_id, e.target.value)} />
                        )}
                      </>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11, color: "#bbb", marginTop: 6 }}>
                  Boolean features: Plan default / true / false. Numeric: blank = plan default, number = override limit.
                </div>
              </div>

              {/* Teams */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em" }}>Teams</div>
                  {!showNewTeam && (
                    <button onClick={() => setShowNewTeam(true)}
                      style={{ fontSize: 12, fontWeight: 600, color: "#1a6bab", background: "none", border: "1px solid #c0d8f0", borderRadius: 6, padding: "2px 9px", cursor: "pointer" }}>+ New Team</button>
                  )}
                </div>
                {teams.length === 0 && !showNewTeam && <div style={{ fontSize: 13, color: "#aaa", marginBottom: 8 }}>No teams yet.</div>}
                {teams.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    {teams.map(t => (
                      <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #f5f5f5" }}>
                        <div style={{ width: 12, height: 12, borderRadius: "50%", background: t.color || "#888", flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: "#111", flex: 1 }}>{t.name}</span>
                        <button onClick={() => navigate(`/orgs/${org.slug}/teams`)}
                          style={{ fontSize: 11, color: "#555", background: "none", border: "1px solid #ddd", borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}>Manage</button>
                      </div>
                    ))}
                  </div>
                )}
                {showNewTeam && (
                  <div style={{ background: "#f7f7f7", borderRadius: 10, padding: "12px 14px", border: "1px solid #e8e8e8" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <input style={{ ...inp, flex: 1, minWidth: 120 }} placeholder="Team name" value={newTeamName}
                        onChange={e => setNewTeamName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCreateTeam()} autoFocus />
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 24, height: 24, borderRadius: "50%", background: newTeamColor, border: "1px solid #ddd", flexShrink: 0 }} />
                        <input type="color" value={newTeamColor} onChange={e => setNewTeamColor(e.target.value)}
                          style={{ width: 36, height: 28, padding: 2, border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", background: "#fff" }} title="Team color" />
                      </div>
                      <button onClick={handleCreateTeam} disabled={!newTeamName.trim() || creatingTeam}
                        style={{ padding: "6px 14px", fontSize: 13, fontWeight: 600, background: newTeamName.trim() && !creatingTeam ? "#111" : "#ccc", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", flexShrink: 0 }}>
                        {creatingTeam ? "…" : "Create"}
                      </button>
                      <button onClick={() => { setShowNewTeam(false); setNewTeamName(""); setNewTeamColor("#444444"); }}
                        style={{ padding: "6px 10px", fontSize: 13, background: "transparent", border: "1px solid #e0e0e0", borderRadius: 8, cursor: "pointer", color: "#555", flexShrink: 0 }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Games */}
              {orgGames.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Games</div>
                  {orgGames.map(g => {
                    const info = getGameInfo(g);
                    const started = info?.started && !info?.gameOver;
                    const over = info?.gameOver;
                    return (
                      <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid #f5f5f5" }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: over ? "#ccc" : started ? "#2a7a3b" : "#f0a500" }} />
                        <span style={{ flex: 1, fontSize: 13, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {g.name || (info ? `${info.t0?.name} vs ${info.t1?.name}` : "Untitled")}
                        </span>
                        <span style={{ fontSize: 11, color: "#bbb", flexShrink: 0 }}>{over ? "Final" : started ? "Live" : "Pending"}</span>
                        {!over && (
                          <button onClick={() => navigate(`/games/${g.id}/score`)}
                            style={{ padding: "3px 10px", fontSize: 11, fontWeight: 700, background: "#111", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", flexShrink: 0 }}>
                            {started ? "Score" : "Setup"}
                          </button>
                        )}
                        <button onClick={() => navigate(`/games/${g.id}/view`)}
                          style={{ padding: "3px 10px", fontSize: 11, fontWeight: 600, background: "transparent", color: "#555", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", flexShrink: 0 }}>View</button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Create Game */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Create Game</div>
                {!showNewGame ? (
                  <button onClick={() => setShowNewGame(true)}
                    style={{ padding: "6px 14px", fontSize: 13, fontWeight: 600, background: "#111", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
                    + New Game in {org.name}
                  </button>
                ) : (
                  <div style={{ background: "#f7f7f7", borderRadius: 10, padding: "12px 14px", border: "1px solid #e8e8e8" }}>
                    <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>Owner — org admin, coach, or scorekeeper</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <select value={gameOwner} onChange={e => setGameOwner(e.target.value)} style={{ ...inp, flex: 1 }}>
                        <option value="">Select member…</option>
                        {members.filter(m => ["org_admin", "coach", "scorekeeper"].includes(m.role))
                          .map(m => <option key={m.user_id} value={m.user_id}>{displayName(m.email)} — {m.role.replace("org_", "")}</option>)}
                      </select>
                      <button onClick={handleCreateGame} disabled={!gameOwner}
                        style={{ padding: "6px 14px", fontSize: 13, fontWeight: 600, background: gameOwner ? "#111" : "#ccc", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", flexShrink: 0 }}>
                        Go to Setup →
                      </button>
                      <button onClick={() => { setShowNewGame(false); setGameOwner(""); }}
                        style={{ padding: "6px 10px", fontSize: 13, background: "transparent", border: "1px solid #e0e0e0", borderRadius: 8, cursor: "pointer", color: "#555", flexShrink: 0 }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Danger zone */}
              <div style={{ borderTop: "1px solid #f5f5f5", paddingTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#c0392b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Danger Zone</div>
                {deleteStage === 0 && (
                  <button onClick={() => setDeleteStage(1)} style={{ padding: "6px 14px", fontSize: 13, color: "#c0392b", background: "transparent", border: "1px solid #f0a0a0", borderRadius: 8, cursor: "pointer" }}>Delete org…</button>
                )}
                {deleteStage === 1 && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "#c0392b" }}>Delete <strong>{org.name}</strong> and all its data?</span>
                    <button onClick={() => setDeleteStage(0)} style={{ padding: "5px 12px", fontSize: 12, background: "transparent", border: "1px solid #ddd", borderRadius: 7, cursor: "pointer", color: "#555" }}>Cancel</button>
                    <button onClick={() => setDeleteStage(2)} style={{ padding: "5px 12px", fontSize: 12, color: "#c0392b", background: "transparent", border: "1px solid #e08080", borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>Delete</button>
                  </div>
                )}
                {deleteStage === 2 && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "#c0392b", fontWeight: 600 }}>Cannot be undone. Confirm?</span>
                    <button onClick={() => setDeleteStage(0)} style={{ padding: "5px 12px", fontSize: 12, background: "transparent", border: "1px solid #ddd", borderRadius: 7, cursor: "pointer", color: "#555" }}>Cancel</button>
                    <button onClick={handleDelete} disabled={deleting} style={{ padding: "5px 12px", fontSize: 12, background: "#c0392b", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>{deleting ? "…" : "Yes, delete"}</button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
