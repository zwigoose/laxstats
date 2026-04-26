import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useOrgRole } from "../hooks/useOrgRole";
import { qLabel } from "../components/LaxStats";
import { dbRowToEntry } from "../hooks/useGameEvents";

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
  const isV2 = game.schema_ver === 2;
  const score0 = isV2 ? (v2Scores?.[game.id]?.[0] ?? 0) : (s.log || []).filter(e => e.event === "goal" && e.teamIdx === 0).length;
  const score1 = isV2 ? (v2Scores?.[game.id]?.[1] ?? 0) : (s.log || []).filter(e => e.event === "goal" && e.teamIdx === 1).length;
  const started = isV2 ? (score0 > 0 || score1 > 0 || !!s.trackingStarted) : !!s.trackingStarted;
  const gameDate = game.game_date || s.gameDate || game.created_at?.split("T")[0];
  const currentQuarter = s.currentQuarter || 1;
  return { t0: s.teams[0], t1: s.teams[1], score0, score1, gameOver: s.gameOver, started, gameDate, currentQuarter };
}

const S = {
  page:    { fontFamily: "system-ui, sans-serif", minHeight: "100vh", background: "#f5f5f5" },
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
function OrgGameCard({ game, canScore, v2Scores }) {
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
            <button style={S.btnOutline} onClick={() => window.open(`/games/${game.id}/pressbox`, "_blank")}>Press Box</button>
            {canScore && (
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
  const [games, setGames]     = useState([]);
  const [v2Scores, setV2Scores] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("games")
      .select("id, created_at, name, state, schema_ver, game_date, user_id, org_id")
      .eq("org_id", org.id).order("created_at", { ascending: false })
      .then(async ({ data }) => {
        const games = data || [];
        setGames(games);

        // Fetch goal counts from game_events for v2 games
        const v2Ids = games.filter(g => g.schema_ver === 2).map(g => g.id);
        if (v2Ids.length > 0) {
          const { data: totals } = await supabase
            .from("v_game_team_totals")
            .select("game_id, team_idx, goals")
            .in("game_id", v2Ids);
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
      {live.map(g => <OrgGameCard key={g.id} game={g} canScore={canScore} v2Scores={v2Scores} />)}
      {pending.map(g => <OrgGameCard key={g.id} game={g} canScore={canScore} v2Scores={v2Scores} />)}
      {final.length > 0 && (
        <>
          <div style={S.sectionHead}>Completed</div>
          {final.map(g => <OrgGameCard key={g.id} game={g} canScore={canScore} v2Scores={v2Scores} />)}
        </>
      )}
    </div>
  );
}

// ── Seasons tab ───────────────────────────────────────────────────────────────
function SeasonsTab({ org, slug, isOrgAdmin }) {
  const navigate = useNavigate();
  const [seasons, setSeasons]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showNew, setShowNew]       = useState(false);
  const [newName, setNewName]       = useState("");
  const [newStart, setNewStart]     = useState("");
  const [newEnd, setNewEnd]         = useState("");
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState(null);

  useEffect(() => {
    supabase.from("seasons").select("id, name, start_date, end_date")
      .eq("org_id", org.id).order("start_date", { ascending: false })
      .then(({ data }) => { setSeasons(data || []); setLoading(false); });
  }, [org.id]);

  async function handleCreate() {
    if (!newName.trim() || saving) return;
    setSaving(true); setError(null);
    const { data, error: err } = await supabase.from("seasons")
      .insert({ org_id: org.id, name: newName.trim(), start_date: newStart || null, end_date: newEnd || null })
      .select("id, name, start_date, end_date").single();
    if (err) { setError(err.message); setSaving(false); return; }
    setSeasons(prev => [data, ...prev]);
    setShowNew(false); setNewName(""); setNewStart(""); setNewEnd("");
    setSaving(false);
  }

  if (loading) return <div style={S.loading}>Loading…</div>;

  return (
    <div>
      {isOrgAdmin && !showNew && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button style={S.btnPrimary} onClick={() => setShowNew(true)}>＋ New Season</button>
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
      {seasons.length === 0 && !showNew && <div style={{ color: "#aaa", fontSize: 14, padding: "32px 0", textAlign: "center" }}>No seasons yet.</div>}
      {seasons.map(s => (
        <div key={s.id} style={{ ...S.card, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}
          onClick={() => navigate(`/orgs/${slug}/seasons/${s.id}`)} role="button" style={{ ...S.card, padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#111" }}>{s.name}</div>
            {(s.start_date || s.end_date) && (
              <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>
                {s.start_date && formatDate(s.start_date)}{s.start_date && s.end_date && " – "}{s.end_date && formatDate(s.end_date)}
              </div>
            )}
          </div>
          <span style={{ color: "#ccc", fontSize: 16 }}>›</span>
        </div>
      ))}
    </div>
  );
}

// ── Members tab ───────────────────────────────────────────────────────────────
function MembersTab({ org, isOrgAdmin }) {
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
    const { data } = await supabase.rpc("get_org_members", { p_org_id: org.id });
    setMembers(data || []);
    setLoading(false);
  }

  async function handleInvite() {
    if (!username.trim() || inviting) return;
    setInviting(true); setError(null);
    const { error: err } = await supabase.rpc("invite_org_member", {
      p_org_id: org.id, p_username: username.trim(), p_role: role,
    });
    if (err) { setError(err.message); setInviting(false); return; }
    setUsername(""); setShowInvite(false); setInviting(false);
    loadMembers();
  }

  async function handleRemove(userId) {
    setRemovingId(userId);
    await supabase.rpc("remove_org_member", { p_org_id: org.id, p_user_id: userId });
    setMembers(prev => prev.filter(m => m.user_id !== userId));
    setRemovingId(null);
  }

  if (loading) return <div style={S.loading}>Loading…</div>;

  return (
    <div>
      {isOrgAdmin && !showInvite && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button style={S.btnPrimary} onClick={() => setShowInvite(true)}>＋ Invite Member</button>
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
        <div key={m.user_id} style={{ ...S.card, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>{m.display_name}</div>
          </div>
          <span style={S.badge(m.role)}>{ROLE_LABELS[m.role] ?? m.role}</span>
          {isOrgAdmin && (
            <button onClick={() => handleRemove(m.user_id)} disabled={removingId === m.user_id}
              style={{ fontSize: 11, color: "#c0392b", background: "none", border: "1px solid #f0a0a0", borderRadius: 6, cursor: "pointer", padding: "3px 8px" }}>
              {removingId === m.user_id ? "…" : "Remove"}
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
  const navigate = useNavigate();
  const { user, orgMemberships } = useAuth();
  const [org, setOrg]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [tab, setTab]       = useState("games");

  useEffect(() => {
    supabase.from("organizations").select("id, name, slug, plan")
      .eq("slug", slug).single()
      .then(({ data, error: err }) => {
        if (err) setError("Organization not found.");
        else setOrg(data);
        setLoading(false);
      });
  }, [slug]);

  const { role, isOrgAdmin, canScore } = useOrgRole(org?.id);
  const orgMembership = org ? orgMemberships.find(m => m.org_id === org.id) ?? null : null;

  if (loading) return <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ color: "#aaa", fontSize: 14 }}>Loading…</div></div>;
  if (error || !org) return <div style={{ ...S.page, padding: 40, textAlign: "center", color: "#c0392b", fontSize: 14 }}>{error || "Not found."}</div>;

  const tabs = [
    ["games",   "Games"],
    ["seasons", "Seasons"],
    ["teams",   "Teams"],
    ["members", "Members"],
  ];

  return (
    <div style={S.page}>
      <div style={S.header}>
        <button style={S.back} onClick={() => navigate("/")}>← Home</button>
        <span style={S.orgName}>{org.name}</span>
        {role && <span style={S.badge(role)}>{ROLE_LABELS[role] ?? role}</span>}
        {isOrgAdmin && (
          <button style={{ ...S.btnOutline, fontSize: 12, color: "rgba(255,255,255,0.6)", borderColor: "rgba(255,255,255,0.2)", background: "transparent" }}
            onClick={() => navigate(`/orgs/${slug}/teams`)}>
            Manage Teams
          </button>
        )}
      </div>

      <div style={S.body}>
        <div style={S.tabBar}>
          {tabs.map(([id, label]) => (
            <button key={id} style={S.tab(tab === id)} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        {tab === "games"   && <GamesTab   org={org} canScore={canScore} orgMembership={orgMembership} />}
        {tab === "seasons" && <SeasonsTab org={org} slug={slug} isOrgAdmin={isOrgAdmin} />}
        {tab === "teams"   && (
          <div>
            <button style={{ ...S.btnPrimary, marginBottom: 16 }} onClick={() => navigate(`/orgs/${slug}/teams`)}>
              Manage Teams →
            </button>
          </div>
        )}
        {tab === "members" && <MembersTab org={org} isOrgAdmin={isOrgAdmin} />}
      </div>
    </div>
  );
}
