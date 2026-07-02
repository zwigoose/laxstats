import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { C, F, SH } from "../styles/tokens";

function pickPlayerOfTheGame(playerStats, teams) {
  if (!playerStats?.length) return null;
  let best = null;
  for (const row of playerStats) {
    const pts = (row.goal || 0) + (row.assist || 0);
    if (!best || pts > best.pts) best = { row, pts };
  }
  if (!best || best.pts === 0) return null;
  const { row } = best;
  return {
    name:    row.player?.name || `#${row.player?.num}`,
    number:  row.player?.num,
    teamIdx: row.teamIdx,
    goals:   row.goal   || 0,
    assists: row.assist || 0,
    shots:   row.shot   || 0,
  };
}

export default function HeroCard({ teams, teamColors, totalScores, playerStats, gameName, logos = [null, null], onClose }) {
  const cardRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  const potg = pickPlayerOfTheGame(playerStats, teams);
  const winnerIdx = totalScores[0] > totalScores[1] ? 0 : totalScores[1] > totalScores[0] ? 1 : null;

  async function handleDownload() {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true });
      const link = document.createElement("a");
      link.download = `laxstats-${gameName?.replace(/\s+/g, "-").toLowerCase() ?? "game"}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setDownloading(false);
    }
  }

  const c0 = teamColors[0] || C.blue600;
  const c1 = teamColors[1] || C.orange700;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: C.blackA70, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.ui, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, maxWidth: 440, width: "100%" }}>

        {/* Card */}
        <div ref={cardRef} style={{
          width: 440, height: 440, background: C.gray900, borderRadius: 20, overflow: "hidden",
          position: "relative", display: "flex", flexDirection: "column",
          boxShadow: SH.hero,
        }}>
          {/* Top color bar split by team */}
          <div style={{ display: "flex", height: 8 }}>
            <div style={{ flex: 1, background: c0 }} />
            <div style={{ flex: 1, background: c1 }} />
          </div>

          {/* Score section */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 32px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: C.gray600, marginBottom: 20 }}>Final Score</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", width: "100%", gap: 8, marginBottom: 20 }}>
              {/* Team 0 */}
              <div style={{ textAlign: "center" }}>
                {logos[0] && <img src={logos[0]} crossOrigin="anonymous" alt="" style={{ height: 52, maxWidth: 100, objectFit: "contain", display: "block", margin: "0 auto 8px" }} />}
                <div style={{ fontSize: 56, fontWeight: 700, color: c0, lineHeight: 1, letterSpacing: -2 }}>{totalScores[0]}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: winnerIdx === 0 ? c0 : C.gray650, marginTop: 8, letterSpacing: "0.01em" }}>{teams[0]?.name}</div>
                {winnerIdx === 0 && <div style={{ fontSize: 10, color: c0, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 3 }}>Winner</div>}
              </div>

              <div style={{ fontSize: 28, fontWeight: 300, color: C.gray700, letterSpacing: 2 }}>—</div>

              {/* Team 1 */}
              <div style={{ textAlign: "center" }}>
                {logos[1] && <img src={logos[1]} crossOrigin="anonymous" alt="" style={{ height: 52, maxWidth: 100, objectFit: "contain", display: "block", margin: "0 auto 8px" }} />}
                <div style={{ fontSize: 56, fontWeight: 700, color: c1, lineHeight: 1, letterSpacing: -2 }}>{totalScores[1]}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: winnerIdx === 1 ? c1 : C.gray650, marginTop: 8, letterSpacing: "0.01em" }}>{teams[1]?.name}</div>
                {winnerIdx === 1 && <div style={{ fontSize: 10, color: c1, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 3 }}>Winner</div>}
              </div>
            </div>

            {/* Divider */}
            {potg && <div style={{ width: "100%", height: 1, background: C.gray800, marginBottom: 20 }} />}

            {/* Player of the Game */}
            {potg && (
              <div style={{ textAlign: "center", width: "100%" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: C.gray650, marginBottom: 10 }}>Player of the Game</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: C.white, marginBottom: 6, letterSpacing: "-0.01em" }}>
                  {potg.number && <span style={{ color: teamColors[potg.teamIdx], marginRight: 6, fontSize: 18 }}>#{potg.number}</span>}
                  {potg.name}
                </div>
                <div style={{ fontSize: 12, color: C.gray550, display: "flex", justifyContent: "center", gap: 16 }}>
                  <span><span style={{ color: C.gray400, fontWeight: 600 }}>{potg.goals}</span> G</span>
                  <span><span style={{ color: C.gray400, fontWeight: 600 }}>{potg.assists}</span> A</span>
                  <span><span style={{ color: C.gray400, fontWeight: 600 }}>{potg.shots}</span> Shots</span>
                </div>
              </div>
            )}
          </div>

          {/* Bottom branding */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 0 14px", borderTop: `1px solid ${C.gray830}` }}>
            <img src="/LaxStatsIcon.png" alt="LaxStats" style={{ width: 16, height: 16, objectFit: "contain", opacity: 0.5 }} />
            <span style={{ fontSize: 11, color: C.gray700, fontWeight: 600, letterSpacing: "0.06em" }}>LAXSTATS.APP</span>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={handleDownload}
            disabled={downloading}
            style={{ fontSize: 14, fontWeight: 700, background: C.white, color: C.gray900, border: "none", borderRadius: 10, padding: "10px 24px", cursor: downloading ? "default" : "pointer", opacity: downloading ? 0.6 : 1 }}>
            {downloading ? "Generating…" : "Download PNG"}
          </button>
          <button
            onClick={onClose}
            style={{ fontSize: 14, color: C.gray400, background: "none", border: `1px solid ${C.gray700}`, borderRadius: 10, padding: "10px 16px", cursor: "pointer" }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
