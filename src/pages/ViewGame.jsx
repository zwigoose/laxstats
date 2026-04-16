import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  buildPlayerStats, buildTeamTotals,
  STAT_KEYS, STAT_LABELS,
  qLabel, isOT,
} from "../components/LaxStats";

// ── Styles (matches LaxStats style conventions) ──────────────────────────────
const S = {
  page: { fontFamily: "system-ui, sans-serif", maxWidth: 600, margin: "0 auto", padding: "0 0 40px" },
  header: { display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid #e5e5e5", background: "#fff", position: "sticky", top: 0, zIndex: 10 },
  backBtn: { fontSize: 13, color: "#888", background: "none", border: "none", cursor: "pointer", padding: "4px 0" },
  headerTitle: { fontSize: 14, fontWeight: 500, color: "#111", flex: 1 },
  liveBadge: { fontSize: 11, fontWeight: 600, color: "#fff", background: "#4caf50", borderRadius: 20, padding: "3px 9px" },
  finalBadge: { fontSize: 11, fontWeight: 600, color: "#888", background: "#f0f0f0", borderRadius: 20, padding: "3px 9px" },
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
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statsTab, setStatsTab] = useState("summary");
  const [statsQtr, setStatsQtr] = useState("all");
  const [sortKey, setSortKey] = useState("goal");

  useEffect(() => {
    loadGame();
    // Subscribe to realtime changes on this game row
    const channel = supabase
      .channel(`game-${id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "games",
        filter: `id=eq.${id}`,
      }, (payload) => {
        console.log("[ViewGame] realtime UPDATE received:", payload);
        console.log("[ViewGame] new state field:", payload.new?.state);
        setGame(payload.new);
      })
      .subscribe((status) => {
        console.log("[ViewGame] realtime subscription status:", status);
      });

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  async function loadGame() {
    setLoading(true);
    setError(null);
    console.log("[ViewGame] fetching game id:", id);
    const { data, error: err } = await supabase
      .from("games")
      .select("id, created_at, name, state")
      .eq("id", id)
      .single();
    if (err) {
      console.error("[ViewGame] fetch error:", err);
      setError(err.message);
      setLoading(false);
      return;
    }
    console.log("[ViewGame] fetched game:", data);
    console.log("[ViewGame] state field:", data?.state);
    setGame(data);
    setLoading(false);
  }

  // ── Derived from game state ──────────────────────────────────────
  const state = game?.state;
  const teams = state?.teams || [{ name: "Home", color: "#1a6bab" }, { name: "Away", color: "#b84e1a" }];
  const log = state?.log || [];
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

  const shotPct = (ti) => { const s = teamTotals[ti].shot, g = teamTotals[ti].goal; return s ? `${Math.round((g / s) * 100)}%` : "—"; };
  const clearPct = (ti) => { const c = teamTotals[ti].clear, f = teamTotals[ti].failed_clear; return (c + f) ? `${Math.round((c / (c + f)) * 100)}%` : "—"; };
  const savePct = (ti) => {
    const shots = filteredLog.filter(e => e.teamIdx === (1 - ti) && e.event === "shot").length;
    const saves = filteredLog.filter(e => e.teamIdx === ti && e.event === "shot_saved").length;
    return shots ? `${Math.round((saves / shots) * 100)}%` : "—";
  };

  const goalTimeline = useMemo(() => {
    const source = statsQtr === "all" ? log : log.filter(e => e.quarter === parseInt(statsQtr));
    const groups = {};
    const order = [];
    source.forEach(e => {
      if (!groups[e.groupId]) { groups[e.groupId] = []; order.push(e.groupId); }
      groups[e.groupId].push(e);
    });
    return order
      .map(gid => groups[gid])
      .filter(g => g.some(e => e.event === "goal"))
      .map(g => ({ group: g, goal: g.find(e => e.event === "goal"), assist: g.find(e => e.event === "assist") }));
  }, [log, statsQtr]);

  if (loading) return <div style={{ ...S.loading, fontFamily: "system-ui, sans-serif" }}>Loading game…</div>;
  if (error) return <div style={{ ...S.error, fontFamily: "system-ui, sans-serif" }}>{error}</div>;

  const hasState = !!state;

  return (
    <div style={S.page}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => navigate("/")}>← Games</button>
        <span style={S.headerTitle}>{game?.name || "Game"}</span>
        {gameOver
          ? <span style={S.finalBadge}>Final</span>
          : <span style={S.liveBadge}>● Live</span>
        }
      </div>

      <div style={S.body}>
        {!hasState ? (
          <div style={S.noGame}>Game hasn't started yet. Check back when the scorekeeper begins tracking.</div>
        ) : (
          <>
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
                  { label: "Goals", key: "goal" }, { label: "EMO Goals", key: "emo_goal" },
                  { label: "Shots", key: "shot" }, { label: "Shot %", custom: shotPct },
                  { label: "Saves", key: "shot_saved" }, { label: "Save %", custom: savePct },
                  { label: "Ground Balls", key: "ground_ball" }, { label: "Faceoffs Won", key: "faceoff_win" },
                  { label: "Turnovers", key: "turnover" }, { label: "Forced TOs", key: "forced_to" },
                  { label: "Successful Clears", key: "clear" }, { label: "Failed Clears", key: "failed_clear" },
                  { label: "Clearing %", custom: clearPct },
                  { label: "Successful Rides", key: "successful_ride" }, { label: "Failed Rides", key: "failed_ride" },
                  { label: "Technicals", key: "penalty_tech" }, { label: "PF Minutes", key: "penalty_min" },
                  { label: "Assists", key: "assist" },
                ].map(({ label, key, custom }) => (
                  <div key={label} style={S.summaryCard}>
                    <div style={S.summaryLabel}>{label}</div>
                    {[0, 1].map(ti => (
                      <div key={ti} style={S.summaryRow}>
                        <div style={{ fontSize: 12, color: teamColors[ti] }}>{teams[ti].name}</div>
                        <div style={{ fontSize: 20, fontWeight: 500, color: teamColors[ti] }}>
                          {custom ? custom(ti) : (teamTotals[ti][key] || 0)}
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
                          {STAT_KEYS.filter(k => k !== "clear" && k !== "failed_clear" && k !== "successful_ride" && k !== "failed_ride").map(k => (
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
                                  {STAT_KEYS.filter(k => k !== "clear" && k !== "failed_clear" && k !== "successful_ride" && k !== "failed_ride").map(k => (
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
              goalTimeline.length === 0
                ? <div style={S.emptyState}>No goals recorded yet</div>
                : <div style={S.tableWrap}>
                    <div style={S.tableTitle}>
                      <span>Scoring timeline</span>
                      <span style={{ fontWeight: 400, fontSize: 11 }}>{goalTimeline.length} goal{goalTimeline.length !== 1 ? "s" : ""}</span>
                    </div>
                    <table style={S.table}>
                      <thead><tr>
                        <th style={{ ...S.th(false), textAlign: "left", paddingLeft: 14 }}>Time</th>
                        <th style={{ ...S.th(false), textAlign: "left" }}>Team</th>
                        <th style={{ ...S.th(false), textAlign: "left" }}>Scorer</th>
                        <th style={{ ...S.th(false), textAlign: "left" }}>Assist</th>
                        <th style={S.th(false)}>Score</th>
                      </tr></thead>
                      <tbody>
                        {(() => {
                          const withScores = [];
                          const scores = [0, 0];
                          goalTimeline.forEach(({ goal, assist }) => {
                            scores[goal.teamIdx]++;
                            withScores.push({ goal, assist, scoreSnap: [...scores] });
                          });
                          return [...withScores].reverse().map(({ goal, assist, scoreSnap }, gi) => (
                            <tr key={gi}>
                              <td style={{ ...S.tdLeft, fontVariantNumeric: "tabular-nums", width: 72, verticalAlign: "top", paddingTop: 12 }}>
                                {goal.goalTime
                                  ? <span style={{ fontWeight: 600, color: "#111", fontSize: 15 }}>{goal.goalTime}</span>
                                  : <span style={{ color: "#ccc" }}>—</span>
                                }
                                <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#111", marginTop: 1 }}>{qLabel(goal.quarter)}</span>
                              </td>
                              <td style={S.tdLeft}>
                                <span style={{ color: teamColors[goal.teamIdx], fontWeight: 500 }}>{teams[goal.teamIdx]?.name}</span>
                              </td>
                              <td style={S.tdLeft}>
                                <span style={{ fontWeight: 500 }}>#{goal.player?.num} {goal.player?.name}</span>
                                {goal.emo && <span style={{ marginLeft: 6, fontSize: 11, background: "#e8f5e9", color: "#2a7a3b", borderRadius: 4, padding: "1px 5px" }}>EMO</span>}
                              </td>
                              <td style={S.tdLeft}>
                                {assist
                                  ? <span style={{ color: "#888" }}>#{assist.player?.num} {assist.player?.name}</span>
                                  : <span style={{ color: "#ddd" }}>—</span>
                                }
                              </td>
                              <td style={{ ...S.td, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                                <span style={{ color: teamColors[0] }}>{scoreSnap[0]}</span>
                                <span style={{ color: "#ccc", margin: "0 3px" }}>–</span>
                                <span style={{ color: teamColors[1] }}>{scoreSnap[1]}</span>
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
