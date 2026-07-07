import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { getGameInfo } from "../../utils/game";
import { PLANS, PLAN_STATUS, ORG_ROLES, BOOLEAN_FEATURES, PLAN_COLOR, STATUS_COLOR } from "../../constants/lacrosse";
import { displayName } from "./helpers";
import { ColorPicker, PRESET_COLORS, OrgLogoSection } from "../TeamManager";
import { C, F, SH } from "../../styles/tokens";

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
  const [creatingTeam, setCreatingTeam] = useState(false);

  const [orgColor, setOrgColor]         = useState(org.color || PRESET_COLORS[0]);
  const [editingColor, setEditingColor] = useState(false);
  const [savingColor, setSavingColor]   = useState(false);
  const [orgLogoUrl, setOrgLogoUrl]     = useState(org.logo_url || null);

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
      supabase.from("games").select("id, name, created_at, state, summary, schema_ver, game_date, user_id, pressbox_enabled, multi_scorer_enabled").eq("org_id", org.id).order("created_at", { ascending: false }),
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
      .insert({ name: newTeamName.trim(), org_id: org.id })
      .select("id, name, color")
      .single();
    if (err) { setError(err.message); setCreatingTeam(false); return; }
    setTeams(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setNewTeamName(""); setShowNewTeam(false); setCreatingTeam(false);
    onUpdated({ ...org, team_count: Number(org.team_count) + 1 });
  }

  async function handleSaveOrgColor(color) {
    setSavingColor(true);
    const { error: err } = await supabase.from("organizations").update({ color }).eq("id", org.id);
    setSavingColor(false);
    if (err) { setError(err.message); return; }
    setOrgColor(color);
    setTeams(prev => prev.map(t => ({ ...t, color })));
    setEditingColor(false);
    onUpdated({ ...org, color });
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

  const pc  = PLAN_COLOR[org.plan] || PLAN_COLOR.pro;
  const inp = { padding: "6px 9px", fontSize: 13, border: `1px solid ${C.gray200}`, borderRadius: 8, fontFamily: F.ui, background: C.white, boxSizing: "border-box" };

  return (
    <div style={{ border: `1px solid ${C.gray100}`, borderRadius: 14, marginBottom: 10, overflow: "hidden", background: C.white, boxShadow: SH.subtle }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer" }} onClick={toggle}>
        <div style={{ width: 14, height: 14, borderRadius: "50%", background: orgColor, border: `2px solid ${C.gray200}`, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.gray900 }}>{org.name}</span>
            <span style={{ fontSize: 11, color: C.gray400 }}>/{org.slug}</span>
            <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "2px 7px", background: pc.bg, color: pc.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>{org.plan}</span>
            <span style={{ fontSize: 11, color: STATUS_COLOR[org.plan_status] || C.gray500 }}>{org.plan_status}</span>
          </div>
          <div style={{ fontSize: 12, color: C.gray400, marginTop: 3 }}>
            {org.member_count} member{org.member_count !== 1 ? "s" : ""} · {org.game_count} game{org.game_count !== 1 ? "s" : ""} · {org.season_count} season{org.season_count !== 1 ? "s" : ""} · {org.team_count} team{org.team_count !== 1 ? "s" : ""}
          </div>
        </div>
        <div style={{ fontSize: 14, color: C.gray300, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>›</div>
      </div>

      {open && (
        <div style={{ borderTop: `1px solid ${C.gray75}`, padding: "16px" }}>
          {error && <div style={{ background: C.red50, border: `1px solid ${C.red100}`, borderRadius: 8, padding: "8px 12px", color: C.red600, fontSize: 12, marginBottom: 12 }}>{error}</div>}
          {loadingDetail ? (
            <div style={{ color: C.gray400, fontSize: 13 }}>Loading…</div>
          ) : (
            <>
              {/* Plan */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.gray500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Plan</div>
                {!editPlan ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 13, color: C.gray900 }}>{org.plan} · {org.plan_status}</span>
                    <button onClick={() => setEditPlan(true)} style={{ fontSize: 12, color: C.blue600, background: "none", border: `1px solid ${C.blue200}`, borderRadius: 6, padding: "2px 9px", cursor: "pointer" }}>Edit</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <select value={plan} onChange={e => setPlan(e.target.value)} style={{ ...inp }}>
                      {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <select value={planStatus} onChange={e => setPlanStatus(e.target.value)} style={{ ...inp }}>
                      {PLAN_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button onClick={savePlan} disabled={savingPlan} style={{ padding: "6px 14px", fontSize: 13, fontWeight: 600, background: C.gray900, color: C.white, border: "none", borderRadius: 8, cursor: "pointer" }}>{savingPlan ? "…" : "Save"}</button>
                    <button onClick={() => { setEditPlan(false); setPlan(org.plan); setPlanStatus(org.plan_status); }} style={{ padding: "6px 12px", fontSize: 13, background: "transparent", border: `1px solid ${C.gray200}`, borderRadius: 8, cursor: "pointer", color: C.gray650 }}>Cancel</button>
                  </div>
                )}
              </div>

              {/* Org color */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.gray500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Org Color</div>
                {!editingColor ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: orgColor, border: `2px solid ${C.gray200}`, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: C.gray650, fontFamily: F.mono }}>{orgColor}</span>
                    <button onClick={() => setEditingColor(true)} style={{ fontSize: 12, color: C.blue600, background: "none", border: `1px solid ${C.blue200}`, borderRadius: 6, padding: "2px 9px", cursor: "pointer" }}>Edit</button>
                  </div>
                ) : (
                  <div>
                    <ColorPicker value={orgColor} onChange={setOrgColor} />
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button onClick={() => handleSaveOrgColor(orgColor)} disabled={savingColor}
                        style={{ padding: "6px 14px", fontSize: 13, fontWeight: 600, background: C.gray900, color: C.white, border: "none", borderRadius: 8, cursor: "pointer" }}>
                        {savingColor ? "…" : "Save"}
                      </button>
                      <button onClick={() => { setEditingColor(false); setOrgColor(org.color || PRESET_COLORS[0]); }}
                        style={{ padding: "6px 12px", fontSize: 13, background: "transparent", border: `1px solid ${C.gray200}`, borderRadius: 8, cursor: "pointer", color: C.gray650 }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Org Logo */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.gray500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Org Logo</div>
                <OrgLogoSection
                  orgId={org.id}
                  initialLogoUrl={orgLogoUrl}
                  canManage
                  onSaved={url => setOrgLogoUrl(url)}
                />
              </div>

              {/* Members */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.gray500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Members</div>
                {members.length === 0 ? (
                  <div style={{ fontSize: 13, color: C.gray400, marginBottom: 10 }}>No members.</div>
                ) : (
                  <div style={{ marginBottom: 10 }}>
                    {members.map(m => (
                      <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${C.gray50}` }}>
                        <span style={{ flex: 1, fontSize: 13, color: C.gray900 }}>{displayName(m.email)}</span>
                        <select value={m.role} onChange={e => handleRoleChange(m.user_id, e.target.value)} style={{ ...inp, padding: "4px 7px", fontSize: 12 }}>
                          {ORG_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <button onClick={() => handleRemoveMember(m.user_id)}
                          style={{ fontSize: 11, color: C.red600, background: "none", border: `1px solid ${C.red300}`, borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>Remove</button>
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
                      style={{ padding: "6px 12px", fontSize: 13, fontWeight: 600, background: addUsername.trim() ? C.gray900 : C.gray300, color: C.white, border: "none", borderRadius: 8, cursor: "pointer" }}>
                      {searching ? "…" : "Find"}
                    </button>
                  ) : (
                    <button onClick={handleAddMember} disabled={adding}
                      style={{ padding: "6px 12px", fontSize: 13, fontWeight: 600, background: C.green600, color: C.white, border: "none", borderRadius: 8, cursor: "pointer" }}>
                      {adding ? "…" : `Add ${addSearchResult.display_name}`}
                    </button>
                  )}
                </div>
                {addError && <div style={{ fontSize: 12, color: C.red600, marginTop: 4 }}>{addError}</div>}
              </div>

              {/* Feature overrides */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.gray500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Feature Limits</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "6px 12px", alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.gray400 }}>Feature</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.gray400 }}>Plan default</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.gray400 }}>Override</span>
                  {features.map(f => {
                    const isBool = BOOLEAN_FEATURES.has(f.feature_id);
                    const planLabel = isBool
                      ? (f.plan_limit === 0 ? "false" : "true")
                      : (f.plan_limit === null ? "∞" : f.plan_limit === 0 ? "off" : String(f.plan_limit));
                    return (
                      <>
                        <span key={f.feature_id + "_n"} style={{ fontSize: 13, color: C.gray900 }}>{f.description || f.feature_id}</span>
                        <span key={f.feature_id + "_p"} style={{ fontSize: 12, color: C.gray400, textAlign: "right" }}>{planLabel}</span>
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
                <div style={{ fontSize: 11, color: C.gray350, marginTop: 6 }}>
                  Boolean features: Plan default / true / false. Numeric: blank = plan default, number = override limit.
                </div>
              </div>

              {/* Teams */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.gray500, textTransform: "uppercase", letterSpacing: "0.06em" }}>Teams</div>
                  {!showNewTeam && (
                    <button onClick={() => setShowNewTeam(true)}
                      style={{ fontSize: 12, fontWeight: 600, color: C.blue600, background: "none", border: `1px solid ${C.blue200}`, borderRadius: 6, padding: "2px 9px", cursor: "pointer" }}>+ New Team</button>
                  )}
                </div>
                {teams.length === 0 && !showNewTeam && <div style={{ fontSize: 13, color: C.gray400, marginBottom: 8 }}>No teams yet.</div>}
                {teams.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    {teams.map(t => (
                      <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${C.gray50}` }}>
                        <div style={{ width: 12, height: 12, borderRadius: "50%", background: t.color || C.gray500, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: C.gray900, flex: 1 }}>{t.name}</span>
                        <button onClick={() => navigate(`/orgs/${org.slug}/teams`)}
                          style={{ fontSize: 11, color: C.gray650, background: "none", border: `1px solid ${C.gray250}`, borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}>Manage</button>
                      </div>
                    ))}
                  </div>
                )}
                {showNewTeam && (
                  <div style={{ background: C.gray45, borderRadius: 10, padding: "12px 14px", border: `1px solid ${C.gray100}` }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <input style={{ ...inp, flex: 1, minWidth: 120 }} placeholder="Team name" value={newTeamName}
                        onChange={e => setNewTeamName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCreateTeam()} autoFocus />
                      <button onClick={handleCreateTeam} disabled={!newTeamName.trim() || creatingTeam}
                        style={{ padding: "6px 14px", fontSize: 13, fontWeight: 600, background: newTeamName.trim() && !creatingTeam ? C.gray900 : C.gray300, color: C.white, border: "none", borderRadius: 8, cursor: "pointer", flexShrink: 0 }}>
                        {creatingTeam ? "…" : "Create"}
                      </button>
                      <button onClick={() => { setShowNewTeam(false); setNewTeamName(""); }}
                        style={{ padding: "6px 10px", fontSize: 13, background: "transparent", border: `1px solid ${C.gray200}`, borderRadius: 8, cursor: "pointer", color: C.gray650, flexShrink: 0 }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Games */}
              {orgGames.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.gray500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Games</div>
                  {orgGames.map(g => {
                    const info = getGameInfo(g);
                    const started = info?.started && !info?.gameOver;
                    const over = info?.gameOver;
                    return (
                      <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${C.gray50}` }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: over ? C.gray300 : started ? C.green600 : C.orange550 }} />
                        <span style={{ flex: 1, fontSize: 13, color: C.gray900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {g.name || (info ? `${info.t0?.name} vs ${info.t1?.name}` : "Untitled")}
                        </span>
                        <span style={{ fontSize: 11, color: C.gray350, flexShrink: 0 }}>{over ? "Final" : started ? "Live" : "Pending"}</span>
                        {!over && (
                          <button onClick={() => navigate(`/games/${g.id}/score`)}
                            style={{ padding: "3px 10px", fontSize: 11, fontWeight: 700, background: C.gray900, color: C.white, border: "none", borderRadius: 6, cursor: "pointer", flexShrink: 0 }}>
                            {started ? "Score" : "Setup"}
                          </button>
                        )}
                        <button onClick={() => navigate(`/games/${g.id}/view`)}
                          style={{ padding: "3px 10px", fontSize: 11, fontWeight: 600, background: "transparent", color: C.gray650, border: `1px solid ${C.gray250}`, borderRadius: 6, cursor: "pointer", flexShrink: 0 }}>View</button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Create Game */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.gray500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Create Game</div>
                {!showNewGame ? (
                  <button onClick={() => setShowNewGame(true)}
                    style={{ padding: "6px 14px", fontSize: 13, fontWeight: 600, background: C.gray900, color: C.white, border: "none", borderRadius: 8, cursor: "pointer" }}>
                    + New Game in {org.name}
                  </button>
                ) : (
                  <div style={{ background: C.gray45, borderRadius: 10, padding: "12px 14px", border: `1px solid ${C.gray100}` }}>
                    <div style={{ fontSize: 12, color: C.gray500, marginBottom: 8 }}>Owner — org admin, coach, or scorekeeper</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <select value={gameOwner} onChange={e => setGameOwner(e.target.value)} style={{ ...inp, flex: 1 }}>
                        <option value="">Select member…</option>
                        {members.filter(m => ["org_admin", "coach", "scorekeeper"].includes(m.role))
                          .map(m => <option key={m.user_id} value={m.user_id}>{displayName(m.email)} — {m.role.replace("org_", "")}</option>)}
                      </select>
                      <button onClick={handleCreateGame} disabled={!gameOwner}
                        style={{ padding: "6px 14px", fontSize: 13, fontWeight: 600, background: gameOwner ? C.gray900 : C.gray300, color: C.white, border: "none", borderRadius: 8, cursor: "pointer", flexShrink: 0 }}>
                        Go to Setup →
                      </button>
                      <button onClick={() => { setShowNewGame(false); setGameOwner(""); }}
                        style={{ padding: "6px 10px", fontSize: 13, background: "transparent", border: `1px solid ${C.gray200}`, borderRadius: 8, cursor: "pointer", color: C.gray650, flexShrink: 0 }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Danger zone */}
              <div style={{ borderTop: `1px solid ${C.gray50}`, paddingTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.red600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Danger Zone</div>
                {deleteStage === 0 && (
                  <button onClick={() => setDeleteStage(1)} style={{ padding: "6px 14px", fontSize: 13, color: C.red600, background: "transparent", border: `1px solid ${C.red300}`, borderRadius: 8, cursor: "pointer" }}>Delete org…</button>
                )}
                {deleteStage === 1 && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: C.red600 }}>Delete <strong>{org.name}</strong> and all its data?</span>
                    <button onClick={() => setDeleteStage(0)} style={{ padding: "5px 12px", fontSize: 12, background: "transparent", border: `1px solid ${C.gray250}`, borderRadius: 7, cursor: "pointer", color: C.gray650 }}>Cancel</button>
                    <button onClick={() => setDeleteStage(2)} style={{ padding: "5px 12px", fontSize: 12, color: C.red600, background: "transparent", border: `1px solid ${C.red400}`, borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>Delete</button>
                  </div>
                )}
                {deleteStage === 2 && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: C.red600, fontWeight: 600 }}>Cannot be undone. Confirm?</span>
                    <button onClick={() => setDeleteStage(0)} style={{ padding: "5px 12px", fontSize: 12, background: "transparent", border: `1px solid ${C.gray250}`, borderRadius: 7, cursor: "pointer", color: C.gray650 }}>Cancel</button>
                    <button onClick={handleDelete} disabled={deleting} style={{ padding: "5px 12px", fontSize: 12, background: C.red600, color: C.white, border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 600 }}>{deleting ? "…" : "Yes, delete"}</button>
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
