import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { buildPlayerStats, buildTeamTotals, qLabel } from "../components/LaxStats";
import { dbRowToEntry } from "../hooks/useGameEvents";
import { deriveQuarterState } from "../services/gameEvents";
import { parseRoster } from "../utils/stats";
import { PLAYER_STAT_KEYS } from "../components/PlayerStatsTable";
import { STAT_LABELS } from "../constants/lacrosse";
import { version } from "../../package.json";

function formatDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

export default function PrintGame() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [game, setGame]   = useState(null);
  const [v2Log, setV2Log] = useState(null);
  const [derivedQuarterState, setDerivedQuarterState] = useState(null);
  const [orgLogos, setOrgLogos] = useState([null, null]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("games")
        .select("id, created_at, name, state, org_id, away_org_id, referee_names, weather_conditions, field_location")
        .eq("id", id)
        .single();
      if (err) { setError(err.message); setLoading(false); return; }
      setGame(data);

      const orgIds = [data.org_id, data.away_org_id].filter(Boolean);
      if (orgIds.length) {
        const { data: orgs } = await supabase
          .from("organizations").select("id, logo_url").in("id", orgIds);
        const logoMap = Object.fromEntries((orgs || []).map(o => [o.id, o.logo_url]));
        setOrgLogos([logoMap[data.org_id] ?? null, logoMap[data.away_org_id] ?? null]);
      }

      const [evRes, metaRes] = await Promise.all([
        supabase.from("game_events").select("*").eq("game_id", id).is("deleted_at", null).order("seq"),
        supabase.from("game_meta_events").select("*").eq("game_id", id).order("seq"),
      ]);
      setV2Log((evRes.data || []).map(dbRowToEntry));
      const derived = deriveQuarterState(metaRes.data || []);
      if (derived) setDerivedQuarterState(derived);
      setLoading(false);
    }
    load();
  }, [id]);

  const state = game?.state;
  const teams = state?.teams || [{ name: "Home", color: "#1a6bab" }, { name: "Away", color: "#b84e1a" }];
  const log   = v2Log ?? [];
  const completedQuarters = derivedQuarterState?.completedQuarters ?? state?.completedQuarters ?? [];
  const currentQuarter    = derivedQuarterState?.currentQuarter    ?? state?.currentQuarter    ?? 1;
  const gameOver          = derivedQuarterState?.gameOver          ?? state?.gameOver          ?? false;
  const teamColors = [teams[0]?.color || "#1a6bab", teams[1]?.color || "#b84e1a"];
  const displayLogos = [teams[0]?.logoUrl || orgLogos[0], teams[1]?.logoUrl || orgLogos[1]];

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

  const playerStats  = useMemo(() => buildPlayerStats(log), [log]);
  const teamTotals   = useMemo(() => buildTeamTotals(log, completedQuarters), [log, completedQuarters]);

  const shotPct  = ti => { const s = teamTotals[ti].shot,        g = teamTotals[ti].goal;           return s     ? `${Math.round((g/s)*100)}%`   : "—"; };
  const sogPct   = ti => { const s = teamTotals[ti].sog,         g = teamTotals[ti].goal;            return s     ? `${Math.round((g/s)*100)}%`   : "—"; };
  const clearPct = ti => { const c = teamTotals[ti].clear,       f = teamTotals[ti].failed_clear;    return (c+f) ? `${Math.round((c/(c+f))*100)}%` : "—"; };
  const emoPct   = ti => { const s = teamTotals[ti].emo_goal,    f = teamTotals[ti].emo_fail;        return (s+f) ? `${Math.round((s/(s+f))*100)}%` : "—"; };
  const mddPct   = ti => { const s = teamTotals[ti].mdd_success, f = teamTotals[ti].mdd_fail;       return (s+f) ? `${Math.round((s/(s+f))*100)}%` : "—"; };
  const savePct  = ti => { const sog = teamTotals[1-ti].sog,     sv = teamTotals[ti].shot_saved;     return sog   ? `${Math.round((sv/sog)*100)}%` : "—"; };

  const gameDate = state?.gameDate || game?.created_at;
  const fieldLoc = game?.field_location     || state?.fieldLocation;
  const weather  = game?.weather_conditions || state?.weatherConditions;
  const refs     = game?.referee_names      || state?.refereeNames;

  if (loading) return <div style={css.loading}>Loading…</div>;
  if (error)   return <div style={css.error}>{error}</div>;

  return (
    <div style={css.page}>
      <style>{PRINT_CSS}</style>

      {/* Toolbar — hidden on print */}
      <div style={css.toolbar} className="no-print">
        <button style={css.backBtn} onClick={() => navigate(`/games/${id}/view`)}>← Back</button>
        <span style={css.brandMark}>LaxStats</span>
        <button style={css.printBtn} onClick={() => window.print()}>Print / Save as PDF</button>
      </div>

      {/* Game header */}
      <div style={css.gameHeader}>
        <div style={css.gameName}>{game?.name || "Game"}</div>
        <div style={css.gameMeta}>
          {gameDate && <span>{formatDate(gameDate)}</span>}
          {fieldLoc && <span>{fieldLoc}</span>}
          {weather  && <span>{weather}</span>}
          {refs     && <span>Refs: {refs}</span>}
        </div>
      </div>

      {/* Score */}
      <div style={css.scoreSection}>
        <div style={css.teamCol}>
          {displayLogos[0] && <img src={displayLogos[0]} alt="" style={css.logo} crossOrigin="anonymous" />}
          <div style={{ ...css.teamName, color: teamColors[0] }}>{teams[0].name}</div>
        </div>
        <div style={css.scoreCenter}>
          <span style={{ color: teamColors[0] }}>{totalScores[0]}</span>
          <span style={css.scoreDash}>—</span>
          <span style={{ color: teamColors[1] }}>{totalScores[1]}</span>
          {gameOver && (
            <div style={css.finalLabel}>
              Final{allQuarters.some(q => q > 4) ? " (OT)" : ""}
            </div>
          )}
        </div>
        <div style={{ ...css.teamCol, alignItems: "flex-end" }}>
          {displayLogos[1] && <img src={displayLogos[1]} alt="" style={css.logo} crossOrigin="anonymous" />}
          <div style={{ ...css.teamName, color: teamColors[1] }}>{teams[1].name}</div>
        </div>
      </div>

      {/* Quarter scores */}
      {allQuarters.length > 1 && (
        <section style={css.section}>
          <table style={css.table}>
            <thead>
              <tr>
                <th style={css.thLeft}>Team</th>
                {allQuarters.map(q => <th key={q} style={css.th}>{qLabel(q)}</th>)}
                <th style={{ ...css.th, fontWeight: 700, borderLeft: "2px solid #ddd" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {[0, 1].map(ti => (
                <tr key={ti}>
                  <td style={{ ...css.tdLeft, color: teamColors[ti], fontWeight: 600 }}>{teams[ti].name}</td>
                  {allQuarters.map(q => <td key={q} style={css.td}>{(scoresByQuarter[q] || [0,0])[ti]}</td>)}
                  <td style={{ ...css.td, fontWeight: 700, borderLeft: "2px solid #ddd" }}>{totalScores[ti]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Team stats */}
      <section style={css.section}>
        <div style={css.sectionHeading}>Team Stats</div>
        <table style={css.table}>
          <thead>
            <tr>
              <th style={css.thLeft}>Stat</th>
              <th style={{ ...css.th, color: teamColors[0] }}>{teams[0].name}</th>
              <th style={{ ...css.th, color: teamColors[1] }}>{teams[1].name}</th>
            </tr>
          </thead>
          <tbody>
            {TEAM_STAT_ROWS.map(row => row.heading ? (
              <tr key={row.heading}>
                <td colSpan={3} style={css.statGroupHead}>{row.heading}</td>
              </tr>
            ) : (
              <tr key={row.label}>
                <td style={css.tdLeft}>{row.label}</td>
                {[0, 1].map(ti => (
                  <td key={ti} style={css.td}>
                    {row.custom
                      ? (row.custom === "emoPct"   ? emoPct(ti)
                       : row.custom === "mddPct"   ? mddPct(ti)
                       : row.custom === "savePct"  ? savePct(ti)
                       : row.custom === "shotPct"  ? shotPct(ti)
                       : row.custom === "sogPct"   ? sogPct(ti)
                       : row.custom === "clearPct" ? clearPct(ti)
                       : "—")
                      : (teamTotals[ti][row.key] || 0)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Player stats — one table per team */}
      {[0, 1].map(ti => (
        <PlayerTable
          key={ti}
          teamName={teams[ti].name}
          teamColor={teamColors[ti]}
          teams={teams}
          playerStats={playerStats}
          teamIdx={ti}
        />
      ))}

      {/* Print footer */}
      <div style={css.printFooter}>
        Generated by LaxStats v{version} · laxstats.app
      </div>
    </div>
  );
}

function PlayerTable({ teamName, teamColor, teams, playerStats, teamIdx }) {
  const rosterPlayers = useMemo(() => parseRoster(teams[teamIdx]?.roster || ""), [teams, teamIdx]);

  const rows = useMemo(() => {
    const base = playerStats.filter(p => p.teamIdx === teamIdx);
    rosterPlayers.forEach(p => {
      if (!base.some(r => r.player.num === p.num)) {
        base.push({ teamIdx, player: p, ...Object.fromEntries(PLAYER_STAT_KEYS.map(k => [k, 0])) });
      }
    });
    return base.sort((a, b) => parseInt(a.player.num || 0) - parseInt(b.player.num || 0));
  }, [playerStats, rosterPlayers, teamIdx]);

  if (!rows.length) return null;

  return (
    <section style={css.section}>
      <div style={{ ...css.sectionHeading, color: teamColor }}>{teamName} — Players</div>
      <div className="print-table-wrap" style={{ overflowX: "auto" }}>
        <table style={{ ...css.table, minWidth: 600 }}>
          <thead>
            <tr>
              <th style={css.thLeft}>Player</th>
              {PLAYER_STAT_KEYS.map(k => <th key={k} style={css.th}>{STAT_LABELS[k]}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td style={css.tdLeft}>
                  <span style={css.numBadge}>#{row.player.num}</span>
                  {row.player.name}
                </td>
                {PLAYER_STAT_KEYS.map(k => (
                  <td key={k} style={{ ...css.td, opacity: row[k] === 0 ? 0.3 : 1 }}>
                    {k === "penalty_min" && row[k] > 0 ? `${row[k]}m` : row[k]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const TEAM_STAT_ROWS = [
  { heading: "Scoring" },
  { label: "Goals",           key: "goal" },
  { label: "Assists",         key: "assist" },
  { label: "Successful EMO",  key: "emo_goal" },
  { label: "Failed EMO",      key: "emo_fail" },
  { label: "EMO %",           custom: "emoPct" },
  { heading: "Defense" },
  { label: "Successful MDD",  key: "mdd_success" },
  { label: "Failed MDD",      key: "mdd_fail" },
  { label: "MDD %",           custom: "mddPct" },
  { label: "Saves",           key: "shot_saved" },
  { label: "Save %",          custom: "savePct" },
  { label: "Forced TOs",      key: "forced_to" },
  { heading: "Shooting" },
  { label: "Total Shots",     key: "shot" },
  { label: "Shot %",          custom: "shotPct" },
  { label: "Shots on Goal",   key: "sog" },
  { label: "SOG %",           custom: "sogPct" },
  { heading: "Possession" },
  { label: "Ground Balls",    key: "ground_ball" },
  { label: "Faceoffs Won",    key: "faceoff_win" },
  { label: "Faceoffs Lost",   key: "faceoff_loss" },
  { label: "Turnovers",       key: "turnover" },
  { heading: "Clearing" },
  { label: "Successful Clears", key: "clear" },
  { label: "Failed Clears",   key: "failed_clear" },
  { label: "Clearing %",      custom: "clearPct" },
  { label: "Successful Rides", key: "successful_ride" },
  { label: "Failed Rides",    key: "failed_ride" },
  { heading: "Penalties" },
  { label: "Technicals",      key: "penalty_tech" },
  { label: "PF Minutes",      key: "penalty_min" },
];

const css = {
  page:        { fontFamily: "system-ui, sans-serif", maxWidth: 800, margin: "0 auto", padding: "0 0 40px", color: "#111" },
  loading:     { display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "#888", fontSize: 14, fontFamily: "system-ui, sans-serif" },
  error:       { maxWidth: 400, margin: "40px auto", padding: 20, background: "#fff5f5", border: "1px solid #f0a0a0", borderRadius: 10, color: "#c0392b", fontSize: 14, fontFamily: "system-ui, sans-serif" },
  toolbar:     { display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: "1px solid #e5e5e5", background: "#fff", position: "sticky", top: 0, zIndex: 10 },
  backBtn:     { fontSize: 13, fontWeight: 500, color: "#888", background: "none", border: "none", cursor: "pointer", padding: "4px 0" },
  brandMark:   { fontSize: 15, fontWeight: 800, color: "#111", letterSpacing: "-0.03em", flex: 1, textAlign: "center" },
  printBtn:    { fontSize: 13, fontWeight: 600, background: "#111", color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", cursor: "pointer", whiteSpace: "nowrap" },
  gameHeader:  { padding: "20px 20px 0" },
  gameName:    { fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 6 },
  gameMeta:    { display: "flex", flexWrap: "wrap", gap: "4px 16px", fontSize: 12, color: "#777" },
  scoreSection:{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 12, padding: "20px 20px" },
  teamCol:     { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 },
  logo:        { height: 52, maxWidth: 96, objectFit: "contain" },
  teamName:    { fontSize: 13, fontWeight: 700 },
  scoreCenter: { textAlign: "center", fontSize: 48, fontWeight: 500, letterSpacing: 4 },
  scoreDash:   { color: "#ccc", margin: "0 10px" },
  finalLabel:  { fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#888", marginTop: 4 },
  section:     { padding: "0 20px 24px" },
  sectionHeading: { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#aaa", marginBottom: 8 },
  table:       { width: "100%", fontSize: 12, borderCollapse: "collapse", border: "1px solid #e5e5e5", borderRadius: 8, overflow: "hidden" },
  thLeft:      { padding: "7px 12px", textAlign: "left", fontWeight: 600, fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid #e5e5e5", background: "#f5f5f5", whiteSpace: "nowrap" },
  th:          { padding: "7px 8px", textAlign: "right", fontWeight: 600, fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid #e5e5e5", background: "#f5f5f5", whiteSpace: "nowrap" },
  tdLeft:      { padding: "6px 12px", borderBottom: "1px solid #f0f0f0", color: "#111", textAlign: "left", whiteSpace: "nowrap" },
  td:          { padding: "6px 8px", borderBottom: "1px solid #f0f0f0", color: "#111", textAlign: "right" },
  statGroupHead: { padding: "8px 12px 2px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#bbb", background: "#fafafa", borderBottom: "1px solid #f0f0f0" },
  numBadge:    { display: "inline-block", width: 22, height: 22, borderRadius: "50%", background: "#f0f0f0", fontSize: 10, fontWeight: 600, textAlign: "center", lineHeight: "22px", marginRight: 6, color: "#888" },
  printFooter: { textAlign: "center", fontSize: 10, color: "#ccc", padding: "16px 20px 0", borderTop: "1px solid #f0f0f0", margin: "0 20px" },
};

const PRINT_CSS = `
  @media print {
    .no-print { display: none !important; }
    body { margin: 0; }
    footer { display: none !important; }
    .app-scroll-container {
      position: static !important;
      height: auto !important;
      overflow: visible !important;
      top: auto !important;
      bottom: auto !important;
    }
    .print-table-wrap { overflow: visible !important; }
    @page { margin: 14mm 12mm; }
  }
`;
