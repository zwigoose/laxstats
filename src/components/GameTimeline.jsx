import { qLabel } from "./LaxStats";

/**
 * Shared timeline table used by ViewGame and Pressbox.
 *
 * Props:
 *   scoringTimeline  — chronological array of { type, goal?, assist?, timeout?, penalty? }
 *                      with NO scoreSnap (this component computes them)
 *   teams            — array of team objects with .name
 *   teamColors       — array of color strings [home, away]
 *   compact          — boolean; use smaller font / tighter cells (Pressbox mode)
 */
export default function GameTimeline({ scoringTimeline, teams, teamColors, compact = false }) {
  if (!scoringTimeline?.length) {
    return (
      <div style={{ textAlign: "center", padding: "20px 0", color: "#aaa", fontSize: 13, fontStyle: "italic" }}>
        No events recorded yet
      </div>
    );
  }

  // Forward pass to compute score snapshots, then reverse for newest-first display
  const scores = [0, 0];
  const withScores = scoringTimeline.map(entry => {
    if (entry.type === "goal") scores[entry.goal.teamIdx]++;
    return { ...entry, scoreSnap: [...scores] };
  });
  const rows = [...withScores].reverse();

  const timeFont  = compact ? 12 : 15;
  const qFont     = compact ? 10 : 12;
  const cellPad   = compact ? "6px 8px" : "10px 8px 10px 14px";
  const cellPadR  = compact ? "6px 8px" : "10px 14px 10px 8px";
  const thStyle   = { padding: compact ? "4px 8px" : "6px 8px 6px 14px", fontSize: 11, fontWeight: 600, color: "#aaa", textAlign: "left", borderBottom: "1px solid #f0f0f0", whiteSpace: "nowrap" };
  const thStyleR  = { ...thStyle, textAlign: "right", paddingLeft: 8, paddingRight: compact ? 8 : 14 };
  const tdStyle   = { padding: cellPad, verticalAlign: "top", borderBottom: "1px solid #f8f8f8", fontSize: compact ? 12 : 14 };
  const tdStyleR  = { ...tdStyle, textAlign: "right", padding: cellPadR };

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: compact ? 12 : 14, fontFamily: "system-ui, sans-serif" }}>
      <thead>
        <tr>
          <th style={thStyle}>Time</th>
          <th style={{ ...thStyle, paddingLeft: 8 }}>Team</th>
          <th style={{ ...thStyle, paddingLeft: 8 }}>Event</th>
          <th style={{ ...thStyle, paddingLeft: 8 }}>Assist</th>
          <th style={thStyleR}>Score</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((entry, i) => {
          const scoreCell = (
            <td style={{ ...tdStyleR, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
              <span style={{ color: teamColors[0] }}>{entry.scoreSnap[0]}</span>
              <span style={{ color: "#ccc", margin: "0 3px" }}>–</span>
              <span style={{ color: teamColors[1] }}>{entry.scoreSnap[1]}</span>
            </td>
          );

          if (entry.type === "timeout") {
            const to = entry.timeout;
            return (
              <tr key={i} style={{ background: "#fafafa" }}>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 600, fontSize: timeFont, fontVariantNumeric: "tabular-nums" }}>{to.timeoutTime || "—"}</div>
                  <div style={{ fontSize: qFont, fontWeight: 600, color: "#888", marginTop: 1 }}>{qLabel(to.quarter)}</div>
                </td>
                <td style={{ ...tdStyle, paddingLeft: 8 }}>
                  <span style={{ color: teamColors[to.teamIdx], fontWeight: 500 }}>{teams[to.teamIdx]?.name}</span>
                </td>
                <td style={{ ...tdStyle, paddingLeft: 8, color: "#888", fontStyle: "italic" }} colSpan={2}>⏸ Timeout</td>
                {scoreCell}
              </tr>
            );
          }

          if (entry.type === "penalty") {
            const pen = entry.penalty;
            const isTech = pen.event === "penalty_tech";
            const nrTag = pen.nonReleasable ? " NR" : "";
            const penLabel = isTech
              ? `🟨 ${pen.foulName || "Technical foul"} (30s)`
              : `🟥 ${pen.foulName || "Personal foul"} (${pen.penaltyMin}min${nrTag})`;
            return (
              <tr key={i} style={{ background: "#fffbf5" }}>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 600, fontSize: timeFont, fontVariantNumeric: "tabular-nums" }}>{pen.penaltyTime || "—"}</div>
                  <div style={{ fontSize: qFont, fontWeight: 600, color: "#888", marginTop: 1 }}>{qLabel(pen.quarter)}</div>
                </td>
                <td style={{ ...tdStyle, paddingLeft: 8 }}>
                  <span style={{ color: teamColors[pen.teamIdx], fontWeight: 500 }}>{teams[pen.teamIdx]?.name}</span>
                </td>
                <td style={{ ...tdStyle, paddingLeft: 8, color: "#888", fontStyle: "italic" }}>{penLabel}</td>
                <td style={{ ...tdStyle, paddingLeft: 8, fontWeight: 500 }}>#{pen.player?.num} {pen.player?.name}</td>
                {scoreCell}
              </tr>
            );
          }

          // Goal
          const { goal, assist } = entry;
          return (
            <tr key={i}>
              <td style={tdStyle}>
                <div style={{ fontWeight: 600, fontSize: timeFont, fontVariantNumeric: "tabular-nums" }}>{goal.goalTime || "—"}</div>
                <div style={{ fontSize: qFont, fontWeight: 600, color: "#888", marginTop: 1 }}>{qLabel(goal.quarter)}</div>
              </td>
              <td style={{ ...tdStyle, paddingLeft: 8 }}>
                <span style={{ color: teamColors[goal.teamIdx], fontWeight: 500 }}>{teams[goal.teamIdx]?.name}</span>
              </td>
              <td style={{ ...tdStyle, paddingLeft: 8 }}>
                <span style={{ fontWeight: 500 }}>#{goal.player?.num} {goal.player?.name}</span>
                {goal.emo && <span style={{ marginLeft: 6, fontSize: 11, background: "#e8f5e9", color: "#2a7a3b", borderRadius: 4, padding: "1px 5px" }}>EMO</span>}
              </td>
              <td style={{ ...tdStyle, paddingLeft: 8 }}>
                {assist
                  ? <span style={{ color: "#888" }}>#{assist.player?.num} {assist.player?.name}</span>
                  : <span style={{ color: "#ddd" }}>—</span>}
              </td>
              {scoreCell}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
