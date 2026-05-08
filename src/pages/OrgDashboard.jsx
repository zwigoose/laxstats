import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useOrgRole } from "../hooks/useOrgRole";
import { useDocTitle } from "../hooks/useDocTitle";
import { qLabel } from "../components/LaxStats";
import { dbRowToEntry } from "../hooks/useGameEvents";
import { TeamCard, TeamForm, ColorPicker, OrgColorSection, PRESET_COLORS } from "./TeamManager";
import { PLAN_COLOR } from "../constants/lacrosse";
import { useOrgEntitlements } from "../hooks/useOrgEntitlements";
import { entitlementMsg } from "../utils/entitlement";


function UsageMeter({ entry, label }) {
  if (!entry || entry.plan_limit === null) return null;
  const { plan_limit, current_usage, at_limit } = entry;
  const pct = plan_limit > 0 ? Math.min(1, current_usage / plan_limit) : 1;
  const color = at_limit ? "#c0392b" : pct >= 0.8 ? "#d4820a" : "#aaa";
  return (
    <span style={{ fontSize: 12, color, fontVariantNumeric: "tabular-nums", display: "flex", alignItems: "center", gap: 6 }}>
      {current_usage} / {plan_limit} {label ?? ""}
      {at_limit && <Link to="/pricing" style={{ fontSize: 11, fontWeight: 700, color: "#1a6bab", textDecoration: "none" }}>Upgrade →</Link>}
    </span>
  );
}

const ROLE_LABELS = { org_admin: "Admin", coach: "Coach", scorekeeper: "Scorekeeper", viewer: "Viewer" };
const ROLE_COLORS = { org_admin: { bg: "#fff3e0", color: "#d4820a" }, coach: { bg: "#e8f5e9", color: "#2a7a3b" }, scorekeeper: { bg: "#e3f2fd", color: "#1a6bab" }, viewer: { bg: "#f5f5f5", color: "#888" } };

function parseDate(str) {
  return str?.length === 10 ? new Date(str + "T12:00:00") : new Date(str);
}
function formatDate(str) {
  if (!str) return "";
  return parseDate(str).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function getGameInfo(game, v2Scores) {
  const s = game.state;
  if (!s?.teams) return null;
  const score0 = v2Scores?.[game.id]?.[0] ?? 0;
  const score1 = v2Scores?.[game.id]?.[1] ?? 0;
  const started = score0 > 0 || score1 > 0 || !!s.trackingStarted;
  const gameDate = game.game_date || s.gameDate || game.created_at?.split("T")[0];
  const currentQuarter = s.currentQuarter || 1;
  return { t0: s.teams[0], t1: s.teams[1], score0, score1, gameOver: s.gameOver, started, gameDate, currentQuarter };
}

const S = {
  page:    { fontFamily: "system-ui, sans-serif", minHeight: "100%", background: "#f5f5f5" },
  header:  { background: "#111", padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 },
  back:    { fontSize: 13, color: "rgba(255,255,255,0.5)", background: "none", border: "none", cursor: "pointer" },
  orgName: { fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em", flex: 1 },
  body:    { maxWidth: 640, margin: "0 auto", padding: "0 16px 32px" },
  tabBar:  { display: "flex", gap: 4, padding: "12px 0 0", marginBottom: 20, borderBottom: "1px solid #e8e8e8" },
  tab:     (active) => ({ padding: "8px 16px", fontSize: 14, fontWeight: active ? 700 : 500, border: "none", background: "transparent", cursor: "pointer", color: active ? "#111" : "#aaa", borderBottom: active ? "2px solid #111" : "2px solid transparent", marginBottom: -1 }),
  card:    { borderRadius: 14, overflow: "hidden", marginBottom: 10, boxShadow: "0 1px 8px rgba(0,0,0,0.06)", border: "1px solid #e8e8e8", background: "#fff" },
  sectionHead: { fontSize: 11, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "20px 0 10px" },
  badge:   (role) => ({ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, letterSpacing: "0.04em", ...(ROLE_COLORS[role] || ROLE_COLORS.viewer) }),
  input:   { width: "100%", padding: "9px 11px", fontSize: 14, border: "1px solid #e0e0e0", borderRadius: 9, background: "#fff", boxSizing: "border-box", fontFamily: "system-ui, sans-serif" },
  btnPrimary: { padding: "8px 16px", fontSize: 13, fontWeight: 600, background: "#111", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer" },
  btnOutline: { padding: "8px 16px", fontSize: 13, fontWeight: 500, background: "transparent", color: "#555", border: "1px solid #ddd", borderRadius: 9, cursor: "pointer" },
  loading: { textAlign: "center", padding: "48px 0", color: "#aaa", fontSize: 14 },
  err:     { background: "#fff5f5", border: "1px solid #fdd", borderRadius: 10, padding: "10px 14px", color: "#c0392b", fontSize: 13, margin: "12px 0" },
};

// ── Org game card ─────────────────────────────────────────────────────────────
function OrgGameCard({ game, canScore, v2Scores, hasPressbox }) {
  const navigate = useNavigate();
  const info = getGameInfo(game, v2Scores);
  const c0 = info?.t0?.color || "#444";
  const c1 = info?.t1?.color || "#888";

  return (
    <div style={S.card}>
      <div style={{ height: 4, background: info ? `linear-gradient(90deg, ${c0} 50%, ${c1} 50%)` : "#e0e0e0" }} />
      <div style={{ padding: "12px 14px" }}>
        {info ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: c0 }}>{info.t0.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: info.score0 >= info.score1 ? c0 : "#bbb", fontVariantNumeric: "tabular-nums" }}>{info.score0}</span>
              <span style={{ fontSize: 14, color: "#ccc" }}>—</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: info.score1 >= info.score0 ? c1 : "#bbb", fontVariantNumeric: "tabular-nums" }}>{info.score1}</span>
            </div>
            <div style={{ textAlign: "right", fontSize: 18, fontWeight: 700, color: c1 }}>{info.t1.name}</div>
          </div>
        ) : (
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111", marginBottom: 8 }}>{game.name}</div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            {info?.gameOver
              ? <span style={{ fontSize: 11, fontWeight: 600, color: "#888", background: "#f0f0f0", borderRadius: 20, padding: "2px 8px", textTransform: "uppercase" }}>Final</span>
              : info?.started
                ? <span style={{ fontSize: 11, fontWeight: 700, color: "#2a7a3b", background: "#eaf6ec", borderRadius: 20, padding: "2px 8px" }}>● Live · {qLabel(info.currentQuarter)}</span>
                : <span style={{ fontSize: 11, fontWeight: 700, color: "#d4820a", background: "#fff8ec", borderRadius: 20, padding: "2px 8px" }}>● Pending</span>
            }
            {info?.gameDate && <span style={{ fontSize: 11, color: "#bbb" }}>{formatDate(info.gameDate)}</span>}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={S.btnOutline} onClick={() => navigate(`/games/${game.id}/view`)}>View</button>
            {hasPressbox && (
              <button style={S.btnOutline} onClick={() => window.open(`/games/${game.id}/pressbox`, "_blank")}>Press Box</button>
            )}
            {canScore && !info?.gameOver && (
              <button style={S.btnPrimary} onClick={() => navigate(`/games/${game.id}/score`)}>
                {info?.started ? "Score" : "Setup"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Games tab ─────────────────────────────────────────────────────────────────
function GamesTab({ org, canScore, orgMembership }) {
  const navigate = useNavigate();
  const [games, setGames]         = useState([]);
  const [v2Scores, setV2Scores]   = useState({});
  const [hasPressbox, setHasPressbox] = useState(false);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    // Check pressbox feature for this org
    supabase.rpc("org_feature_limit", { p_org_id: org.id, p_feature_id: "pressbox" })
      .then(({ data: limit }) => setHasPressbox(limit !== 0));

    supabase.from("games")
      .select("id, created_at, name, state, schema_ver, game_date, user_id, org_id, away_org_id, pressbox_enabled")
      .or(`org_id.eq.${org.id},away_org_id.eq.${org.id}`).order("created_at", { ascending: false })
      .then(async ({ data }) => {
        const games = data || [];
        setGames(games);

        if (games.length > 0) {
          const { data: totals } = await supabase
            .from("v_game_team_totals")
            .select("game_id, team_idx, goals")
            .in("game_id", games.map(g => g.id));
          const scoreMap = {};
          (totals || []).forEach(r => {
            if (!scoreMap[r.game_id]) scoreMap[r.game_id] = [0, 0];
            scoreMap[r.game_id][r.team_idx] = r.goals;
          });
          setV2Scores(scoreMap);
        }
        setLoading(false);
      });
  }, [org.id]);

  if (loading) return <div style={S.loading}>Loading…</div>;

  const live    = games.filter(g => { const i = getGameInfo(g, v2Scores); return i?.started && !i?.gameOver; });
  const pending = games.filter(g => { const i = getGameInfo(g, v2Scores); return !i?.started; });
  const final   = games.filter(g => { const i = getGameInfo(g, v2Scores); return i?.gameOver; });

  return (
    <div>
      {canScore && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button style={S.btnPrimary} onClick={() => navigate("/games/new", { state: { orgMembership: orgMembership } })}>＋ New Game</button>
        </div>
      )}
      {games.length === 0 && <div style={{ color: "#aaa", fontSize: 14, padding: "32px 0", textAlign: "center" }}>No games yet.</div>}
      {live.map(g => <OrgGameCard key={g.id} game={g} canScore={canScore} v2Scores={v2Scores} hasPressbox={hasPressbox || !!g.pressbox_enabled} />)}
      {pending.map(g => <OrgGameCard key={g.id} game={g} canScore={canScore} v2Scores={v2Scores} hasPressbox={hasPressbox || !!g.pressbox_enabled} />)}
      {final.length > 0 && (
        <>
          <div style={S.sectionHead}>Completed</div>
          {final.map(g => <OrgGameCard key={g.id} game={g} canScore={canScore} v2Scores={v2Scores} hasPressbox={hasPressbox || !!g.pressbox_enabled} />)}
        </>
      )}
    </div>
  );
}

// ── Seasons tab ───────────────────────────────────────────────────────────────
function SeasonCard({ season, slug, isOrgAdmin, orgTeams, navigate }) {
  const [open, setOpen]             = useState(false);
  const [seasonTeams, setSeasonTeams] = useState(null);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [addingTeam, setAddingTeam] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState(null);

  async function loadSeasonTeams() {
    setLoadingTeams(true);
    const { data } = await supabase
      .from("season_teams")
      .select("team_id, team:teams(id, name, color)")
      .eq("season_id", season.id);
    setSeasonTeams(data || []);
    setLoadingTeams(false);
  }

  function toggle() {
    if (!open) loadSeasonTeams();
    setOpen(v => !v);
  }

  async function handleAddTeam() {
    if (!selectedTeamId || saving) return;
    setSaving(true); setError(null);
    const { error: err } = await supabase.rpc("add_team_to_season", {
      p_season_id: season.id,
      p_team_id: selectedTeamId,
    });
    if (err) { setError(err.message); setSaving(false); return; }
    const t = orgTeams.find(t => t.id === selectedTeamId);
    setSeasonTeams(prev => [...(prev || []), { team_id: selectedTeamId, team: t }]);
    setSelectedTeamId(""); setAddingTeam(false); setSaving(false);
  }

  async function handleRemoveTeam(teamId) {
    const { error: err } = await supabase.from("season_teams")
      .delete().eq("season_id", season.id).eq("team_id", teamId);
    if (err) { setError(err.message); return; }
    setSeasonTeams(prev => prev.filter(st => st.team_id !== teamId));
  }

  const availableTeams = (orgTeams || []).filter(t => !seasonTeams?.some(st => st.team_id === t.id));

  return (
    <div style={S.card}>
      {/* Header row */}
      <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={toggle}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#111" }}>{season.name}</div>
          {(season.start_date || season.end_date) && (
            <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>
              {season.start_date && formatDate(season.start_date)}
              {season.start_date && season.end_date && " – "}
              {season.end_date && formatDate(season.end_date)}
            </div>
          )}
          {seasonTeams && (
            <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>
              {seasonTeams.length} team{seasonTeams.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); navigate(`/orgs/${slug}/seasons/${season.id}`); }}
          style={{ padding: "5px 11px", fontSize: 12, fontWeight: 600, background: "transparent", color: "#1a6bab", border: "1px solid #c0d8f0", borderRadius: 7, cursor: "pointer", flexShrink: 0 }}
        >
          Stats →
        </button>
        <div style={{ fontSize: 14, color: "#ccc", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }}>›</div>
      </div>

      {open && (
        <div style={{ borderTop: "1px solid #f0f0f0", padding: "14px 16px" }}>
          {error && <div style={S.err}>{error}</div>}

          {loadingTeams && <div style={{ fontSize: 13, color: "#aaa", padding: "8px 0" }}>Loading…</div>}

          {/* Teams in this season */}
          {!loadingTeams && seasonTeams !== null && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                Teams in {season.name}
              </div>

              {seasonTeams.length === 0 && (
                <div style={{ fontSize: 13, color: "#aaa", marginBottom: 10 }}>No teams added yet.</div>
              )}

              {seasonTeams.map(st => (
                <div key={st.team_id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid #f5f5f5" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: st.team?.color || "#888", flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: "#111" }}>{st.team?.name}</span>
                  {isOrgAdmin && (
                    <button
                      onClick={() => handleRemoveTeam(st.team_id)}
                      style={{ fontSize: 11, color: "#c0392b", background: "none", border: "1px solid #f0a0a0", borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}

              {/* Add team */}
              {isOrgAdmin && (
                <div style={{ marginTop: 12 }}>
                  {!addingTeam ? (
                    <button
                      disabled={availableTeams.length === 0}
                      onClick={() => setAddingTeam(true)}
                      style={{ fontSize: 12, fontWeight: 600, color: availableTeams.length ? "#2a7a3b" : "#bbb", background: "none", border: `1px solid ${availableTeams.length ? "#b5e0c0" : "#e0e0e0"}`, borderRadius: 7, padding: "4px 10px", cursor: availableTeams.length ? "pointer" : "default" }}
                    >
                      {availableTeams.length === 0 ? "All teams added" : "+ Add team"}
                    </button>
                  ) : (
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <select
                        value={selectedTeamId}
                        onChange={e => setSelectedTeamId(e.target.value)}
                        style={{ ...S.input, flex: 1, padding: "6px 9px", fontSize: 13 }}
                      >
                        <option value="">Select team…</option>
                        {availableTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <button onClick={handleAddTeam} disabled={!selectedTeamId || saving}
                        style={{ padding: "6px 14px", fontSize: 13, fontWeight: 600, background: selectedTeamId && !saving ? "#111" : "#ccc", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", flexShrink: 0 }}>
                        {saving ? "…" : "Add"}
                      </button>
                      <button onClick={() => { setAddingTeam(false); setSelectedTeamId(""); }}
                        style={{ padding: "6px 10px", fontSize: 13, background: "transparent", border: "1px solid #e0e0e0", borderRadius: 8, cursor: "pointer", color: "#555", flexShrink: 0 }}>
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SeasonsTab({ org, slug, isOrgAdmin, entitlements }) {
  const navigate = useNavigate();
  const [seasons, setSeasons]   = useState([]);
  const [orgTeams, setOrgTeams] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showNew, setShowNew]   = useState(false);
  const [newName, setNewName]   = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd]     = useState("");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);

  useEffect(() => {
    Promise.all([
      supabase.from("seasons").select("id, name, start_date, end_date")
        .eq("org_id", org.id).order("start_date", { ascending: false }),
      supabase.from("teams").select("id, name, color")
        .eq("org_id", org.id).order("name"),
    ]).then(([sRes, tRes]) => {
      setSeasons(sRes.data || []);
      setOrgTeams(tRes.data || []);
      setLoading(false);
    });
  }, [org.id]);

  async function handleCreate() {
    if (!newName.trim() || saving) return;
    setSaving(true); setError(null);
    const { data: newId, error: err } = await supabase.rpc("create_org_season", {
      p_org_id: org.id, p_name: newName.trim(),
      p_start_date: newStart || null, p_end_date: newEnd || null,
    });
    if (err) { setError(entitlementMsg(err.message)); setSaving(false); return; }
    const { data } = await supabase.from("seasons")
      .select("id, name, start_date, end_date").eq("id", newId).single();
    if (data) setSeasons(prev => [data, ...prev]);
    setShowNew(false); setNewName(""); setNewStart(""); setNewEnd("");
    setSaving(false);
  }

  if (loading) return <div style={S.loading}>Loading…</div>;

  return (
    <div>
      {isOrgAdmin && !showNew && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <UsageMeter entry={entitlements.org_active_seasons} label="active seasons" />
          <button style={{ ...S.btnPrimary, opacity: entitlements.org_active_seasons?.at_limit ? 0.4 : 1 }}
            disabled={!!entitlements.org_active_seasons?.at_limit}
            onClick={() => setShowNew(true)}>＋ New Season</button>
        </div>
      )}
      {showNew && (
        <div style={{ ...S.card, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 12 }}>New Season</div>
          {error && <div style={S.err}>{error}</div>}
          <input style={{ ...S.input, marginBottom: 8 }} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Spring 2026" autoFocus />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "#aaa", marginBottom: 4 }}>Start date (optional)</div>
              <input type="date" style={S.input} value={newStart} onChange={e => setNewStart(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#aaa", marginBottom: 4 }}>End date (optional)</div>
              <input type="date" style={S.input} value={newEnd} onChange={e => setNewEnd(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={S.btnOutline} onClick={() => { setShowNew(false); setError(null); }}>Cancel</button>
            <button style={{ ...S.btnPrimary, opacity: newName.trim() ? 1 : 0.4 }} disabled={!newName.trim() || saving} onClick={handleCreate}>
              {saving ? "Saving…" : "Create"}
            </button>
          </div>
        </div>
      )}
      {seasons.length === 0 && !showNew && (
        <div style={{ color: "#aaa", fontSize: 14, padding: "32px 0", textAlign: "center" }}>No seasons yet.</div>
      )}
      {seasons.map(s => (
        <SeasonCard
          key={s.id}
          season={s}
          slug={slug}
          isOrgAdmin={isOrgAdmin}
          orgTeams={orgTeams}
          navigate={navigate}
        />
      ))}
    </div>
  );
}

// ── Teams tab ─────────────────────────────────────────────────────────────────
function TeamsTab({ org, slug, isOrgAdmin, entitlements, onOrgColorChange }) {
  const navigate = useNavigate();
  const canManage = isOrgAdmin;

  const [teams, setTeams]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [showNewTeam, setShowNewTeam] = useState(false);
  const [saving, setSaving]       = useState(false);

  useEffect(() => { load(); }, [org.id]);

  async function load() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("teams").select("id, name, color")
      .eq("org_id", org.id).order("name");
    if (err) setError(err.message);
    else setTeams(data || []);
    setLoading(false);
  }

  async function handleCreateTeam(fields) {
    setSaving(true);
    setError(null);
    const { data: teamId, error: err } = await supabase.rpc("create_org_team", {
      p_org_id: org.id, p_name: fields.name,
    });
    if (err) { setError(entitlementMsg(err.message)); setSaving(false); return; }
    const { data } = await supabase.from("teams").select("id, name, color").eq("id", teamId).single();
    if (data) setTeams(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setShowNewTeam(false);
    setSaving(false);
  }

  async function handleUpdateTeam(id, fields) {
    const { error: err } = await supabase.from("teams").update({ name: fields.name }).eq("id", id);
    if (err) { setError(err.message); return; }
    setTeams(prev => prev.map(t => t.id === id ? { ...t, name: fields.name } : t)
      .sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function handleDeleteTeam(id) {
    const { error: err } = await supabase.from("teams").delete().eq("id", id);
    if (err) { setError(err.message); return; }
    setTeams(prev => prev.filter(t => t.id !== id));
  }

  if (loading) return <div style={S.loading}>Loading…</div>;

  return (
    <div>
      {error && <div style={S.err}>{error}</div>}

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "#aaa", display: "flex", flexDirection: "column", gap: 2 }}>
          <span>{teams?.length ?? 0} team{teams?.length !== 1 ? "s" : ""}</span>
          <UsageMeter entry={entitlements.org_active_teams} label="active" />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {canManage && !showNewTeam && (
            <button style={{ ...S.btnPrimary, opacity: entitlements.org_active_teams?.at_limit ? 0.4 : 1 }}
              disabled={!!entitlements.org_active_teams?.at_limit}
              onClick={() => setShowNewTeam(true)}>+ New Team</button>
          )}
          <button
            onClick={() => navigate(`/orgs/${slug}/teams`)}
            style={{ padding: "6px 12px", fontSize: 12, fontWeight: 500, color: "#888", background: "transparent", border: "1px solid #e0e0e0", borderRadius: 8, cursor: "pointer" }}
          >
            Full page ↗
          </button>
        </div>
      </div>

      {/* Org color */}
      <OrgColorSection
        orgId={org.id}
        initialColor={org.color}
        canManage={canManage}
        onSaved={color => {
          setTeams(prev => prev?.map(t => ({ ...t, color })));
          onOrgColorChange?.(color);
        }}
      />

      {/* New team form */}
      {showNewTeam && (
        <div style={{ ...S.card, padding: 18, marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>New Team</div>
          <TeamForm saving={saving} onSave={handleCreateTeam} onCancel={() => setShowNewTeam(false)} />
        </div>
      )}

      {/* Empty state */}
      {teams?.length === 0 && !showNewTeam && (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 14, color: "#aaa", marginBottom: 16 }}>No teams yet.</div>
          {canManage && (
            <button style={{ ...S.btnPrimary, padding: "10px 22px", fontSize: 14 }} onClick={() => setShowNewTeam(true)}>
              + Create first team
            </button>
          )}
        </div>
      )}

      {/* Team cards */}
      {teams?.map(team => (
        <TeamCard
          key={team.id}
          team={team}
          orgId={org.id}
          canManage={canManage}
          onUpdate={handleUpdateTeam}
          onDelete={handleDeleteTeam}
        />
      ))}
    </div>
  );
}

// ── Players tab ───────────────────────────────────────────────────────────────
function PlayersTab({ org, isOrgAdmin }) {
  const [players, setPlayers]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [showNew, setShowNew]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [newName, setNewName]     = useState("");
  const [newNumber, setNewNumber] = useState("");
  const [newPos, setNewPos]       = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editFields, setEditFields] = useState({});

  useEffect(() => { load(); }, [org.id]);

  async function load() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("players")
      .select("id, name, number, position, team_players(jersey_num, team:teams(id, name, color))")
      .eq("org_id", org.id)
      .order("name");
    if (err) setError(err.message);
    else setPlayers(data || []);
    setLoading(false);
  }

  async function handleCreate() {
    if (!newName.trim() || saving) return;
    setSaving(true); setError(null);
    const { data, error: err } = await supabase
      .from("players")
      .insert({ org_id: org.id, name: newName.trim(), number: newNumber ? parseInt(newNumber) : null, position: newPos.trim() || null })
      .select("id, name, number, position, team_players(jersey_num, team:teams(id, name, color))")
      .single();
    if (err) { setError(err.message); setSaving(false); return; }
    setPlayers(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setShowNew(false); setNewName(""); setNewNumber(""); setNewPos("");
    setSaving(false);
  }

  async function handleSaveEdit(id) {
    const { error: err } = await supabase.from("players").update({
      name: editFields.name?.trim(),
      number: editFields.number !== "" ? parseInt(editFields.number) : null,
      position: editFields.position?.trim() || null,
    }).eq("id", id);
    if (err) { setError(err.message); return; }
    setPlayers(prev =>
      prev.map(p => p.id === id
        ? { ...p, name: editFields.name?.trim() ?? p.name, number: editFields.number !== "" ? parseInt(editFields.number) : null, position: editFields.position?.trim() || null }
        : p
      ).sort((a, b) => a.name.localeCompare(b.name))
    );
    setEditingId(null);
  }

  async function handleDelete(id) {
    if (!window.confirm("Remove this player from the org? This will also remove them from all teams.")) return;
    const { error: err } = await supabase.from("players").delete().eq("id", id);
    if (err) { setError(err.message); return; }
    setPlayers(prev => prev.filter(p => p.id !== id));
  }

  if (loading) return <div style={S.loading}>Loading…</div>;

  return (
    <div>
      {error && <div style={S.err}>{error}</div>}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "#aaa" }}>
          {players?.length ?? 0} player{players?.length !== 1 ? "s" : ""}
        </div>
        {isOrgAdmin && !showNew && (
          <button style={S.btnPrimary} onClick={() => setShowNew(true)}>+ New Player</button>
        )}
      </div>

      {showNew && (
        <div style={{ ...S.card, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>New Player</div>
          <input style={{ ...S.input, marginBottom: 8 }} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full name" autoFocus />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "#aaa", marginBottom: 4 }}>Jersey #</div>
              <input type="number" style={S.input} value={newNumber} onChange={e => setNewNumber(e.target.value)} placeholder="42" />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#aaa", marginBottom: 4 }}>Position</div>
              <input style={S.input} value={newPos} onChange={e => setNewPos(e.target.value)} placeholder="A, M, D, G…" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={S.btnOutline} onClick={() => { setShowNew(false); setError(null); setNewName(""); setNewNumber(""); setNewPos(""); }}>Cancel</button>
            <button style={{ ...S.btnPrimary, opacity: newName.trim() ? 1 : 0.4 }} disabled={!newName.trim() || saving} onClick={handleCreate}>
              {saving ? "Saving…" : "Add Player"}
            </button>
          </div>
        </div>
      )}

      {players?.length === 0 && !showNew && (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 14, color: "#aaa", marginBottom: 16 }}>No players yet.</div>
          {isOrgAdmin && (
            <button style={{ ...S.btnPrimary, padding: "10px 22px", fontSize: 14 }} onClick={() => setShowNew(true)}>
              + Add first player
            </button>
          )}
        </div>
      )}

      {players?.map(p => (
        editingId === p.id ? (
          <div key={p.id} style={{ ...S.card, padding: 14, marginBottom: 6 }}>
            <input style={{ ...S.input, marginBottom: 8 }} value={editFields.name} onChange={e => setEditFields(f => ({ ...f, name: e.target.value }))} autoFocus />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: "#aaa", marginBottom: 4 }}>Jersey #</div>
                <input type="number" style={S.input} value={editFields.number} onChange={e => setEditFields(f => ({ ...f, number: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#aaa", marginBottom: 4 }}>Position</div>
                <input style={S.input} value={editFields.position} onChange={e => setEditFields(f => ({ ...f, position: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={S.btnOutline} onClick={() => setEditingId(null)}>Cancel</button>
              <button style={{ ...S.btnPrimary, opacity: editFields.name?.trim() ? 1 : 0.4 }} disabled={!editFields.name?.trim()} onClick={() => handleSaveEdit(p.id)}>Save</button>
            </div>
          </div>
        ) : (
          <div key={p.id} style={{ ...S.card, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              {p.number != null && (
                <div style={{ fontSize: 13, fontWeight: 700, color: "#aaa", minWidth: 28, textAlign: "right", paddingTop: 2 }}>#{p.number}</div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>{p.name}</div>
                {p.position && <div style={{ fontSize: 12, color: "#888", marginTop: 1 }}>{p.position}</div>}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
                  {p.team_players?.length > 0
                    ? p.team_players.map(tp => (
                        <span key={tp.team?.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 500, background: "#f5f5f5", borderRadius: 12, padding: "2px 8px", color: "#555" }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: tp.team?.color || "#888", display: "inline-block", flexShrink: 0 }} />
                          {tp.team?.name}{tp.jersey_num != null ? ` #${tp.jersey_num}` : ""}
                        </span>
                      ))
                    : <span style={{ fontSize: 11, color: "#ccc" }}>No team</span>
                  }
                </div>
              </div>
              {isOrgAdmin && (
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => { setEditingId(p.id); setEditFields({ name: p.name, number: p.number ?? "", position: p.position ?? "" }); }}
                    style={{ fontSize: 11, color: "#555", background: "none", border: "1px solid #e0e0e0", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    style={{ fontSize: 11, color: "#c0392b", background: "none", border: "1px solid #f0a0a0", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      ))}
    </div>
  );
}

// ── Stats tab ─────────────────────────────────────────────────────────────────
function StatLeaderList({ title, players, statKey, statLabel }) {
  if (!players.length) return null;
  return (
    <div style={{ flex: 1, minWidth: 200 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>{title}</div>
      {players.map((p, i) => (
        <div key={`${p.player_id}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid #f5f5f5" }}>
          <span style={{ fontSize: 12, color: "#bbb", width: 16, textAlign: "right" }}>{i + 1}</span>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.player_name}</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#111", fontVariantNumeric: "tabular-nums" }}>{p[statKey]}</span>
          <span style={{ fontSize: 11, color: "#aaa", width: 28 }}>{statLabel}</span>
        </div>
      ))}
    </div>
  );
}

function OrgStatLeaders({ playerStats }) {
  if (!playerStats.length) return (
    <div style={{ fontSize: 13, color: "#aaa", textAlign: "center", padding: "20px 0" }}>
      All-time leaders will appear once games are scored.
    </div>
  );
  const top = (key, n = 5) => [...playerStats].sort((a, b) => b[key] - a[key]).slice(0, n).filter(p => p[key] > 0);
  const categories = [
    { title: "Goals",         key: "goals",        label: "G"   },
    { title: "Assists",       key: "assists",       label: "A"   },
    { title: "Points",        key: "points",        label: "Pts" },
    { title: "Shots on Goal", key: "sog",           label: "SOG" },
    { title: "Ground Balls",  key: "ground_balls",  label: "GB"  },
    { title: "Faceoff Wins",  key: "faceoff_wins",  label: "FO"  },
    { title: "Saves",         key: "saves",         label: "SV"  },
  ];
  return (
    <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
      {categories.map(({ title, key, label }) => {
        const players = top(key);
        if (!players.length) return null;
        return <StatLeaderList key={key} title={title} players={players} statKey={key} statLabel={label} />;
      })}
    </div>
  );
}

function StatsTab({ org }) {
  const [playerStats, setPlayerStats] = useState([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    supabase.from("v_org_player_stats")
      .select("*")
      .eq("org_id", org.id)
      .then(({ data }) => {
        setPlayerStats(data || []);
        setLoading(false);
      });
  }, [org.id]);

  if (loading) return <div style={S.loading}>Loading…</div>;

  return (
    <div>
      <div style={S.sectionHead}>All-Time Leaders</div>
      <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 14, padding: 16 }}>
        <OrgStatLeaders playerStats={playerStats} />
      </div>
    </div>
  );
}

// ── Members tab ───────────────────────────────────────────────────────────────
function MembersTab({ org, isOrgAdmin, entitlements }) {
  const [members, setMembers]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [username, setUsername]     = useState("");
  const [role, setRole]             = useState("scorekeeper");
  const [inviting, setInviting]     = useState(false);
  const [error, setError]           = useState(null);
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => { loadMembers(); }, [org.id]);

  async function loadMembers() {
    const { data, error: err } = await supabase.rpc("get_org_members", { p_org_id: org.id });
    if (err) setError(err.message);
    else setError(null);
    setMembers(data || []);
    setLoading(false);
  }

  async function handleInvite() {
    if (!username.trim() || inviting) return;
    setInviting(true); setError(null);
    const { error: err } = await supabase.rpc("invite_org_member", {
      p_org_id: org.id, p_username: username.trim(), p_role: role,
    });
    if (err) { setError(entitlementMsg(err.message)); setInviting(false); return; }
    setUsername(""); setShowInvite(false); setInviting(false);
    loadMembers();
  }

  async function handleRemove(userId) {
    setRemovingId(userId);
    await supabase.rpc("remove_org_member", { p_org_id: org.id, p_user_id: userId });
    setMembers(prev => prev.filter(m => m.member_user_id !== userId));
    setRemovingId(null);
  }

  if (loading) return <div style={S.loading}>Loading…</div>;

  return (
    <div>
      {error && !showInvite && <div style={S.err}>{error}</div>}
      {isOrgAdmin && !showInvite && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <UsageMeter entry={entitlements.org_members} label="members" />
          <button style={{ ...S.btnPrimary, opacity: entitlements.org_members?.at_limit ? 0.4 : 1 }}
            disabled={!!entitlements.org_members?.at_limit}
            onClick={() => setShowInvite(true)}>＋ Invite Member</button>
        </div>
      )}
      {showInvite && (
        <div style={{ ...S.card, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 12 }}>Invite Member</div>
          {error && <div style={S.err}>{error}</div>}
          <input style={{ ...S.input, marginBottom: 8 }} value={username} autoFocus
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleInvite()}
            placeholder="Username or email" />
          <select style={{ ...S.input, marginBottom: 12, appearance: "none" }} value={role} onChange={e => setRole(e.target.value)}>
            <option value="org_admin">Admin</option>
            <option value="coach">Coach</option>
            <option value="scorekeeper">Scorekeeper</option>
            <option value="viewer">Viewer</option>
          </select>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={S.btnOutline} onClick={() => { setShowInvite(false); setError(null); }}>Cancel</button>
            <button style={{ ...S.btnPrimary, opacity: username.trim() ? 1 : 0.4 }} disabled={!username.trim() || inviting} onClick={handleInvite}>
              {inviting ? "Inviting…" : "Invite"}
            </button>
          </div>
        </div>
      )}
      {members.length === 0 && <div style={{ color: "#aaa", fontSize: 14, padding: "32px 0", textAlign: "center" }}>No members yet.</div>}
      {members.map(m => (
        <div key={m.member_user_id} style={{ ...S.card, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>{m.display_name}</div>
          </div>
          <span style={S.badge(m.role)}>{ROLE_LABELS[m.role] ?? m.role}</span>
          {isOrgAdmin && (
            <button onClick={() => handleRemove(m.member_user_id)} disabled={removingId === m.member_user_id}
              style={{ fontSize: 11, color: "#c0392b", background: "none", border: "1px solid #f0a0a0", borderRadius: 6, cursor: "pointer", padding: "3px 8px" }}>
              {removingId === m.member_user_id ? "…" : "Remove"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function OrgDashboard() {
  const { slug } = useParams();
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, orgMemberships } = useAuth();
  const [org, setOrg]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab]     = useState(location.state?.tab ?? "games");
  const [colorOpen, setColorOpen] = useState(false);
  useDocTitle(org?.name);

  useEffect(() => {
    supabase.from("organizations").select("id, name, slug, plan, color")
      .eq("slug", slug).single()
      .then(({ data, error: err }) => {
        if (err) { setError("Organization not found."); setLoading(false); return; }
        setOrg(data);
        setLoading(false);
      });
  }, [slug]);

  const { entitlements } = useOrgEntitlements(org?.id);

  const { role, isOrgAdmin, canScore } = useOrgRole(org?.id);
  const orgMembership = org ? orgMemberships.find(m => m.org_id === org.id) ?? null : null;

  if (loading) return <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ color: "#aaa", fontSize: 14 }}>Loading…</div></div>;
  if (error || !org) return <div style={{ ...S.page, padding: 40, textAlign: "center", color: "#c0392b", fontSize: 14 }}>{error || "Not found."}</div>;

  const tabs = [
    ["games",   "Games"],
    ["seasons", "Seasons"],
    ["teams",   "Teams"],
    ["players", "Players"],
    ["members", "Members"],
    ["stats",   "Stats"],
  ];

  return (
    <div style={S.page}>
      {/* Sticky header + tab bar */}
      <div style={{ position: "sticky", top: 0, zIndex: 10 }}>
        <div style={S.header}>
          {/* Org color swatch — clickable for org admins */}
          <div
            style={{ width: 18, height: 18, borderRadius: "50%", background: org.color || "#1a6bab", border: "2px solid rgba(255,255,255,0.3)", flexShrink: 0, cursor: isOrgAdmin ? "pointer" : "default" }}
            title={isOrgAdmin ? "Change org color" : "Org color"}
            onClick={isOrgAdmin ? () => setColorOpen(v => !v) : undefined}
          />
          <span style={S.orgName}>{org.name}</span>
          {org.plan && (() => { const pc = PLAN_COLOR[org.plan] || PLAN_COLOR.pro; return (
            <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "2px 8px", background: pc.bg, color: pc.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>{org.plan}</span>
          ); })()}
          {role && <span style={S.badge(role)}>{ROLE_LABELS[role] ?? role}</span>}
          {isOrgAdmin && (
            <button style={{ ...S.btnOutline, fontSize: 12, color: "rgba(255,255,255,0.6)", borderColor: "rgba(255,255,255,0.2)", background: "transparent" }}
              onClick={() => navigate(`/orgs/${slug}/teams`)}>
              Manage Teams
            </button>
          )}
        </div>
        <div style={{ background: "#fff" }}>
          <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 16px" }}>
            <div style={{ ...S.tabBar, marginBottom: 0 }}>
              {tabs.map(([id, label]) => (
                <button key={id} style={S.tab(tab === id)} onClick={() => setTab(id)}>{label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {isOrgAdmin && colorOpen && (
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "12px 16px 0" }}>
          <OrgColorSection
            orgId={org.id}
            initialColor={org.color}
            canManage
            onSaved={color => {
              setOrg(prev => ({ ...prev, color }));
              setColorOpen(false);
            }}
          />
        </div>
      )}

      <div style={S.body}>
        {tab === "games"   && <GamesTab   org={org} canScore={canScore} orgMembership={orgMembership} />}
        {tab === "seasons" && <SeasonsTab org={org} slug={slug} isOrgAdmin={isOrgAdmin} entitlements={entitlements} />}
        {tab === "teams"   && <TeamsTab   org={org} slug={slug} isOrgAdmin={isOrgAdmin} entitlements={entitlements} onOrgColorChange={color => setOrg(prev => ({ ...prev, color }))} />}
        {tab === "players" && <PlayersTab org={org} isOrgAdmin={isOrgAdmin} />}
        {tab === "members" && <MembersTab org={org} isOrgAdmin={isOrgAdmin} entitlements={entitlements} />}
        {tab === "stats"   && <StatsTab   org={org} />}
      </div>
    </div>
  );
}
