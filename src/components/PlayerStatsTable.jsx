import { useState, useMemo } from "react";
import { parseRoster } from "../utils/stats";
import { STAT_LABELS } from "../constants/lacrosse";

const SHARED_STAT_KEYS = [
  "goal", "assist", "shot", "sog", "shot_saved", "goal_allowed", "sv_pct",
  "ground_ball", "faceoff_win", "faceoff_loss", "fo_pct", "turnover", "forced_to",
  "penalty_tech", "penalty_min",
];

// Stat columns for full player tables (LaxStats, ViewGame)
export const PLAYER_STAT_KEYS = SHARED_STAT_KEYS;

// Stat columns for the condensed Pressbox player panel
export const PRESSBOX_STAT_KEYS = SHARED_STAT_KEYS;

/**
 * Shared player stats table used by LaxStats (/score), ViewGame (/view), and Pressbox (/pressbox).
 *
 * Renders a title bar with Sort # / Name controls + a scrollable stat table.
 * Manages its own sort state. The parent provides the outer wrapper (tableWrap div or card).
 *
 * Props:
 *   teams        [{name, color, roster}, ...]  — both teams; roster text is parsed internally
 *   teamColors   [colorStr, colorStr]
 *   playerStats  buildPlayerStats(filteredLog) result
 *   statKeys     string[]  — ordered columns to display; use PLAYER_STAT_KEYS or PRESSBOX_STAT_KEYS
 *   teamIdx      0 | 1 | null  — null = show both teams (default); 0|1 = single-team view (Pressbox)
 *   compact      boolean  — tighter fonts/padding for the Pressbox panel
 *   goalieDecisions  { win: {teamIdx,num}, loss: {teamIdx,num} } | null — shows W/L on the goalie's line
 */
export default function PlayerStatsTable({
  teams,
  teamColors,
  playerStats,
  statKeys,
  teamIdx = null,
  compact = false,
  goalieDecisions = null,
}) {
  const [sortKey, setSortKey] = useState("num");

  // Legacy games recorded only faceoff wins — losses unknown, so the FL and
  // FO% columns are hidden unless this game has paired loss entries.
  const hasFaceoffLosses = useMemo(
    () => playerStats.some(p => (p.faceoff_loss || 0) > 0),
    [playerStats]
  );
  const visibleKeys = useMemo(
    () => statKeys.filter(k => (k !== "faceoff_loss" && k !== "fo_pct") || hasFaceoffLosses),
    [statKeys, hasFaceoffLosses]
  );

  const allRosterPlayers = useMemo(
    () => [0, 1].map(ti => parseRoster(teams[ti]?.roster || "")),
    [teams]
  );

  const sortedPlayers = useMemo(() => {
    const base = playerStats.map(r => {
      const fw = r.faceoff_win || 0, fl = r.faceoff_loss || 0;
      const sv = r.shot_saved || 0, ga = r.goal_allowed || 0;
      return {
        ...r,
        fo_pct: (fw + fl) > 0 ? Math.round((fw / (fw + fl)) * 100) : 0,
        sv_pct: (sv + ga) > 0 ? Math.round((sv / (sv + ga)) * 100) : 0,
      };
    });
    [0, 1].forEach(ti => {
      allRosterPlayers[ti].forEach(p => {
        if (!base.some(r => r.teamIdx === ti && r.player.num === p.num)) {
          base.push({ teamIdx: ti, player: p, ...Object.fromEntries(visibleKeys.map(k => [k, 0])) });
        }
      });
    });
    if (sortKey === "name") return base.sort((a, b) => a.player.name.localeCompare(b.player.name));
    if (sortKey === "num")  return base.sort((a, b) => parseInt(a.player.num || 0) - parseInt(b.player.num || 0));
    return base.sort((a, b) => {
      const diff = b[sortKey] - a[sortKey];
      return diff !== 0 ? diff : parseInt(a.player.num || 0) - parseInt(b.player.num || 0);
    });
  }, [playerStats, allRosterPlayers, visibleKeys, sortKey]);

  const teamsToShow = teamIdx !== null ? [teamIdx] : [0, 1];
  const hasRows = teamsToShow.some(ti => sortedPlayers.some(p => p.teamIdx === ti));

  // ── Styles ───────────────────────────────────────────────────────────────────
  const fs     = compact ? 12 : 13;
  const thBase = {
    textAlign: "right", fontWeight: 600,
    fontSize: compact ? 10 : 11,
    textTransform: "uppercase", letterSpacing: "0.04em",
    borderBottom: "1px solid #e5e5e5", background: "#f5f5f5",
    cursor: "pointer", whiteSpace: "nowrap",
  };
  const thL  = { ...thBase, textAlign: "left", cursor: "default", padding: compact ? "5px 10px" : "8px 14px", position: "sticky", top: 0, left: 0, zIndex: 3 };
  const th   = sorted => ({ ...thBase, padding: compact ? "5px 6px" : "8px 8px", color: sorted ? "#111" : "#888", position: "sticky", top: 0, zIndex: 2 });
  const tdL  = { fontSize: fs, padding: compact ? "4px 10px" : "9px 14px", borderBottom: "1px solid #f0f0f0", color: "#111", textAlign: "left", whiteSpace: "nowrap", position: "sticky", left: 0, zIndex: 1, background: "#fff" };
  const td   = sorted => ({ fontSize: fs, padding: compact ? "4px 6px" : "9px 8px", borderBottom: "1px solid #f0f0f0", color: "#111", textAlign: "right", fontWeight: sorted ? 600 : 400 });
  const badge = { display: "inline-block", borderRadius: "50%", background: "#f0f0f0", fontWeight: 600, textAlign: "center", color: "#888", flexShrink: 0,
    width: compact ? 18 : 24, height: compact ? 18 : 24,
    fontSize: compact ? 9 : 11, lineHeight: compact ? "18px" : "24px",
    marginRight: compact ? 4 : 6,
  };
  const titleStyle = {
    fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em",
    color: "#888", padding: compact ? "6px 10px" : "10px 14px 8px",
    borderBottom: "1px solid #e5e5e5", background: "#f9f9f9",
    display: "flex", justifyContent: "space-between", alignItems: "center",
  };
  const sortBtnStyle = active => ({
    fontSize: 11, padding: "2px 8px", borderRadius: 10,
    border: "1px solid #ddd", cursor: "pointer",
    background: active ? "#111" : "transparent",
    color: active ? "#fff" : "#888",
    fontWeight: 400, textTransform: "none", letterSpacing: 0,
  });

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <div style={titleStyle}>
        <span>Player stats</span>
        <span style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#aaa", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>Sort:</span>
          <button style={sortBtnStyle(sortKey === "num")}  onClick={() => setSortKey("num")}>#</button>
          <button style={sortBtnStyle(sortKey === "name")} onClick={() => setSortKey("name")}>Name</button>
          <span style={{ fontSize: 11, color: "#ccc", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>·</span>
          <span style={{ fontSize: 11, color: "#aaa", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>tap stat to sort</span>
        </span>
      </div>

      {!hasRows ? (
        <div style={{ textAlign: "center", padding: "40px 16px", color: "#aaa", fontSize: 14 }}>
          No player stats for this period
        </div>
      ) : (
        <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 200px)" }}>
          <table style={{ width: "100%", fontSize: fs, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thL}>Player</th>
                {visibleKeys.map(k => (
                  <th key={k} style={th(sortKey === k)} onClick={() => setSortKey(k)}>
                    {STAT_LABELS[k]}{sortKey === k ? " ▾" : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teamsToShow.map(ti => {
                const rows = sortedPlayers.filter(p => p.teamIdx === ti);
                if (!rows.length) return null;
                return [
                  teamIdx === null && (
                    <tr key={`h-${ti}`}>
                      <td
                        colSpan={visibleKeys.length + 1}
                        style={{ padding: compact ? "4px 10px 2px" : "8px 14px 4px", fontSize: compact ? 10 : 11, fontWeight: 600, color: teamColors[ti], background: "#fafafa" }}
                      >
                        {teams[ti].name.toUpperCase()}
                      </td>
                    </tr>
                  ),
                  ...rows.map((row, i) => {
                    const decision = goalieDecisions?.win?.teamIdx === ti && String(goalieDecisions.win.num) === String(row.player.num)
                      ? "W"
                      : goalieDecisions?.loss?.teamIdx === ti && String(goalieDecisions.loss.num) === String(row.player.num)
                        ? "L"
                        : null;
                    return (
                      <tr key={`${ti}-${i}`}>
                        <td style={tdL}>
                          <span style={badge}>#{row.player.num}</span>
                          {row.player.name}
                          {decision && (
                            <span style={{
                              marginLeft: 6, fontSize: compact ? 9 : 10, fontWeight: 700,
                              color: decision === "W" ? "#2a7a3b" : "#c0392b",
                              background: decision === "W" ? "#eaf6ec" : "#fff0ee",
                              borderRadius: 4, padding: "1px 5px",
                            }}>{decision}</span>
                          )}
                        </td>
                        {visibleKeys.map(k => (
                          <td key={k} style={{ ...td(sortKey === k), opacity: row[k] === 0 ? 0.3 : 1 }}>
                            {k === "penalty_min" && row[k] > 0 ? `${row[k]}m`
                              : k === "fo_pct" && row[k] > 0 ? `${row[k]}%`
                              : k === "sv_pct" ? ((row.shot_saved || 0) + (row.goal_allowed || 0) > 0 ? `${row[k]}%` : "—")
                              : row[k]}
                          </td>
                        ))}
                      </tr>
                    );
                  }),
                ].filter(Boolean);
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
