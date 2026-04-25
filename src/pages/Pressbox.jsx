import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  buildPlayerStats, buildTeamTotals,
  STAT_LABELS,
  qLabel, entryDisplayInfo,
} from "../components/LaxStats";
import { dbRowToEntry } from "../hooks/useGameEvents";
import GameTimeline from "../components/GameTimeline";

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Config ────────────────────────────────────────────────────────────────────

const STAT_SECTIONS = [
  { heading: "Scoring", rows: [
    { label: "Goals",          key: "goal" },
    { label: "Assists",        key: "assist" },
    { label: "Successful EMO", key: "emo_goal" },
    { label: "Failed EMO",     key: "emo_fail" },
    { label: "EMO %",          pct: (tot) => { const s=tot.emo_goal, f=tot.emo_fail; return (s+f) ? `${Math.round((s/(s+f))*100)}%` : "—"; } },
  ]},
  { heading: "Defense", rows: [
    { label: "Successful MDD", key: "mdd_success" },
    { label: "Failed MDD",     key: "mdd_fail" },
    { label: "MDD %",          pct: (tot) => { const s=tot.mdd_success, f=tot.mdd_fail; return (s+f) ? `${Math.round((s/(s+f))*100)}%` : "—"; } },
    { label: "Saves",          key: "shot_saved" },
    { label: "Save %",         pct: (tot, ti, totals) => { const sogF=totals[1-ti].sog, sv=tot.shot_saved; return sogF ? `${Math.round((sv/sogF)*100)}%` : "—"; } },
    { label: "Forced TOs",     key: "forced_to" },
  ]},
  { heading: "Shooting", rows: [
    { label: "Shots",          key: "shot" },
    { label: "Shot %",         pct: (tot) => tot.shot ? `${Math.round((tot.goal/tot.shot)*100)}%` : "—" },
    { label: "SOG",            key: "sog" },
    { label: "SOG %",          pct: (tot) => tot.sog  ? `${Math.round((tot.goal/tot.sog )*100)}%` : "—" },
    { label: "Blocked",        key: "shot_blocked" },
  ]},
  { heading: "Possession", rows: [
    { label: "Ground Balls",   key: "ground_ball" },
    { label: "Faceoffs Won",   key: "faceoff_win" },
    { label: "Turnovers",      key: "turnover" },
  ]},
  { heading: "Clearing", rows: [
    { label: "Clears",         key: "clear" },
    { label: "Failed Clears",  key: "failed_clear" },
    { label: "Clearing %",     pct: (tot) => { const c=tot.clear, f=tot.failed_clear; return (c+f) ? `${Math.round((c/(c+f))*100)}%` : "—"; } },
    { label: "Rides",          key: "successful_ride" },
    { label: "Failed Rides",   key: "failed_ride" },
  ]},
  { heading: "Penalties", rows: [
    { label: "Technicals",     key: "penalty_tech" },
    { label: "PF Minutes",     key: "penalty_min" },
  ]},
];

const PRESS_STAT_KEYS = ["goal","assist","shot","sog","shot_saved","ground_ball","faceoff_win","turnover","forced_to","penalty_tech","penalty_min"];

// ── Component ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [game, setGame]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [statsQtr, setStatsQtr] = useState("all");
  const [sortKey, setSortKey]   = useState("goal");
  const [playerTeam, setPlayerTeam] = useState(0);
  const [leftPanel, setLeftPanel]   = useState("team"); // "team" | "player"
  const [copied, setCopied]     = useState(false);

  function copyUrl() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const [v2Log, setV2Log] = useState(null);

  useEffect(() => {
    loadGame();
    const channel = supabase.channel(`pressbox-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${id}` },
        (payload) => setGame(prev => prev ? { ...prev, ...payload.new } : payload.new))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "game_events", filter: `game_id=eq.${id}` },
        (payload) => {
          if (payload.new.deleted_at) return;
          const entry = dbRowToEntry(payload.new);
          setV2Log(prev => {
            if (!prev) return [entry];
            if (prev.some(e => e.dbId === entry.dbId)) return prev;
            return [...prev, entry].sort((a, b) => a.seq - b.seq);
          });
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "game_events", filter: `game_id=eq.${id}` },
        (payload) => {
          if (payload.new.deleted_at) {
            setV2Log(prev => prev ? prev.filter(e => e.dbId !== payload.new.id) : prev);
          }
        })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [id]);

  async function loadGame() {
    setLoading(true); setError(null);
    const { data, error: err } = await supabase
      .from("games").select("id, created_at, name, state, schema_ver").eq("id", id).single();
    if (err) { setError(err.message); setLoading(false); return; }
    setGame(data);
    if (data?.schema_ver === 2) {
      const { data: evData } = await supabase
        .from("game_events")
        .select("*")
        .eq("game_id", data.id)
        .is("deleted_at", null)
        .order("seq");
      setV2Log((evData || []).map(dbRowToEntry));
    }
    setLoading(false);
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const state             = game?.state;
  const isV2              = game?.schema_ver === 2;
  const teams             = state?.teams             || [{ name: "Home", color: "#1a6bab" }, { name: "Away", color: "#b84e1a" }];
  const log               = isV2 ? (v2Log ?? []) : (state?.log || []);
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
    [log, statsQtr]);

  const teamTotals    = useMemo(() => buildTeamTotals(filteredLog),  [filteredLog]);
  const playerStats   = useMemo(() => buildPlayerStats(filteredLog), [filteredLog]);
  const sortedPlayers = useMemo(() => [...playerStats].sort((a, b) => b[sortKey] - a[sortKey]), [playerStats, sortKey]);

  const scoringTimeline = useMemo(() => {
    const source = statsQtr === "all" ? log : log.filter(e => e.quarter === parseInt(statsQtr));
    const groups = {}; const order = [];
    source.forEach(e => {
      if (!groups[e.groupId]) { groups[e.groupId] = []; order.push(e.groupId); }
      groups[e.groupId].push(e);
    });
    return order.map(gid => groups[gid])
      .filter(g => g.some(e => ["goal","timeout","penalty_tech","penalty_min"].includes(e.event)))
      .map(g => {
        const goal    = g.find(e => e.event === "goal");
        const timeout = g.find(e => e.event === "timeout");
        const penalty = g.find(e => e.event === "penalty_tech" || e.event === "penalty_min");
        if (goal)    return { type: "goal",    goal,    assist: g.find(e => e.event === "assist") };
        if (timeout) return { type: "timeout", timeout };
        return { type: "penalty", penalty };
      });
  }, [log, statsQtr]);

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

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#888", fontSize: 14, fontFamily: "system-ui, sans-serif" }}>Loading…</div>;
  if (error)   return <div style={{ maxWidth: 400, margin: "40px auto", padding: 20, background: "#fff5f5", border: "1px solid #f0a0a0", borderRadius: 10, color: "#c0392b", fontSize: 14, fontFamily: "system-ui, sans-serif" }}>{error}</div>;

  const latestTime = getLatestTime(log, currentQuarter);

  // Shared style fragments
  const card = { border: "1px solid #e5e5e5", borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 };
  const cardHdr = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 12px", borderBottom: "1px solid #e5e5e5", background: "#f9f9f9", flexShrink: 0 };
  const cardHdrLabel = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#888" };
  const scrollBody = { flex: 1, overflowY: "auto", minHeight: 0 };

  // Table cell styles (condensed)
  const TH  = (sorted) => ({ padding: "5px 6px", textAlign: "right", fontWeight: 600, fontSize: 10, color: sorted ? "#111" : "#888", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid #e5e5e5", background: "#f5f5f5", cursor: "pointer", whiteSpace: "nowrap" });
  const THL = { padding: "5px 10px", textAlign: "left", fontWeight: 600, fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid #e5e5e5", background: "#f5f5f5", whiteSpace: "nowrap" };
  const TD  = (extra={}) => ({ padding: "4px 6px", borderBottom: "1px solid #f0f0f0", color: "#111", textAlign: "right", whiteSpace: "nowrap", ...extra });
  const TDL = (extra={}) => ({ padding: "4px 10px", borderBottom: "1px solid #f0f0f0", color: "#111", textAlign: "left",  whiteSpace: "nowrap", ...extra });
  const TABLE = { width: "100%", fontSize: 12, borderCollapse: "collapse" };

  const tabBtn = (active) => ({
    padding: "3px 10px", fontSize: 11, fontWeight: 600, borderRadius: 8,
    border: "1px solid #ddd", cursor: "pointer",
    background: active ? "#111" : "transparent",
    color: active ? "#fff" : "#888",
  });

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", height: "calc(100vh - var(--footer-h, 36px))", overflow: "hidden", background: "#fff", display: "flex", flexDirection: "column" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", borderBottom: "1px solid #e5e5e5", background: "#fff", flexShrink: 0, flexWrap: "wrap" }}>
        <button style={{ fontSize: 13, fontWeight: 500, color: "#888", background: "none", border: "none", cursor: "pointer", padding: "4px 0", whiteSpace: "nowrap" }} onClick={() => navigate("/")}>← Games</button>
        <img src="/LaxStatsIcon.png" alt="LaxStats" style={{ width: 28, height: 28, objectFit: "contain" }} />
        <span style={{ fontSize: 17, fontWeight: 700, color: "#111", flex: 1, letterSpacing: "-0.01em", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{game?.name || "Game"}</span>
        {gameOver
          ? <span style={{ fontSize: 11, fontWeight: 600, color: "#888", background: "#f0f0f0", borderRadius: 20, padding: "3px 9px" }}>Final</span>
          : <span style={{ fontSize: 11, fontWeight: 600, color: "#fff", background: "#4caf50", borderRadius: 20, padding: "3px 9px" }}>● Live</span>}
        <button style={{ fontSize: 12, fontWeight: 500, color: "#555", background: "#f5f5f5", border: "1px solid #e0e0e0", borderRadius: 20, padding: "4px 10px", cursor: "pointer", whiteSpace: "nowrap" }} onClick={() => navigate(`/games/${id}/view`)}>← View</button>
        <button style={{ fontSize: 12, fontWeight: 500, color: copied ? "#2a7a3b" : "#555", background: copied ? "#e8f5e9" : "#f5f5f5", border: `1px solid ${copied ? "#c8e6c9" : "#e0e0e0"}`, borderRadius: 20, padding: "4px 10px", cursor: copied ? "default" : "pointer", whiteSpace: "nowrap" }} onClick={copyUrl}>
          {copied ? "✓ Copied" : "Copy link"}
        </button>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "10px 20px 10px" }}>
        {!state ? (
          <div style={{ textAlign: "center", padding: "60px 16px", color: "#aaa", fontSize: 14 }}>Game hasn't started yet.</div>
        ) : (<>

          {/* ── Top: score banner + score by quarter + quarter filter ── */}
          <div style={{ flexShrink: 0 }}>

            {/* Score banner */}
            <div style={{ background: "#1a1a1a", borderRadius: 10, padding: "10px 20px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: teamColors[0], textTransform: "uppercase", letterSpacing: "0.05em" }}>{teams[0].name}</div>
                <div style={{ fontSize: 38, fontWeight: 500, color: teamColors[0], lineHeight: 1.1 }}>{totalScores[0]}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: 26, color: "#555" }}>—</span>
                {!gameOver && latestTime && <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{latestTime} · {qLabel(currentQuarter)}</div>}
                {gameOver && <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>Final</div>}
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: teamColors[1], textTransform: "uppercase", letterSpacing: "0.05em" }}>{teams[1].name}</div>
                <div style={{ fontSize: 38, fontWeight: 500, color: teamColors[1], lineHeight: 1.1 }}>{totalScores[1]}</div>
              </div>
            </div>

            {/* Score by Quarter */}
            <div style={{ ...card, marginBottom: 8 }}>
              <div style={{ overflowX: "auto" }}>
                <table style={TABLE}>
                  <thead><tr>
                    <th style={THL}>Team</th>
                    {allQuarters.map(q => (
                      <th key={q} style={{ ...TH(false), color: completedQuarters.includes(q) ? "#888" : "#4caf50" }}>
                        {qLabel(q)}
                        {!completedQuarters.includes(q) && !gameOver && <span style={{ display: "block", fontSize: 8, fontWeight: 400 }}>live</span>}
                      </th>
                    ))}
                    <th style={{ ...TH(false), color: "#111", borderLeft: "1px solid #e5e5e5" }}>Total</th>
                  </tr></thead>
                  <tbody>{[0,1].map(ti => (
                    <tr key={ti}>
                      <td style={TDL({ fontWeight: 600, color: teamColors[ti] })}>{teams[ti].name}</td>
                      {allQuarters.map(q => <td key={q} style={TD()}>{(scoresByQuarter[q]||[0,0])[ti]}</td>)}
                      <td style={TD({ fontWeight: 700, borderLeft: "1px solid #e5e5e5" })}>{totalScores[ti]}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>

            {/* Quarter filter */}
            <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
              <button style={tabBtn(statsQtr === "all")} onClick={() => setStatsQtr("all")}>All</button>
              {completedQuarters.map(q => (
                <button key={q} style={tabBtn(statsQtr === String(q))} onClick={() => setStatsQtr(String(q))}>{qLabel(q)}</button>
              ))}
              {!gameOver && (
                <button style={tabBtn(statsQtr === String(currentQuarter))} onClick={() => setStatsQtr(String(currentQuarter))}>
                  {qLabel(currentQuarter)} <span style={{ fontSize: 9, color: statsQtr === String(currentQuarter) ? "#aaa" : "#4caf50" }}>●</span>
                </button>
              )}
            </div>
          </div>

          {/* ── Two-column layout ── */}
          <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, paddingBottom: 4 }}>

            {/* ══ LEFT: Team Stats / Player Stats ══ */}
            <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div style={{ ...card, flex: 1 }}>
                {/* Panel toggle header */}
                <div style={cardHdr}>
                  <div style={{ display: "flex", gap: 4 }}>
                    {[["team","Team Stats"],["player","Player Stats"]].map(([v, label]) => (
                      <button key={v} onClick={() => setLeftPanel(v)} style={tabBtn(leftPanel === v)}>{label}</button>
                    ))}
                  </div>
                  {leftPanel === "team" && (
                    <span style={{ fontSize: 11, color: "#aaa" }}>
                      <span style={{ color: teamColors[0], marginRight: 10, fontWeight: 600 }}>{teams[0].name}</span>
                      <span style={{ color: teamColors[1], fontWeight: 600 }}>{teams[1].name}</span>
                    </span>
                  )}
                  {leftPanel === "player" && (
                    <div style={{ display: "flex", gap: 4 }}>
                      {[0,1].map(ti => (
                        <button key={ti} onClick={() => setPlayerTeam(ti)} style={{
                          fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 8,
                          border: `1px solid ${teamColors[ti]}`, cursor: "pointer",
                          background: playerTeam === ti ? teamColors[ti] : "transparent",
                          color: playerTeam === ti ? "#fff" : teamColors[ti],
                        }}>{teams[ti]?.name}</button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Panel content */}
                <div style={scrollBody}>
                  {leftPanel === "team" ? (
                    <table style={TABLE}>
                      <tbody>
                        {STAT_SECTIONS.map(section => [
                          <tr key={section.heading}>
                            <td colSpan={3} style={{ padding: "3px 10px 2px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#bbb", background: "#fafafa", borderBottom: "1px solid #f0f0f0" }}>{section.heading}</td>
                          </tr>,
                          ...section.rows.map(row => (
                            <tr key={row.label}>
                              <td style={TDL({ fontSize: 12, color: "#555" })}>{row.label}</td>
                              {[0,1].map(ti => {
                                const val = row.pct
                                  ? row.pct(teamTotals[ti], ti, teamTotals)
                                  : (teamTotals[ti][row.key] || 0);
                                return <td key={ti} style={TD({ color: teamColors[ti], fontWeight: 600, fontSize: 13, fontVariantNumeric: "tabular-nums" })}>{val}</td>;
                              })}
                            </tr>
                          )),
                        ])}
                      </tbody>
                    </table>
                  ) : (
                    sortedPlayers.filter(r => r.teamIdx === playerTeam).length === 0
                      ? <div style={{ textAlign: "center", padding: "24px 16px", color: "#aaa", fontSize: 13 }}>No player stats yet</div>
                      : <div style={{ overflowX: "auto" }}>
                          <table style={TABLE}>
                            <thead><tr>
                              <th style={THL}>Player</th>
                              {PRESS_STAT_KEYS.map(k => (
                                <th key={k} style={TH(sortKey === k)} onClick={() => setSortKey(k)}>
                                  {STAT_LABELS[k]}{sortKey === k ? " ▾" : ""}
                                </th>
                              ))}
                            </tr></thead>
                            <tbody>
                              {sortedPlayers.filter(r => r.teamIdx === playerTeam).map((row, i) => (
                                <tr key={i}>
                                  <td style={TDL()}>
                                    <span style={{ display: "inline-block", width: 18, height: 18, borderRadius: "50%", background: "#f0f0f0", fontSize: 9, fontWeight: 600, textAlign: "center", lineHeight: "18px", marginRight: 4, color: "#888" }}>#{row.player.num}</span>
                                    {row.player.name}
                                  </td>
                                  {PRESS_STAT_KEYS.map(k => (
                                    <td key={k} style={TD({ fontWeight: k === sortKey ? 600 : 400, opacity: row[k] === 0 ? 0.3 : 1 })}>
                                      {k === "penalty_min" && row[k] > 0 ? `${row[k]}m` : row[k]}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                  )}
                </div>
              </div>
            </div>

            {/* ══ RIGHT: Event Log (60%) + Timeline (40%) ══ */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>

              {/* Event Log — 60% */}
              <div style={{ ...card, flex: 6 }}>
                <div style={cardHdr}>
                  <span style={cardHdrLabel}>Event Log</span>
                  <span style={{ fontSize: 11, color: "#aaa" }}>{logGroups.length} entries</span>
                </div>
                <div style={scrollBody}>
                  {logGroups.length === 0
                    ? <div style={{ textAlign: "center", padding: "20px 16px", color: "#aaa", fontSize: 13 }}>No events for this period</div>
                    : (() => {
                        const items = [];
                        let lastQ = null;
                        logGroups.forEach((group, gi) => {
                          const primary = groupPrimary(group);
                          const q = primary.quarter;
                          if (statsQtr === "all" && q !== lastQ) {
                            items.push(<div key={`qd-${q}-${gi}`} style={{ padding: "3px 12px 2px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#bbb", background: "#fafafa", borderBottom: "1px solid #f0f0f0" }}>{qLabel(q)}</div>);
                            lastQ = q;
                          }
                          const { icon, label, player } = entryDisplayInfo(primary);
                          const playerStr = primary.teamStat
                            ? `${teams[primary.teamIdx]?.name} (team)`
                            : (player ? `#${player.num} ${player.name}` : "");
                          const subItems = [];
                          group.forEach(e => {
                            if (e.event === "shot_saved")   subItems.push({ text: `🧤 #${e.player?.num} ${e.player?.name}` });
                            if (e.event === "assist")       subItems.push({ text: `🤝 #${e.player?.num} ${e.player?.name}` });
                            if (e.event === "turnover" && group.some(x => x.event === "forced_to")) subItems.push({ text: `↩️ #${e.player?.num} ${e.player?.name}` });
                            if (e.event === "shot_blocked") subItems.push({ text: `🛡 #${e.player?.num} ${e.player?.name}` });
                          });
                          if (primary.event === "goal" && primary.goalTime)  subItems.push({ text: `⏱ ${primary.goalTime}` });
                          if (primary.event === "goal" && primary.emo)       subItems.push({ text: "⚡ EMO" });
                          if (primary.event === "penalty_min" && primary.nonReleasable) subItems.push({ text: "Non-Releasable", red: true });
                          if (primary.penaltyTime) subItems.push({ text: `⏱ ${primary.penaltyTime}` });
                          if (primary.timeoutTime) subItems.push({ text: `⏱ ${primary.timeoutTime}` });
                          items.push(
                            <div key={primary.groupId} style={{ padding: "6px 12px", borderBottom: "1px solid #f0f0f0" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                                <div style={{ width: 7, height: 7, borderRadius: "50%", background: teamColors[primary.teamIdx], flexShrink: 0 }} />
                                <span style={{ fontWeight: 500, flex: 1, fontSize: 12 }}>{icon} {label}</span>
                                <span style={{ color: "#888", fontSize: 11, whiteSpace: "nowrap" }}>{playerStr}</span>
                                <span style={{ color: teamColors[primary.teamIdx], fontSize: 10, marginLeft: 5, flexShrink: 0 }}>{teams[primary.teamIdx]?.name}</span>
                              </div>
                              {subItems.length > 0 && (
                                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 2, paddingLeft: 14 }}>
                                  {subItems.map((s, idx) => (
                                    <span key={idx} style={{ fontSize: 10, color: s.red ? "#c0392b" : "#888", background: s.red ? "#fff0f0" : "#f5f5f5", borderRadius: 4, padding: "1px 5px", fontWeight: s.red ? 600 : 400 }}>{s.text}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        });
                        return items;
                      })()
                  }
                </div>
              </div>

              {/* Timeline — 40% */}
              <div style={{ ...card, flex: 4 }}>
                <div style={cardHdr}>
                  <span style={cardHdrLabel}>Timeline</span>
                  <span style={{ fontSize: 11, color: "#aaa" }}>{scoringTimeline.length} events</span>
                </div>
                <div style={scrollBody}>
                  <GameTimeline scoringTimeline={scoringTimeline} teams={teams} teamColors={teamColors} compact />
                </div>
              </div>

            </div>{/* end right column */}
          </div>{/* end two-column grid */}
        </>)}
      </div>
    </div>
  );
}
