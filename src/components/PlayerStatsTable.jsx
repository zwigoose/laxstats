import { useState, useMemo } from "react";
import { parseRoster } from "../utils/stats";
import { STAT_KEYS, STAT_LABELS } from "../constants/lacrosse";

// Stat columns for full player tables (LaxStats, ViewGame)
export const PLAYER_STAT_KEYS = STAT_KEYS.filter(
  k => !["clear", "failed_clear", "successful_ride", "failed_ride", "mdd_success", "mdd_fail", "emo_fail", "shot_post"].includes(k)
);

// Stat columns for the condensed Pressbox player panel
export const PRESSBOX_STAT_KEYS = [
  "goal", "assist", "shot", "sog", "shot_saved",
  "ground_ball", "faceoff_win", "turnover", "forced_to",
  "penalty_tech", "penalty_min",
];

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
 */
export default function PlayerStatsTable({
  teams,
  teamColors,
  playerStats,
  statKeys,
  teamIdx = null,
  compact = false,
}) {
  const [sortKey, setSortKey] = useState("num");

  const allRosterPlayers = useMemo(
    () => [0, 1].map(ti => parseRoster(teams[ti]?.roster || "")),
    [teams]
  );

  const sortedPlayers = useMemo(() => {
    const base = [...playerStats];
    [0, 1].forEach(ti => {
      allRosterPlayers[ti].forEach(p => {
        if (!base.some(r => r.teamIdx === ti && r.player.num === p.num)) {
          base.push({ teamIdx: ti, player: p, ...Object.fromEntries(statKeys.map(k => [k, 0])) });
        }
      });
    });
    if (sortKey === "name") return base.sort((a, b) => a.player.name.localeCompare(b.player.name));
    if (sortKey === "num")  return base.sort((a, b) => parseInt(a.player.num || 0) - parseInt(b.player.num || 0));
    return base.sort((a, b) => {
      const diff = b[sortKey] - a[sortKey];
      return diff !== 0 ? diff : parseInt(a.player.num || 0) - parseInt(b.player.num || 0);
    });
  }, [playerStats, allRosterPlayers, statKeys, sortKey]);

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
  const thL  = { ...thBase, textAlign: "left", cursor: "default", padding: compact ? "5px 10px" : "8px 14px", position: "sticky", left: 0, zIndex: 2, borderRight: "1px solid #e5e5e5" };
  const th   = sorted => ({ ...thBase, padding: compact ? "5px 6px" : "8px 8px", color: sorted ? "#111" : "#888" });
  const tdL  = { fontSize: fs, padding: compact ? "4px 10px" : "9px 14px", borderBottom: "1px solid #f0f0f0", color: "#111", textAlign: "left", whiteSpace: "nowrap", position: "sticky", left: 0, background: "#fff", zIndex: 1, borderRight: "1px solid #f0f0f0" };
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
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: fs, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thL}>Player</th>
                {statKeys.map(k => (
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
                        colSpan={statKeys.length + 1}
                        style={{ padding: compact ? "4px 10px 2px" : "8px 14px 4px", fontSize: compact ? 10 : 11, fontWeight: 600, color: teamColors[ti], background: "#fafafa", position: "sticky", left: 0, zIndex: 1 }}
                      >
                        {teams[ti].name.toUpperCase()}
                      </td>
                    </tr>
                  ),
                  ...rows.map((row, i) => (
                    <tr key={`${ti}-${i}`}>
                      <td style={tdL}>
                        <span style={badge}>#{row.player.num}</span>
                        {row.player.name}
                      </td>
                      {statKeys.map(k => (
                        <td key={k} style={{ ...td(sortKey === k), opacity: row[k] === 0 ? 0.3 : 1 }}>
                          {k === "penalty_min" && row[k] > 0 ? `${row[k]}m` : row[k]}
                        </td>
                      ))}
                    </tr>
                  )),
                ].filter(Boolean);
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}