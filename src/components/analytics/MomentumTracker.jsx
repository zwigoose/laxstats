import { useMemo, useState, useId } from "react";
import { buildMomentumSeries, momentumPointLabel } from "../../utils/momentum";
import { qLabel } from "../../utils/stats";

// Fan-facing momentum line chart. Hand-rolled SVG per project convention
// (same as ShotMap / the field renders) — no charting dependency.
//
// The line is split at the zero axis via two clip paths: home-colored above,
// away-colored below. X is laid out in equal-width quarter bands.

const W = 600;
const H = 180;
const PAD = { top: 26, right: 10, bottom: 22, left: 10 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

export default function MomentumTracker({ log, teams, teamColors, currentQuarter = 1, gameOver = false }) {
  const clipId = useId();
  const [hover, setHover] = useState(null); // { px, py, point }

  const points = useMemo(() => buildMomentumSeries(log || []), [log]);

  // Always show at least the regulation quarters; extend for OT data
  const maxQ = Math.max(4, gameOver ? 4 : currentQuarter, ...points.map(p => p.quarter));
  const maxAbs = Math.max(8, ...points.map(p => Math.abs(p.score))) * 1.1;

  const xPx = (x) => PAD.left + (x / maxQ) * PLOT_W;
  const yPx = (score) => PAD.top + PLOT_H / 2 - (score / maxAbs) * (PLOT_H / 2);
  const zeroY = yPx(0);

  // Line starts at neutral and steps through every momentum event
  const linePts = [{ px: PAD.left, py: zeroY }, ...points.map(p => ({ px: xPx(p.x), py: yPx(p.score), point: p }))];
  if (gameOver || points.length) {
    const lastX = gameOver ? PAD.left + PLOT_W : xPx((Math.max(currentQuarter, points.at(-1)?.quarter ?? 1) - 1) + 0.98);
    if (lastX > linePts.at(-1).px) linePts.push({ px: lastX, py: linePts.at(-1).py });
  }
  const path = linePts.map((p, i) => `${i === 0 ? "M" : "L"}${p.px.toFixed(1)},${p.py.toFixed(1)}`).join(" ");

  function handleMove(evt) {
    const svg = evt.currentTarget;
    const rect = svg.getBoundingClientRect();
    const mx = ((evt.clientX - rect.left) / rect.width) * W;
    let best = null;
    for (const lp of linePts) {
      if (!lp.point) continue;
      if (!best || Math.abs(lp.px - mx) < Math.abs(best.px - mx)) best = lp;
    }
    setHover(best ? { px: best.px, py: best.py, point: best.point } : null);
  }

  return (
    <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: "12px 12px 8px", marginBottom: 20, background: "#fff", position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#888" }}>Momentum</span>
        {!points.length && (
          <span style={{ fontSize: 11, color: "#bbb" }}>Builds as the game is scored</span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", display: "block", touchAction: "pan-y" }}
        onMouseMove={points.length ? handleMove : undefined}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          {/* Split the line at the zero axis: home color above, away below */}
          <clipPath id={`${clipId}-home`}><rect x="0" y="0" width={W} height={zeroY} /></clipPath>
          <clipPath id={`${clipId}-away`}><rect x="0" y={zeroY} width={W} height={H - zeroY} /></clipPath>
        </defs>

        {/* Quarter bands + markers */}
        {Array.from({ length: maxQ }, (_, i) => (
          <g key={i}>
            {i > 0 && <line x1={xPx(i)} y1={PAD.top} x2={xPx(i)} y2={PAD.top + PLOT_H} stroke="#eee" strokeWidth="1" />}
            <text x={xPx(i + 0.5)} y={H - 8} textAnchor="middle" fontSize="11" fill="#aaa" fontWeight="600">
              {qLabel(i + 1)}
            </text>
          </g>
        ))}

        {/* Zero (neutral) line */}
        <line x1={PAD.left} y1={zeroY} x2={PAD.left + PLOT_W} y2={zeroY} stroke="#ddd" strokeWidth="1" strokeDasharray="4,3" />

        {/* Controlling labels — no raw numbers shown to fans */}
        <text x={PAD.left} y={14} fontSize="11" fontWeight="700" fill={teamColors?.[0] || "#1a6bab"}>
          ▲ {teams?.[0]?.name || "Home"} controlling
        </text>
        <text x={PAD.left} y={PAD.top + PLOT_H - 4} fontSize="11" fontWeight="700" fill={teamColors?.[1] || "#b84e1a"}>
          ▼ {teams?.[1]?.name || "Away"} controlling
        </text>

        {/* Momentum line, clipped into the two halves */}
        <path d={path} fill="none" stroke={teamColors?.[0] || "#1a6bab"} strokeWidth="2" strokeLinejoin="round" clipPath={`url(#${clipId}-home)`} />
        <path d={path} fill="none" stroke={teamColors?.[1] || "#b84e1a"} strokeWidth="2" strokeLinejoin="round" clipPath={`url(#${clipId}-away)`} />

        {/* Hover marker */}
        {hover && (
          <circle cx={hover.px} cy={hover.py} r="4" fill={hover.point.score >= 0 ? (teamColors?.[0] || "#1a6bab") : (teamColors?.[1] || "#b84e1a")} stroke="#fff" strokeWidth="1.5" />
        )}
      </svg>

      {/* Tooltip */}
      {hover && (
        <div style={{
          position: "absolute",
          left: `${Math.min(85, Math.max(5, (hover.px / W) * 100))}%`,
          top: 8,
          transform: "translateX(-50%)",
          background: "#1a1a1a", color: "#fff", fontSize: 11, borderRadius: 6,
          padding: "4px 9px", pointerEvents: "none", whiteSpace: "nowrap", zIndex: 5,
        }}>
          {momentumPointLabel(hover.point, teams)}
        </div>
      )}
    </div>
  );
}
