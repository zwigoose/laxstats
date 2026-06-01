import { qLabel } from "./LaxStats";
import { buildLogGroups } from "../utils/stats";

const EVENT_LABELS = {
  goal:           "Goal",
  shot:           "Shot",
  shot_saved:     "Save",
  shot_blocked:   "Shot Blocked",
  ground_ball:    "Ground Ball",
  faceoff_win:    "Faceoff Win",
  turnover:       "Turnover",
  forced_to:      "Forced Turnover",
  penalty_tech:   "Technical Foul",
  clear:          "Clear",
  failed_clear:   "Failed Clear",
};

function groupPrimary(group) {
  return group.find(e => e.event === "goal") || group.find(e => e.event === "shot") || group[0];
}

function buildFeed(log, completedQuarters, gameOver) {
  // Sort chronologically (quarter ASC, time-remaining DESC within quarter, seq ASC)
  const groups = buildLogGroups(log);

  // Forward pass: accumulate running score so each goal captures the score after it
  const runningScore = [0, 0];
  const forwardItems = [];
  for (const group of groups) {
    const primary = groupPrimary(group);
    if (primary.event === "goal") {
      runningScore[primary.teamIdx]++;
      const assist = group.find(e => e.event === "assist");
      forwardItems.push({
        type: "goal",
        entry: primary,
        score: [...runningScore],
        scorer: primary.player ?? null,
        assist: assist?.player ?? null,
      });
    } else if (EVENT_LABELS[primary.event]) {
      forwardItems.push({ type: "event", entry: primary });
    }
  }

  // Reverse so newest events are at the top
  forwardItems.reverse();

  // Insert quarter dividers at quarter transitions (newest quarter first)
  const displayItems = [];
  let lastQ = null;
  for (const item of forwardItems) {
    const q = item.entry.quarter;
    if (q !== lastQ) {
      const isLive = !completedQuarters.includes(q) && !gameOver;
      displayItems.push({ type: isLive ? "quarter-live" : "quarter-end", quarter: q });
      lastQ = q;
    }
    displayItems.push(item);
  }

  return displayItems;
}

export default function GameLiveStream({ log, teams, teamColors, completedQuarters, gameOver }) {
  const feed = buildFeed(log, completedQuarters, gameOver);

  if (!log.length) {
    return (
      <div style={{ textAlign: "center", padding: "48px 16px", color: "#aaa", fontSize: 14 }}>
        No events yet — check back when the game starts.
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 24 }}>
      {feed.map((item, i) => {
        if (item.type === "quarter-end" || item.type === "quarter-live") {
          const live = item.type === "quarter-live" && !gameOver;
          return (
            <div key={`q-${item.quarter}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 0 10px" }}>
              <div style={{ flex: 1, height: 1, background: "#e5e5e5" }} />
              <div style={{
                fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em",
                color: live ? "#4caf50" : "#aaa", whiteSpace: "nowrap",
                display: "flex", alignItems: "center", gap: 5,
              }}>
                {live && <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#4caf50" }} />}
                {live ? `${qLabel(item.quarter)} — Live` : `${qLabel(item.quarter)} — Final`}
              </div>
              <div style={{ flex: 1, height: 1, background: "#e5e5e5" }} />
            </div>
          );
        }

        if (item.type === "goal") {
          const { entry, score, scorer, assist } = item;
          const color = teamColors[entry.teamIdx];
          const teamName = teams[entry.teamIdx]?.name;
          return (
            <div key={entry.dbId ?? i} style={{
              background: "#fff", border: `1px solid #e5e5e5`, borderLeft: `4px solid ${color}`,
              borderRadius: 10, padding: "14px 16px", marginBottom: 10,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color }}>Goal — {teamName}</span>
                  {entry.goalTime && <span style={{ fontSize: 11, color: "#bbb" }}>{entry.goalTime}</span>}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>
                  <span style={{ color: teamColors[0] }}>{score[0]}</span>
                  <span style={{ color: "#ccc", margin: "0 4px" }}>—</span>
                  <span style={{ color: teamColors[1] }}>{score[1]}</span>
                </div>
              </div>
              {scorer && (
                <div style={{ fontSize: 13, color: "#333" }}>
                  <span style={{ fontWeight: 600 }}>#{scorer.num} {scorer.name}</span>
                  {assist && <span style={{ color: "#888" }}> · Assist: #{assist.num} {assist.name}</span>}
                </div>
              )}
            </div>
          );
        }

        if (item.type === "event") {
          const { entry } = item;
          const color = teamColors[entry.teamIdx];
          const player = entry.teamStat ? null : entry.player;
          const label = EVENT_LABELS[entry.event] ?? entry.event;
          return (
            <div key={entry.dbId ?? i} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 14px", marginBottom: 6,
              background: "#fafafa", border: "1px solid #f0f0f0", borderRadius: 8,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
              <div style={{ fontSize: 13, color: "#555", flex: 1 }}>
                <span style={{ fontWeight: 600, color: "#333" }}>{label}</span>
                {player && <span style={{ color: "#888" }}> — #{player.num} {player.name}</span>}
                <span style={{ color: "#bbb" }}> · {teams[entry.teamIdx]?.name}</span>
              </div>
              {entry.goalTime && <div style={{ fontSize: 11, color: "#ccc" }}>{entry.goalTime}</div>}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
