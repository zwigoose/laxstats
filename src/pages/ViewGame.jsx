import { STAT_KEYS, STAT_LABELS, qLabel, isOT } from "../utils/game";
import { buildPlayerStats, buildTeamTotals } from "../utils/stats";
import { dbRowToEntry } from "../hooks/useGameEvents";
import GameTimeline from "../components/GameTimeline";

function getLatestTime(log, currentQuarter) {
  if (!log?.length) return null;
  const toS = t => { const [m, s] = t.split(":").map(Number); return m * 60 + s; };
  const timed = log
    .filter(e => e.quarter === currentQuarter && (e.goalTime || e.timeoutTime || e.penaltyTime))
    .map(e => { const str = e.goalTime || e.timeoutTime || e.penaltyTime; return { str, secs: toS(str) }; });
  if (!timed.length) return null;
  return timed.reduce((min, t) => t.secs < min.secs ? t : min).str;
}

// ── Styles (matches LaxStats style conventions) ──────────────────────────────
const S = {
  page: { fontFamily: "system-ui, sans-serif", maxWidth: 600, margin: "0 auto", padding: "0 0 40px" },
  header: { display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid #e5e5e5", background: "#fff", position: "sticky", top: 0, zIndex: 10, fontFamily: "system-ui, sans-serif" },
  backBtn: { fontSize: 13, fontWeight: 500, color: "#888", background: "none", border: "none", cursor: "pointer", padding: "4px 0", letterSpacing: "0.01em" },
  headerTitle: { fontSize: 17, fontWeight: 700, color: "#111", flex: 1, letterSpacing: "-0.01em" },
  liveBadge: { fontSize: 11, fontWeight: 600, color: "#fff", background: "#4caf50", borderRadius: 20, padding: "3px 9px" },
  finalBadge: { fontSize: 11, fontWeight: 600, color: "#888", background: "#f0f0f0", borderRadius: 20, padding: "3px 9px" },
  copyBtn: { fontSize: 12, fontWeight: 500, color: "#555", background: "#f5f5f5", border: "1px solid #e0e0e0", borderRadius: 20, padding: "4px 10px", cursor: "pointer", whiteSpace: "nowrap" },
  copyBtnDone: { fontSize: 12, fontWeight: 500, color: "#2a7a3b", background: "#e8f5e9", border: "1px solid #c8e6c9", borderRadius: 20, padding: "4px 10px", cursor: "default", whiteSpace: "nowrap" },
  body: { padding: "0 16px" },
  loading: { display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "#888", fontSize: 14 },
  error: { maxWidth: 400, margin: "40px auto", padding: 20, background: "#fff5f5", border: "1px solid #f0a0a0", borderRadius: 10, color: "#c0392b", fontSize: 14 },
  finalBanner: { background: "#1a1a1a", color: "#fff", borderRadius: 12, padding: "20px", textAlign: "center", marginBottom: 20, marginTop: 16 },
  scoreHeader: { display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", marginBottom: 16, gap: 12, paddingTop: 16 },
  scoreBig: { fontSize: 38, fontWeight: 500, textAlign: "center", letterSpacing: 2 },
  tableWrap: { border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden", marginBottom: 20 },
  tableTitle: { fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#888", padding: "10px 14px 8px", borderBottom: "1px solid #e5e5e5", background: "#f9f9f9", display: "flex", justifyContent: "space-between", alignItems: "center" },
  table: { width: "100%", fontSize: 13, borderCollapse: "collapse" },
  thLeft: { padding: "8px 14px", textAlign: "left", fontWeight: 600, fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid #e5e5e5", background: "#f5f5f5", whiteSpace: "nowrap" },
  th: (sorted) => ({ padding: "8px 8px", textAlign: "right", fontWeight: 600, fontSize: 11, color: sorted ? "#111" : "#888", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid #e5e5e5", background: "#f5f5f5", cursor: "pointer", whiteSpace: "nowrap" }),
  tdLeft: { padding: "9px 14px", borderBottom: "1px solid #f0f0f0", color: "#111", textAlign: "left", whiteSpace: "nowrap" },
  td: { padding: "9px 8px", borderBottom: "1px solid #f0f0f0", color: "#111", textAlign: "right" },
  numBadge: { display: "inline-block", width: 24, height: 24, borderRadius: "50%", background: "#f0f0f0", fontSize: 11, fontWeight: 600, textAlign: "center", lineHeight: "24px", marginRight: 6, color: "#888" },
  summaryGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 },
  summaryCard: { background: "#f7f7f7", borderRadius: 10, padding: "12px 14px" },
  summaryLabel: { fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 },
  summaryRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 },
  tabsRow: { display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" },
  tabBtn: (active) => ({ padding: "6px 14px", fontSize: 13, border: "1px solid #ddd", borderRadius: 20, background: active ? "#111" : "transparent", color: active ? "#fff" : "#888", cursor: "pointer" }),
  emptyState: { textAlign: "center", padding: "40px 16px", color: "#aaa", fontSize: 14 },
  noGame: { textAlign: "center", padding: "40px 16px", color: "#aaa", fontSize: 14 },
};

export default function ViewGame() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statsTab, setStatsTab] = useState("summary");
  const [statsQtr, setStatsQtr] = useState("all");
  const [sortKey, setSortKey] = useState("goal");
  const [copied, setCopied] = useState(false);
  const [hasPressbox, setHasPressbox] = useState(false);
  const [inviteLink,  setInviteLink]  = useState(null);
  const [inviteState, setInviteState] = useState("idle"); // idle | generating | ready | copied | error
  const [inviteError, setInviteError] = useState(null);

  function copyUrl() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function generateInviteLink() {
    setInviteState("generating");
    setInviteError(null);
    const { data: token, error: err } = await supabase.rpc("create_scorekeeper_invite", { p_game_id: id });
    if (err || !token) {
      setInviteError(err?.message || "Failed to generate link");
      setInviteState("error");
      return;
    }
    setInviteLink(`${window.location.origin}/games/${id}/score?token=${token}`);
    setInviteState("ready");
  }

  function copyInviteLink() {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setInviteState("copied");
      setTimeout(() => setInviteState("ready"), 2000);
    });
  }

  useEffect(() => {
    loadGame();

    // Subscribe to changes on the games row (works for both v1 and v2)
    const channel = supabase.channel(`viewgame-${id}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${id}`,
      }, (payload) => {
        setGame(prev => prev ? { ...prev, ...payload.new } : payload.new);
      })
      // v2: subscribe to new game_events
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "game_events", filter: `game_id=eq.${id}`,
      }, (payload) => {
        if (payload.new.deleted_at) return;
        const entry = dbRowToEntry(payload.new);
        setV2Log(prev => {
          if (!prev) return [entry];
          if (prev.some(e => e.dbId === entry.dbId)) return prev;
          return [...prev, entry].sort((a, b) => a.seq - b.seq);
        });
      })
      // v2: subscribe to soft-deletes
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "game_events", filter: `game_id=eq.${id}`,
      }, (payload) => {
        if (payload.new.deleted_at) {
          setV2Log(prev => prev ? prev.filter(e => e.dbId !== payload.new.id) : prev);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // v2: separate event log state
  const [v2Log, setV2Log] = useState(null);

  async function loadGame() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("games")
      .select("id, created_at, name, state, schema_ver, org_id, pressbox_enabled, user_id")
      .eq("id", id)
      .single();
    if (err) { setError(err.message); setLoading(false); return; }
    setGame(data);

    // Pressbox: per-game override OR org feature flag
    if (data?.pressbox_enabled) {
      setHasPressbox(true);
    } else if (data?.org_id) {
      const { data: limit } = await supabase.rpc("org_feature_limit", {
        p_org_id: data.org_id, p_feature_id: "pressbox",
      });
      setHasPressbox(limit !== 0);
    }

    // v2: load event log from game_events table
    if (data?.schema_ver === 2) {
      const { data: evData } = await supabase
        .from("game_events")
        .select("*")
        .eq("game_id", id)
        .is("deleted_at", null)
        .order("seq");
      setV2Log((evData || []).map(dbRowToEntry));
    }

    setLoading(false);
  }

  // ── Derived from game state ──────────────────────────────────────
  const state = game?.state;
  const isV2 = game?.schema_ver === 2;
  const teams = state?.teams || [{ name: "Home", color: "#1a6bab" }, { name: "Away", color: "#b84e1a" }];
  const log = isV2 ? (v2Log ?? []) : (state?.log || []);
  const currentQuarter = state?.currentQuarter || 1;
  const completedQuarters = state?.completedQuarters || [];
  const gameOver = state?.gameOver || false;
  const teamColors = [teams[0]?.color || "#1a6bab", teams[1]?.color || "#b84e1a"];

  const totalScores = useMemo(() => [
    log.filter(e => e.event === "goal" && e.teamIdx === 0).length,
    log.filter(e => e.event === "goal" && e.teamIdx === 1).length,
  ], [log]);

  const scoresByQuarter = useMemo(() => {
    const qs = {};
    log.filter(e => e.event === "goal").forEach(e => {
      if (!qs[e.quarter]) qs[e.quarter] = [0, 0];
      qs[e.quarter][e.teamIdx]++;
    });
    return qs;
  }, [log]);

  const allQuarters = useMemo(() => {
    const qs = new Set([...completedQuarters, currentQuarter]);
    return [...qs].sort((a, b) => a - b);
  }, [completedQuarters, currentQuarter]);

  const filteredLog = useMemo(() =>
    statsQtr === "all" ? log : log.filter(e => e.quarter === parseInt(statsQtr)),
    [log, statsQtr]
  );

  const playerStats = useMemo(() => buildPlayerStats(filteredLog), [filteredLog]);
  const teamTotals = useMemo(() => buildTeamTotals(filteredLog), [filteredLog]);
  const sortedPlayers = useMemo(() => [...playerStats].sort((a, b) => b[sortKey] - a[sortKey]), [playerStats, sortKey]);

  const shotPct  = (ti) => { const s = teamTotals[ti].shot,  g = teamTotals[ti].goal;          return s     ? `${Math.round((g/s)*100)}%` : "—"; };
  const sogPct   = (ti) => { const sog = teamTotals[ti].sog, g = teamTotals[ti].goal;           return sog   ? `${Math.round((g/sog)*100)}%` : "—"; };
  const clearPct = (ti) => { const c = teamTotals[ti].clear, f = teamTotals[ti].failed_clear;   return (c+f) ? `${Math.round((c/(c+f))*100)}%` : "—"; };
  const emoPct   = (ti) => { const s = teamTotals[ti].emo_goal,    f = teamTotals[ti].emo_fail;  return (s+f) ? `${Math.round((s/(s+f))*100)}%` : "—"; };
  const mddPct   = (ti) => { const s = teamTotals[ti].mdd_success, f = teamTotals[ti].mdd_fail; return (s+f) ? `${Math.round((s/(s+f))*100)}%` : "—"; };
  const savePct = (ti) => {
    const sogFaced = teamTotals[1 - ti].sog;
    const saves = teamTotals[ti].shot_saved;
    return sogFaced ? `${Math.round((saves / sogFaced) * 100)}%` : "—";
  };

  const scoringTimeline = useMemo(() => {
    const source = statsQtr === "all" ? log : log.filter(e => e.quarter === parseInt(statsQtr));
    const groups = {};
    const order = [];
    source.forEach(e => {
      if (!groups[e.groupId]) { groups[e.groupId] = []; order.push(e.groupId); }
      groups[e.groupId].push(e);
    });
    return order
      .map(gid => groups[gid])
      .filter(g => g.some(e => e.event === "goal" || e.event === "timeout" || e.event === "penalty_tech" || e.event === "penalty_min"))
      .map(g => {
        const goal = g.find(e => e.event === "goal");
        const timeout = g.find(e => e.event === "timeout");
        const penalty = g.find(e => e.event === "penalty_tech" || e.event === "penalty_min");
        if (goal) return { type: "goal", goal, assist: g.find(e => e.event === "assist") };
        if (timeout) return { type: "timeout", timeout };
        return { type: "penalty", penalty };
      });
  }, [log, statsQtr]);

  if (loading) return <div style={{ ...S.loading, fontFamily: "system-ui, sans-serif" }}>Loading game…</div>;
  if (error) return <div style={{ ...S.error, fontFamily: "system-ui, sans-serif" }}>{error}</div>;

  const hasState = !!state;

  return (
    <div style={S.page}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => navigate("/")}>← Games</button>
        <img src="/LaxStatsIcon.png" alt="LaxStats" style={{ width: 28, height: 28, objectFit: "contain" }} />
        <span style={S.headerTitle}>{game?.name || "Game"}</span>
        {gameOver
          ? <span style={S.finalBadge}>Final</span>
          : <span style={S.liveBadge}>● Live</span>
        }
        {hasPressbox && (
          <button style={S.copyBtn} onClick={() => window.open(`/games/${id}/pressbox`, "_blank")}>Press Box ↗</button>
        )}
        {(user?.id === game?.user_id || isAdmin) && game?.schema_ver === 2 && !gameOver && (
          <button style={(inviteLink || inviteState === "error") ? { ...S.copyBtnDone, cursor: "pointer" } : S.copyBtn}
            onClick={() => {
              if (inviteLink || inviteState === "error") { setInviteLink(null); setInviteState("idle"); setInviteError(null); }
              else generateInviteLink();
            }}
            disabled={inviteState === "generating"}>
            {inviteState === "generating" ? "…" : (inviteLink || inviteState === "error") ? "Hide invite" : "Invite scorer"}
          </button>
        )}
        <button style={copied ? S.copyBtnDone : S.copyBtn} onClick={copyUrl}>
          {copied ? "✓ Copied" : "Copy link"}
        </button>
      </div>

      {inviteState === "error" && (
        <div style={{ padding: "8px 16px", background: "#fff5f5", borderBottom: "1px solid #fdd", fontFamily: "system-ui, sans-serif", fontSize: 12, color: "#c0392b", maxWidth: 600, margin: "0 auto" }}>
          Could not generate invite link: {inviteError}
        </div>
      )}

      {inviteLink && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", background: "#f0f7ff", borderBottom: "1px solid #c8dff5", fontFamily: "system-ui, sans-serif", maxWidth: 600, margin: "0 auto" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#1a6bab", whiteSpace: "nowrap" }}>Scorer invite</span>
          <span style={{ flex: 1, fontSize: 11, color: "#444", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" }}>{inviteLink}</span>
          <button onClick={copyInviteLink} style={{ padding: "4px 12px", fontSize: 11, fontWeight: 600, background: inviteState === "copied" ? "#2a7a3b" : "#1a6bab", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap" }}>
            {inviteState === "copied" ? "Copied ✓" : "Copy"}
          </button>
          <button onClick={generateInviteLink} style={{ padding: "4px 10px", fontSize: 11, color: "#1a6bab", background: "transparent", border: "1px solid #b3d4f0", borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap" }}>
            New link
          </button>
          <span style={{ fontSize: 10, color: "#999", whiteSpace: "nowrap" }}>Expires 24h</span>
        </div>
      )}

      <div style={S.body}>
        {!hasState ? (
          <div style={S.noGame}>Game hasn't started yet. Check back when the scorekeeper begins tracking.</div>
        ) : (
          <>
            {/* Latest known time — shown above score for live games */}
            {!gameOver && (() => {
              const t = getLatestTime(log, currentQuarter);
              return t ? (
                <div style={{ textAlign: "center", padding: "10px 0 0", fontSize: 13, color: "#888" }}>
                  <span style={{ fontWeight: 600, color: "#111" }}>{t}</span> remaining · {qLabel(currentQuarter)}
                </div>
              ) : null;
            })()}

            {/* Score / final banner */}
            {gameOver ? (
              <div style={S.finalBanner}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#aaa", marginBottom: 8 }}>Final</div>
                <div style={{ fontSize: 42, fontWeight: 500, letterSpacing: 4, marginBottom: 6 }}>
                  <span style={{ color: teamColors[0] }}>{totalScores[0]}</span>
                  <span style={{ color: "#555", margin: "0 10px" }}>—</span>
                  <span style={{ color: teamColors[1] }}>{totalScores[1]}</span>
                </div>
                <div style={{ fontSize: 13, color: "#aaa" }}>
                  {totalScores[0] > totalScores[1] ? teams[0].name : teams[1].name} wins
                  {allQuarters.some(q => isOT(q)) ? " in overtime" : ""}
                </div>
              </div>
            ) : (
              <div style={S.scoreHeader}>
                <div style={{ fontSize: 13, fontWeight: 600, color: teamColors[0] }}>{teams[0].name}</div>
                <div style={S.scoreBig}>
                  <span style={{ color: teamColors[0] }}>{totalScores[0]}</span>
                  <span style={{ color: "#ddd", margin: "0 8px" }}>—</span>
                  <span style={{ color: teamColors[1] }}>{totalScores[1]}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: teamColors[1], textAlign: "right" }}>{teams[1].name}</div>
              </div>
            )}

            {/* Quarter score grid */}
            {allQuarters.length > 1 && (
              <div style={{ ...S.tableWrap, marginBottom: 20 }}>
                <table style={{ ...S.table, fontSize: 13 }}>
                  <thead><tr>
                    <th style={S.thLeft}>Team</th>
                    {allQuarters.map(q => (
                      <th key={q} style={{ ...S.th(false), color: completedQuarters.includes(q) ? "#888" : "#4caf50" }}>
                        {qLabel(q)}
                        {!completedQuarters.includes(q) && !gameOver && (
                          <span style={{ display: "block", fontSize: 9, color: "#4caf50", fontWeight: 400 }}>live</span>
                        )}
                      </th>
                    ))}
                    <th style={{ ...S.th(false), color: "#111", borderLeft: "1px solid #e5e5e5" }}>Total</th>
                  </tr></thead>
                  <tbody>{[0, 1].map(ti => (
                    <tr key={ti}>
                      <td style={{ ...S.tdLeft, fontWeight: 600, color: teamColors[ti] }}>{teams[ti].name}</td>
                      {allQuarters.map(q => <td key={q} style={S.td}>{(scoresByQuarter[q] || [0, 0])[ti]}</td>)}
                      <td style={{ ...S.td, fontWeight: 600, borderLeft: "1px solid #e5e5e5" }}>{totalScores[ti]}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}

            {/* Quarter filter */}
            <div style={S.tabsRow}>
              <button style={S.tabBtn(statsQtr === "all")} onClick={() => setStatsQtr("all")}>All</button>
              {completedQuarters.map(q => (
                <button key={q} style={S.tabBtn(statsQtr === String(q))} onClick={() => setStatsQtr(String(q))}>{qLabel(q)}</button>
              ))}
              {!gameOver && (
                <button style={S.tabBtn(statsQtr === String(currentQuarter))} onClick={() => setStatsQtr(String(currentQuarter))}>
                  {qLabel(currentQuarter)} <span style={{ fontSize: 10, color: statsQtr === String(currentQuarter) ? "#aaa" : "#4caf50" }}>●</span>
                </button>
              )}
            </div>

            {/* Stats sub-tabs */}
            <div style={S.tabsRow}>
              {["summary", "players", "timeline"].map(t => (
                <button key={t} style={S.tabBtn(statsTab === t)} onClick={() => setStatsTab(t)}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {/* Summary */}
            {statsTab === "summary" && (
              <div style={S.summaryGrid}>
                {[
                  { heading: "Scoring" },
                  { label: "Goals", key: "goal" }, { label: "Assists", key: "assist" },
                  { label: "Successful EMO", key: "emo_goal" }, { label: "Failed EMO", key: "emo_fail" },
                  { label: "EMO %", custom: emoPct },
                  { heading: "Defense" },
                  { label: "Successful MDD", key: "mdd_success" }, { label: "Failed MDD", key: "mdd_fail" },
                  { label: "MDD %", custom: mddPct },
                  { label: "Saves", key: "shot_saved" }, { label: "Save %", custom: savePct },
                  { label: "Forced TOs", key: "forced_to" },
                  { heading: "Shooting" },
                  { label: "Total Shots", key: "shot" }, { label: "Shot %", custom: shotPct },
                  { label: "Shots on Goal", key: "sog" }, { label: "SOG %", custom: sogPct },
                  { label: "Blocked Shots", key: "shot_blocked" },
                  { heading: "Possession" },
                  { label: "Ground Balls", key: "ground_ball" }, { label: "Faceoffs Won", key: "faceoff_win" },
                  { label: "Turnovers", key: "turnover" },
                  { heading: "Clearing" },
                  { label: "Successful Clears", key: "clear" }, { label: "Failed Clears", key: "failed_clear" },
                  { label: "Clearing %", custom: clearPct },
                  { label: "Successful Rides", key: "successful_ride" }, { label: "Failed Rides", key: "failed_ride" },
                  { heading: "Penalties" },
                  { label: "Technicals", key: "penalty_tech" }, { label: "PF Minutes", key: "penalty_min" },
                ].map((item) => item.heading ? (
                  <div key={item.heading} style={{ gridColumn: "1 / -1", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#bbb", padding: "8px 2px 2px" }}>{item.heading}</div>
                ) : (
                  <div key={item.label} style={S.summaryCard}>
                    <div style={S.summaryLabel}>{item.label}</div>
                    {[0, 1].map(ti => (
                      <div key={ti} style={S.summaryRow}>
                        <div style={{ fontSize: 12, color: teamColors[ti] }}>{teams[ti].name}</div>
                        <div style={{ fontSize: 20, fontWeight: 500, color: teamColors[ti] }}>
                          {item.custom ? item.custom(ti) : (teamTotals[ti][item.key] || 0)}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Players */}
            {statsTab === "players" && (
              filteredLog.filter(e => !e.teamStat).length === 0
                ? <div style={S.emptyState}>No player stats for this period</div>
                : <div style={S.tableWrap}>
                    <div style={S.tableTitle}>
                      <span>Player stats</span>
                      <span style={{ fontWeight: 400, fontSize: 11 }}>tap column to sort</span>
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={S.table}>
                        <thead><tr>
                          <th style={S.thLeft}>Player</th>
                          {STAT_KEYS.filter(k => k !== "clear" && k !== "failed_clear" && k !== "successful_ride" && k !== "failed_ride" && k !== "mdd_success" && k !== "mdd_fail" && k !== "emo_fail" && k !== "shot_post").map(k => (
                            <th key={k} style={S.th(sortKey === k)} onClick={() => setSortKey(k)}>
                              {STAT_LABELS[k]}{sortKey === k ? " ▾" : ""}
                            </th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {[0, 1].map(ti => {
                            const rows = sortedPlayers.filter(p => p.teamIdx === ti);
                            if (!rows.length) return null;
                            return [
                              <tr key={`h-${ti}`}>
                                <td colSpan={STAT_KEYS.length} style={{ padding: "8px 14px 4px", fontSize: 11, fontWeight: 600, color: teamColors[ti], background: "#fafafa" }}>
                                  {teams[ti].name.toUpperCase()}
                                </td>
                              </tr>,
                              ...rows.map((row, i) => (
                                <tr key={`${ti}-${i}`}>
                                  <td style={S.tdLeft}>
                                    <span style={S.numBadge}>#{row.player.num}</span>{row.player.name}
                                  </td>
                                  {STAT_KEYS.filter(k => k !== "clear" && k !== "failed_clear" && k !== "successful_ride" && k !== "failed_ride" && k !== "mdd_success" && k !== "mdd_fail" && k !== "emo_fail" && k !== "shot_post").map(k => (
                                    <td key={k} style={{ ...S.td, fontWeight: k === sortKey ? 600 : 400, opacity: row[k] === 0 ? 0.3 : 1 }}>
                                      {k === "penalty_min" && row[k] > 0 ? `${row[k]}m` : row[k]}
                                    </td>
                                  ))}
                                </tr>
                              )),
                            ];
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
            )}

            {/* Timeline */}
            {statsTab === "timeline" && (
              <div style={S.tableWrap}>
                <div style={S.tableTitle}><span>Timeline</span></div>
                <GameTimeline scoringTimeline={scoringTimeline} teams={teams} teamColors={teamColors} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}