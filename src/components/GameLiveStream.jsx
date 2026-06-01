import { qLabel } from "./LaxStats";

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

function buildFeed(log, teams, completedQuarters, currentQuarter, gameOver) {
  const items = [];

  const allQuarters = [...new Set([...completedQuarters, currentQuarter])].sort((a, b) => a - b);

  for (const q of allQuarters) {
    const qEvents = log
      .filter(e => e.quarter === q)
      .sort((a, b) => (b.seq ?? 0) - (a.seq ?? 0)); // newest first within quarter

    let runningScore = [0, 0];
    // compute score up to start of this quarter
    for (const e of log) {
      if (e.event === "goal" && e.quarter < q) runningScore[e.teamIdx]++;
    }

    const qItems = [];
    for (const e of qEvents) {
      if (e.event === "goal") {
        runningScore = [...runningScore];
        runningScore[e.teamIdx]++;
        qItems.push({ type: "goal", event: e, score: [...runningScore] });
      } else if (EVENT_LABELS[e.event]) {
        qItems.push({ type: "event", event: e });
      }
    }

    if (completedQuarters.includes(q) || (gameOver && q === currentQuarter)) {
      items.push({ type: "quarter-end", quarter: q });
    } else {
      items.push({ type: "quarter-live", quarter: q });
    }
    items.push(...qItems);
  }

  return items;
}

export default function GameLiveStream({ log, teams, teamColors, completedQuarters, currentQuarter, gameOver }) {
  const feed = buildFeed(log, teams, completedQuarters, currentQuarter, gameOver);

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
          const { event: e, score } = item;
          const color = teamColors[e.teamIdx];
          const teamName = teams[e.teamIdx]?.name;
          const scorer = e.players?.[0];
          const assist = e.players?.[1];
          return (
            <div key={e.dbId ?? i} style={{
              background: "#fff", border: `1px solid #e5e5e5`, borderLeft: `4px solid ${color}`,
              borderRadius: 10, padding: "14px 16px", marginBottom: 10,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color }}>Goal — {teamName}</span>
                  {e.goalTime && <span style={{ fontSize: 11, color: "#bbb" }}>{e.goalTime}</span>}
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
          const { event: e } = item;
          const color = teamColors[e.teamIdx];
          const player = e.players?.[0];
          const label = EVENT_LABELS[e.event] ?? e.event;
          return (
            <div key={e.dbId ?? i} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 14px", marginBottom: 6,
              background: "#fafafa", border: "1px solid #f0f0f0", borderRadius: 8,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
              <div style={{ fontSize: 13, color: "#555", flex: 1 }}>
                <span style={{ fontWeight: 600, color: "#333" }}>{label}</span>
                {player && <span style={{ color: "#888" }}> — #{player.num} {player.name}</span>}
                <span style={{ color: "#bbb" }}> · {teams[e.teamIdx]?.name}</span>
              </div>
              {e.goalTime && <div style={{ fontSize: 11, color: "#ccc" }}>{e.goalTime}</div>}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
