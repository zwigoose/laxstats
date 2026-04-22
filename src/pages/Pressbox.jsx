import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  buildPlayerStats, buildTeamTotals,
  STAT_KEYS, STAT_LABELS,
  qLabel, entryDisplayInfo,
} from "../components/LaxStats";

// ── Helpers (not exported from LaxStats) ────────────────────────────────────

function groupPrimary(group) {
  return group.find(e => e.event === "goal") || group.find(e => e.event === "shot") || group[0];
}

function getLatestTime(log, currentQuarter) {
  if (!log?.length) return null;
  const toS = t => { const [m, s] = t.split(":").map(Number); return m * 60 + s; };
  const timed = log
    .filter(e => e.quarter === currentQuarter && (e.goalTime || e.timeoutTime || e.penaltyTime))
    .map(e => { const str = e.goalTime || e.timeoutTime || e.penaltyTime; return { str, secs: toS(str) }; });
  if (!timed.length) return null;
  return timed.reduce((min, t) => t.secs < min.secs ? t : min).str;
}

// ── Styles ───────────────────────────────────────────────────────────────────

const S = {
  page:       { fontFamily: "system-ui, sans-serif", padding: "0 0 60px", background: "#fff" },
  header:     { display: "flex", alignItems: "center", gap: 10, padding: "12px 20px", borderBottom: "1px solid #e5e5e5", background: "#fff", position: "sticky", top: 0, zIndex: 10, flexWrap: "wrap" },
  headerTitle:{ fontSize: 17, fontWeight: 700, color: "#111", flex: 1, letterSpacing: "-0.01em", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  backBtn:    { fontSize: 13, fontWeight: 500, color: "#888", background: "none", border: "none", cursor: "pointer", padding: "4px 0", letterSpacing: "0.01em", whiteSpace: "nowrap" },
  liveBadge:  { fontSize: 11, fontWeight: 600, color: "#fff", background: "#4caf50", borderRadius: 20, padding: "3px 9px", whiteSpace: "nowrap" },
  finalBadge: { fontSize: 11, fontWeight: 600, color: "#888", background: "#f0f0f0", borderRadius: 20, padding: "3px 9px", whiteSpace: "nowrap" },
  copyBtn:    { fontSize: 12, fontWeight: 500, color: "#555", background: "#f5f5f5", border: "1px solid #e0e0e0", borderRadius: 20, padding: "4px 10px", cursor: "pointer", whiteSpace: "nowrap" },
  copyBtnDone:{ fontSize: 12, fontWeight: 500, color: "#2a7a3b", background: "#e8f5e9", border: "1px solid #c8e6c9", borderRadius: 20, padding: "4px 10px", cursor: "default", whiteSpace: "nowrap" },
  body:       { padding: "16px 28px 0" },
  loading:    { display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "#888", fontSize: 14, fontFamily: "system-ui, sans-serif" },
  error:      { maxWidth: 400, margin: "40px auto", padding: 20, background: "#fff5f5", border: "1px solid #f0a0a0", borderRadius: 10, color: "#c0392b", fontSize: 14 },
  noGame:     { textAlign: "center", padding: "60px 16px", color: "#aaa", fontSize: 14 },

  // Score banner
  scoreBanner:{ background: "#1a1a1a", color: "#fff", borderRadius: 12, padding: "18px 24px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  scoreTeam:  (c) => ({ fontSize: 13, fontWeight: 600, color: c, textTransform: "uppercase", letterSpacing: "0.05em" }),
  scoreNum:   (c) => ({ fontSize: 44, fontWeight: 500, color: c, lineHeight: 1 }),
  scoreSep:   { fontSize: 32, color: "#555", margin: "0 4px" },
  scoreMeta:  { fontSize: 12, color: "#aaa", marginTop: 4, textAlign: "center" },
  scoreBlock: { textAlign: "center" },

  // Quarter filter
  tabsRow:    { display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  tabBtn:     (active) => ({ padding: "6px 14px", fontSize: 13, border: "1px solid #ddd", borderRadius: 20, background: active ? "#111" : "transparent", color: active ? "#fff" : "#888", cursor: "pointer" }),

  // Section wrapper
  section:    { border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden", marginBottom: 16 },
  sectionTitle:{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#888", padding: "10px 14px 8px", borderBottom: "1px solid #e5e5e5", background: "#f9f9f9", display: "flex", justifyContent: "space-between", alignItems: "center" },
  emptyState: { textAlign: "center", padding: "28px 16px", color: "#aaa", fontSize: 13 },

  // Tables
  table:      { width: "100%", fontSize: 13, borderCollapse: "collapse" },
  th:         (sorted) => ({ padding: "8px 8px", textAlign: "right", fontWeight: 600, fontSize: 11, color: sorted ? "#111" : "#888", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid #e5e5e5", background: "#f5f5f5", cursor: "pointer", whiteSpace: "nowrap" }),
  thLeft:     { padding: "8px 14px", textAlign: "left", fontWeight: 600, fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid #e5e5e5", background: "#f5f5f5", whiteSpace: "nowrap" },
  td:         { padding: "8px 8px", borderBottom: "1px solid #f0f0f0", color: "#111", textAlign: "right", whiteSpace: "nowrap" },
  tdLeft:     { padding: "8px 14px", borderBottom: "1px solid #f0f0f0", color: "#111", textAlign: "left", whiteSpace: "nowrap" },
  numBadge:   { display: "inline-block", width: 22, height: 22, borderRadius: "50%", background: "#f0f0f0", fontSize: 10, fontWeight: 600, textAlign: "center", lineHeight: "22px", marginRight: 5, color: "#888" },

  // Team stats table
  statLabel:  { padding: "7px 14px", borderBottom: "1px solid #f0f0f0", color: "#555", fontSize: 13, textAlign: "left" },
  statVal:    (c) => ({ padding: "7px 14px", borderBottom: "1px solid #f0f0f0", color: c, fontWeight: 600, fontSize: 15, textAlign: "right", fontVariantNumeric: "tabular-nums" }),
  statSection:{ padding: "6px 14px 2px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#bbb", background: "#fafafa", borderBottom: "1px solid #f0f0f0" },

  // Event log
  logList:    { maxHeight: 480, overflowY: "auto" },
  logGroup:   { padding: "9px 14px", borderBottom: "1px solid #f0f0f0" },
  logGroupMain:{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 },
  logDot:     (c) => ({ width: 8, height: 8, borderRadius: "50%", background: c, flexShrink: 0 }),
  logSubChips:{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4, paddingLeft: 16 },
  logChip:    { fontSize: 11, color: "#888", background: "#f5f5f5", borderRadius: 4, padding: "2px 7px" },
  qtrDivider: { padding: "5px 14px 3px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#bbb", background: "#fafafa", borderBottom: "1px solid #f0f0f0" },

  // Timeline
  tlTime:     { fontWeight: 600, color: "#111", fontSize: 14, fontVariantNumeric: "tabular-nums" },
  tlQ:        { display: "block", fontSize: 11, fontWeight: 600, color: "#111", marginTop: 1 },
};

// ── Stat rows config (for team stats table) ──────────────────────────────────

const STAT_SECTIONS = [
  { heading: "Scoring",
    rows: [
      { label: "Goals",         key: "goal" },
      { label: "Assists",       key: "assist" },
      { label: "Successful EMO",key: "emo_goal" },
      { label: "Failed EMO",    key: "emo_fail" },
      { label: "EMO %",         pct: (tot) => { const s=tot.emo_goal, f=tot.emo_fail; return (s+f) ? `${Math.round((s/(s+f))*100)}%` : "—"; } },
    ],
  },
  { heading: "Defense",
    rows: [
      { label: "Successful MDD",key: "mdd_success" },
      { label: "Failed MDD",    key: "mdd_fail" },
      { label: "MDD %",         pct: (tot) => { const s=tot.mdd_success, f=tot.mdd_fail; return (s+f) ? `${Math.round((s/(s+f))*100)}%` : "—"; } },
      { label: "Saves",         key: "shot_saved" },
      { label: "Save %",        pct: (tot, ti, totals) => { const sogF=totals[1-ti].sog, sv=tot.shot_saved; return sogF ? `${Math.round((sv/sogF)*100)}%` : "—"; } },
      { label: "Forced TOs",    key: "forced_to" },
    ],
  },
  { heading: "Shooting",
    rows: [
      { label: "Shots",         key: "shot" },
      { label: "Shot %",        pct: (tot) => tot.shot ? `${Math.round((tot.goal/tot.shot)*100)}%` : "—" },
      { label: "Shots on Goal", key: "sog" },
      { label: "SOG %",         pct: (tot) => tot.sog  ? `${Math.round((tot.goal/tot.sog )*100)}%` : "—" },
      { label: "Blocked Shots", key: "shot_blocked" },
    ],
  },
  { heading: "Possession",
    rows: [
      { label: "Ground Balls",  key: "ground_ball" },
      { label: "Faceoffs Won",  key: "faceoff_win" },
      { label: "Turnovers",     key: "turnover" },
    ],
  },
  { heading: "Clearing",
    rows: [
      { label: "Successful Clears", key: "clear" },
      { label: "Failed Clears",     key: "failed_clear" },
      { label: "Clearing %",        pct: (tot) => { const c=tot.clear, f=tot.failed_clear; return (c+f) ? `${Math.round((c/(c+f))*100)}%` : "—"; } },
      { label: "Successful Rides",  key: "successful_ride" },
      { label: "Failed Rides",      key: "failed_ride" },
    ],
  },
  { heading: "Penalties",
    rows: [
      { label: "Technicals",    key: "penalty_tech" },
      { label: "PF Minutes",    key: "penalty_min" },
    ],
  },
];

// Player stat columns shown in the press box table (announcer-relevant)
const PRESS_STAT_KEYS = ["goal", "assist", "shot", "sog", "shot_saved", "ground_ball", "faceoff_win", "turnover", "forced_to", "penalty_tech", "penalty_min"];

// ── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [game, setGame]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [statsQtr, setStatsQtr] = useState("all");
  const [sortKey, setSortKey]   = useState("goal");
  const [playerTeam, setPlayerTeam] = useState(0);
  const [copied, setCopied]     = useState(false);

  function copyUrl() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  useEffect(() => {
    loadGame();
    const channel = supabase
      .channel(`dash-${id}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${id}`,
      }, (payload) => { setGame(payload.new); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  async function loadGame() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("games")
      .select("id, created_at, name, state")
      .eq("id", id)
      .single();
    if (err) { setError(err.message); setLoading(false); return; }
    setGame(data);
    setLoading(false);
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const state             = game?.state;
  const teams             = state?.teams             || [{ name: "Home", color: "#1a6bab" }, { name: "Away", color: "#b84e1a" }];
  const log               = state?.log               || [];
  const currentQuarter    = state?.currentQuarter    || 1;
  const completedQuarters = state?.completedQuarters || [];
  const gameOver          = state?.gameOver          || false;
  const teamColors        = [teams[0]?.color || "#1a6bab", teams[1]?.color || "#b84e1a"];

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

  const teamTotals    = useMemo(() => buildTeamTotals(filteredLog),  [filteredLog]);
  const playerStats   = useMemo(() => buildPlayerStats(filteredLog), [filteredLog]);
  const sortedPlayers = useMemo(() => [...playerStats].sort((a, b) => b[sortKey] - a[sortKey]), [playerStats, sortKey]);

  // Timeline: goals, timeouts, penalties — newest first
  const scoringTimeline = useMemo(() => {
    const source = statsQtr === "all" ? log : log.filter(e => e.quarter === parseInt(statsQtr));
    const groups = {}; const order = [];
    source.forEach(e => {
      if (!groups[e.groupId]) { groups[e.groupId] = []; order.push(e.groupId); }
      groups[e.groupId].push(e);
    });
    const withScores = [];
    const scores = [0, 0];
    order.map(gid => groups[gid])
      .filter(g => g.some(e => ["goal","timeout","penalty_tech","penalty_min"].includes(e.event)))
      .forEach(g => {
        const goal    = g.find(e => e.event === "goal");
        const timeout = g.find(e => e.event === "timeout");
        const penalty = g.find(e => e.event === "penalty_tech" || e.event === "penalty_min");
        if (goal) scores[goal.teamIdx]++;
        let entry;
        if (goal)    entry = { type: "goal",    goal,    assist: g.find(e => e.event === "assist") };
        else if (timeout) entry = { type: "timeout", timeout };
        else entry = { type: "penalty", penalty };
        withScores.push({ ...entry, scoreSnap: [...scores] });
      });
    return [...withScores].reverse();
  }, [log, statsQtr]);

  // Event log: all events grouped, newest first
  const logGroups = useMemo(() => {
    const source = statsQtr === "all" ? log : log.filter(e => e.quarter === parseInt(statsQtr));
    const groups = {}; const order = [];
    source.forEach(e => {
      if (!groups[e.groupId]) { groups[e.groupId] = []; order.push(e.groupId); }
      groups[e.groupId].push(e);
    });
    return [...order.map(gid => groups[gid])].reverse();
  }, [log, statsQtr]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return <div style={S.loading}>Loading…</div>;
  if (error)   return <div style={S.error}>{error}</div>;

  const hasState   = !!state;
  const latestTime = getLatestTime(log, currentQuarter);

  return (
    <div style={S.page}>
      {/* Responsive two-column grid */}
      <style>{`
        .dash-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
        @media (max-width: 800px) { .dash-grid { grid-template-columns: 1fr; } }
      `}</style>

      {/* ── Sticky header ── */}
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => navigate("/")}>← Games</button>
        <span style={S.headerTitle}>{game?.name || "Game"}</span>
        {gameOver
          ? <span style={S.finalBadge}>Final</span>
          : <span style={S.liveBadge}>● Live</span>
        }
        <button style={S.copyBtn} onClick={() => navigate(`/games/${id}/view`)}>← View</button>
        <button style={copied ? S.copyBtnDone : S.copyBtn} onClick={copyUrl}>
          {copied ? "✓ Copied" : "Copy link"}
        </button>
      </div>

      <div style={S.body}>
        {!hasState ? (
          <div style={S.noGame}>Game hasn't started yet.</div>
        ) : (
          <>
            {/* ── Score banner ── */}
            <div style={S.scoreBanner}>
              <div style={S.scoreBlock}>
                <div style={S.scoreTeam(teamColors[0])}>{teams[0].name}</div>
                <div style={S.scoreNum(teamColors[0])}>{totalScores[0]}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <span style={S.scoreSep}>—</span>
                {!gameOver && latestTime && (
                  <div style={S.scoreMeta}>{latestTime} · {qLabel(currentQuarter)}</div>
                )}
                {gameOver && <div style={S.scoreMeta}>Final</div>}
              </div>
              <div style={S.scoreBlock}>
                <div style={S.scoreTeam(teamColors[1])}>{teams[1].name}</div>
                <div style={S.scoreNum(teamColors[1])}>{totalScores[1]}</div>
              </div>
            </div>

            {/* ── Score by Quarter (full width) ── */}
            <div style={S.section}>
              <div style={S.sectionTitle}><span>Score by Quarter</span></div>
              <div style={{ overflowX: "auto" }}>
                <table style={S.table}>
                  <thead><tr>
                    <th style={S.thLeft}>Team</th>
                    {allQuarters.map(q => (
                      <th key={q} style={{ ...S.th(false), color: completedQuarters.includes(q) ? "#888" : "#4caf50" }}>
                        {qLabel(q)}
                        {!completedQuarters.includes(q) && !gameOver && <span style={{ display: "block", fontSize: 9, fontWeight: 400 }}>live</span>}
                      </th>
                    ))}
                    <th style={{ ...S.th(false), color: "#111", borderLeft: "1px solid #e5e5e5" }}>Total</th>
                  </tr></thead>
                  <tbody>{[0, 1].map(ti => (
                    <tr key={ti}>
                      <td style={{ ...S.tdLeft, fontWeight: 600, color: teamColors[ti] }}>{teams[ti].name}</td>
                      {allQuarters.map(q => <td key={q} style={S.td}>{(scoresByQuarter[q] || [0, 0])[ti]}</td>)}
                      <td style={{ ...S.td, fontWeight: 700, borderLeft: "1px solid #e5e5e5" }}>{totalScores[ti]}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>

            {/* ── Quarter filter ── */}
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

            <div className="dash-grid">
              {/* ══ LEFT COLUMN ══ */}
              <div>

                {/* Team stats */}
                <div style={S.section}>
                  <div style={S.sectionTitle}>
                    <span>Team Stats</span>
                    <span style={{ fontWeight: 400, fontSize: 11 }}>
                      <span style={{ color: teamColors[0], marginRight: 12 }}>{teams[0].name}</span>
                      <span style={{ color: teamColors[1] }}>{teams[1].name}</span>
                    </span>
                  </div>
                  <table style={S.table}>
                    <tbody>
                      {STAT_SECTIONS.map(section => [
                        <tr key={section.heading}>
                          <td colSpan={3} style={S.statSection}>{section.heading}</td>
                        </tr>,
                        ...section.rows.map(row => (
                          <tr key={row.label}>
                            <td style={S.statLabel}>{row.label}</td>
                            {[0, 1].map(ti => {
                              const val = row.pct
                                ? row.pct(teamTotals[ti], ti, teamTotals)
                                : (teamTotals[ti][row.key] || 0);
                              return <td key={ti} style={S.statVal(teamColors[ti])}>{val}</td>;
                            })}
                          </tr>
                        )),
                      ])}
                    </tbody>
                  </table>
                </div>

              </div>{/* end left column */}

              {/* ══ RIGHT COLUMN ══ */}
              <div>

                {/* Player stats */}
                <div style={S.section}>
                  <div style={S.sectionTitle}>
                    <span>Player Stats</span>
                    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                      {[0, 1].map(ti => (
                        <button key={ti} onClick={() => setPlayerTeam(ti)} style={{ fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 10, border: `1px solid ${teamColors[ti]}`, cursor: "pointer", background: playerTeam === ti ? teamColors[ti] : "transparent", color: playerTeam === ti ? "#fff" : teamColors[ti] }}>
                          {teams[ti]?.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  {sortedPlayers.filter(row => row.teamIdx === playerTeam).length === 0
                    ? <div style={S.emptyState}>No player stats yet</div>
                    : <div style={{ overflowX: "auto" }}>
                        <table style={S.table}>
                          <thead><tr>
                            <th style={S.thLeft}>Player</th>
                            {PRESS_STAT_KEYS.map(k => (
                              <th key={k} style={S.th(sortKey === k)} onClick={() => setSortKey(k)}>
                                {STAT_LABELS[k]}{sortKey === k ? " ▾" : ""}
                              </th>
                            ))}
                          </tr></thead>
                          <tbody>
                            {sortedPlayers.filter(row => row.teamIdx === playerTeam).map((row, i) => (
                              <tr key={i}>
                                <td style={S.tdLeft}>
                                  <span style={S.numBadge}>#{row.player.num}</span>{row.player.name}
                                </td>
                                {PRESS_STAT_KEYS.map(k => (
                                  <td key={k} style={{ ...S.td, fontWeight: k === sortKey ? 600 : 400, opacity: row[k] === 0 ? 0.3 : 1 }}>
                                    {k === "penalty_min" && row[k] > 0 ? `${row[k]}m` : row[k]}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                  }
                </div>

                {/* Event log */}
                <div style={S.section}>
                  <div style={S.sectionTitle}>
                    <span>Event Log</span>
                    <span style={{ fontWeight: 400 }}>{logGroups.length} entries</span>
                  </div>
                  {logGroups.length === 0
                    ? <div style={S.emptyState}>No events for this period</div>
                    : <div style={S.logList}>
                        {(() => {
                          const items = [];
                          let lastQ = null;
                          logGroups.forEach((group, gi) => {
                            const primary = groupPrimary(group);
                            const q = primary.quarter;
                            if (statsQtr === "all" && q !== lastQ) {
                              items.push(<div key={`qd-${q}-${gi}`} style={S.qtrDivider}>{qLabel(q)}</div>);
                              lastQ = q;
                            }
                            const { icon, label, player } = entryDisplayInfo(primary);
                            const playerStr = primary.teamStat
                              ? `${teams[primary.teamIdx]?.name} (team)`
                              : (player ? `#${player.num} ${player.name}` : "");
                            const teamName = teams[primary.teamIdx]?.name || "";
                            const subItems = [];
                            group.forEach(e => {
                              if (e.event === "shot_saved")  subItems.push({ text: `🧤 Saved by #${e.player?.num} ${e.player?.name}` });
                              if (e.event === "assist")      subItems.push({ text: `🤝 Assist: #${e.player?.num} ${e.player?.name}` });
                              if (e.event === "turnover" && group.some(x => x.event === "forced_to")) subItems.push({ text: `↩️ TO by #${e.player?.num} ${e.player?.name}` });
                              if (e.event === "shot_blocked") subItems.push({ text: `🛡 Blocked by #${e.player?.num} ${e.player?.name}` });
                            });
                            if (primary.event === "goal" && primary.goalTime)       subItems.push({ text: `⏱ ${primary.goalTime}` });
                            if (primary.event === "goal" && primary.emo)            subItems.push({ text: "⚡ EMO" });
                            if (primary.event === "penalty_min" && primary.nonReleasable) subItems.push({ text: "Non-Releasable", red: true });
                            if (primary.penaltyTime)   subItems.push({ text: `⏱ ${primary.penaltyTime}` });
                            if (primary.timeoutTime)   subItems.push({ text: `⏱ ${primary.timeoutTime}` });
                            items.push(
                              <div key={primary.groupId} style={S.logGroup}>
                                <div style={S.logGroupMain}>
                                  <div style={S.logDot(teamColors[primary.teamIdx])}></div>
                                  <span style={{ fontWeight: 500, flex: 1, fontSize: 13 }}>{icon} {label}</span>
                                  <span style={{ color: "#888", fontSize: 12 }}>{playerStr}</span>
                                  <span style={{ color: teamColors[primary.teamIdx], fontSize: 11, marginLeft: 6, flexShrink: 0 }}>{teamName}</span>
                                </div>
                                {subItems.length > 0 && (
                                  <div style={S.logSubChips}>
                                    {subItems.map((s, idx) => (
                                      <span key={idx} style={s.red ? { ...S.logChip, background: "#fff0f0", color: "#c0392b", fontWeight: 600 } : S.logChip}>{s.text}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          });
                          return items;
                        })()}
                      </div>
                  }
                </div>

                {/* Timeline */}
                <div style={S.section}>
                  <div style={S.sectionTitle}>
                    <span>Timeline</span>
                    <span style={{ fontWeight: 400, fontSize: 11 }}>{scoringTimeline.length} events</span>
                  </div>
                  {scoringTimeline.length === 0
                    ? <div style={S.emptyState}>No scored events yet</div>
                    : <table style={S.table}>
                        <thead><tr>
                          <th style={{ ...S.thLeft, width: 72 }}>Time</th>
                          <th style={S.thLeft}>Team</th>
                          <th style={S.thLeft}>Event</th>
                          <th style={S.thLeft}>Detail</th>
                          <th style={S.th(false)}>Score</th>
                        </tr></thead>
                        <tbody>
                          {scoringTimeline.map((entry, i) => {
                            const scoreCell = (
                              <td style={{ ...S.td, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                                <span style={{ color: teamColors[0] }}>{entry.scoreSnap[0]}</span>
                                <span style={{ color: "#ccc", margin: "0 3px" }}>–</span>
                                <span style={{ color: teamColors[1] }}>{entry.scoreSnap[1]}</span>
                              </td>
                            );

                            if (entry.type === "timeout") {
                              const to = entry.timeout;
                              return (
                                <tr key={i} style={{ background: "#fafafa" }}>
                                  <td style={{ ...S.tdLeft, verticalAlign: "top", paddingTop: 10 }}>
                                    {to.timeoutTime ? <span style={S.tlTime}>{to.timeoutTime}</span> : <span style={{ color: "#ccc" }}>—</span>}
                                    <span style={S.tlQ}>{qLabel(to.quarter)}</span>
                                  </td>
                                  <td style={S.tdLeft}><span style={{ color: teamColors[to.teamIdx], fontWeight: 500 }}>{teams[to.teamIdx]?.name}</span></td>
                                  <td style={{ ...S.tdLeft, color: "#888", fontStyle: "italic" }}>⏸ Timeout</td>
                                  <td style={S.tdLeft}></td>
                                  {scoreCell}
                                </tr>
                              );
                            }

                            if (entry.type === "penalty") {
                              const pen = entry.penalty;
                              const isTech = pen.event === "penalty_tech";
                              const nrTag = pen.nonReleasable ? " NR" : "";
                              return (
                                <tr key={i} style={{ background: "#fffbf5" }}>
                                  <td style={{ ...S.tdLeft, verticalAlign: "top", paddingTop: 10 }}>
                                    {pen.penaltyTime ? <span style={S.tlTime}>{pen.penaltyTime}</span> : <span style={{ color: "#ccc" }}>—</span>}
                                    <span style={S.tlQ}>{qLabel(pen.quarter)}</span>
                                  </td>
                                  <td style={S.tdLeft}><span style={{ color: teamColors[pen.teamIdx], fontWeight: 500 }}>{teams[pen.teamIdx]?.name}</span></td>
                                  <td style={{ ...S.tdLeft, color: "#888", fontStyle: "italic" }}>
                                    {isTech ? "🟨 Technical" : `🟥 Personal (${pen.penaltyMin}min${nrTag})`}
                                  </td>
                                  <td style={S.tdLeft}><span style={{ fontWeight: 500 }}>#{pen.player?.num} {pen.player?.name}</span></td>
                                  {scoreCell}
                                </tr>
                              );
                            }

                            // Goal
                            const { goal, assist } = entry;
                            return (
                              <tr key={i}>
                                <td style={{ ...S.tdLeft, verticalAlign: "top", paddingTop: 10 }}>
                                  {goal.goalTime ? <span style={S.tlTime}>{goal.goalTime}</span> : <span style={{ color: "#ccc" }}>—</span>}
                                  <span style={S.tlQ}>{qLabel(goal.quarter)}</span>
                                </td>
                                <td style={S.tdLeft}><span style={{ color: teamColors[goal.teamIdx], fontWeight: 500 }}>{teams[goal.teamIdx]?.name}</span></td>
                                <td style={S.tdLeft}>
                                  🥍 Goal{goal.emo ? " (EMO)" : ""}
                                </td>
                                <td style={S.tdLeft}>
                                  <span style={{ fontWeight: 500 }}>#{goal.player?.num} {goal.player?.name}</span>
                                  {assist && <span style={{ color: "#888", fontSize: 12, marginLeft: 6 }}>· assist #{assist.player?.num} {assist.player?.name}</span>}
                                </td>
                                {scoreCell}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                  }
                </div>

              </div>{/* end right column */}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
