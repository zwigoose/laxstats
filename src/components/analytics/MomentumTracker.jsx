import { useMemo, useState, useId } from "react";
import { buildMomentumSeries, momentumControlStats, momentumPointLabel } from "../../utils/momentum";
import { qLabel } from "../../utils/stats";
import { C, F, SH } from "../../styles/tokens";

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
  const [infoOpen, setInfoOpen] = useState(false);

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
  // Same line, closed back along the zero axis — filled (clipped per side,
  // same as the stroke) to shade the area under the curve.
  const areaPath = `${path} L${linePts.at(-1).px.toFixed(1)},${zeroY.toFixed(1)} L${linePts[0].px.toFixed(1)},${zeroY.toFixed(1)} Z`;

  const control = useMemo(() => momentumControlStats(points, maxQ), [points, maxQ]);

  // Resolve the nearest plotted point to a viewport x and surface it as hover.
  // Shared by mouse move and touch (tap + drag scrub).
  function resolveHover(clientX, svg) {
    const rect = svg.getBoundingClientRect();
    const mx = ((clientX - rect.left) / rect.width) * W;
    let best = null;
    for (const lp of linePts) {
      if (!lp.point) continue;
      if (!best || Math.abs(lp.px - mx) < Math.abs(best.px - mx)) best = lp;
    }
    setHover(best ? { px: best.px, py: best.py, point: best.point } : null);
  }

  function handleMouseMove(evt) {
    resolveHover(evt.clientX, evt.currentTarget);
  }

  function handleTouch(evt) {
    const t = evt.touches[0];
    if (!t) return;
    resolveHover(t.clientX, evt.currentTarget);
  }

  return (
    <div style={{ border: `1px solid ${C.gray150}`, borderRadius: 12, padding: "12px 12px 8px", marginBottom: 20, background: C.white, position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: C.gray500 }}>MOMENTUM</span>
          <button
            aria-label="What is MOMENTUM?"
            onClick={() => setInfoOpen(v => !v)}
            onBlur={() => setInfoOpen(false)}
            style={{
              width: 15, height: 15, borderRadius: "50%", border: `1px solid ${C.gray300}`,
              background: infoOpen ? C.gray500 : "transparent", color: infoOpen ? C.white : C.gray400,
              fontSize: 10, fontWeight: 700, lineHeight: 1, cursor: "pointer", padding: 0,
              fontFamily: F.serif, fontStyle: "italic", flexShrink: 0,
            }}
          >
            i
          </button>
        </span>
        {!points.length && (
          <span style={{ fontSize: 11, color: C.gray350 }}>Builds as the game is scored</span>
        )}
      </div>

      {/* MOMENTUM info popover */}
      {infoOpen && (
        <div style={{
          position: "absolute", top: 34, left: 12, right: 12, zIndex: 6,
          background: C.gray850, color: C.white, borderRadius: 10, padding: "10px 14px",
          fontSize: 12, lineHeight: 1.55, boxShadow: SH.pop2,
        }}>
          <strong>MOMENTUM</strong> is LaxStats' live read of game control. Goals, faceoff wins,
          shots, clears, and caused turnovers push the line toward the team making the plays
          (penalties push it toward the man-up team), and it drifts back to neutral during quiet
          stretches. Tap any point to see the play behind it.
        </div>
      )}

      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", display: "block", touchAction: "pan-y" }}
        onMouseMove={points.length ? handleMouseMove : undefined}
        onMouseLeave={() => setHover(null)}
        onTouchStart={points.length ? handleTouch : undefined}
        onTouchMove={points.length ? handleTouch : undefined}
      >
        <defs>
          {/* Split the line at the zero axis: home color above, away below */}
          <clipPath id={`${clipId}-home`}><rect x="0" y="0" width={W} height={zeroY} /></clipPath>
          <clipPath id={`${clipId}-away`}><rect x="0" y={zeroY} width={W} height={H - zeroY} /></clipPath>
        </defs>

        {/* Quarter bands + markers */}
        {Array.from({ length: maxQ }, (_, i) => (
          <g key={i}>
            {i > 0 && <line x1={xPx(i)} y1={PAD.top} x2={xPx(i)} y2={PAD.top + PLOT_H} stroke={C.gray85} strokeWidth="1" />}
            <text x={xPx(i + 0.5)} y={H - 8} textAnchor="middle" fontSize="11" fill={C.gray400} fontWeight="600">
              {qLabel(i + 1)}
            </text>
          </g>
        ))}

        {/* Zero (neutral) line */}
        <line x1={PAD.left} y1={zeroY} x2={PAD.left + PLOT_W} y2={zeroY} stroke={C.gray250} strokeWidth="1" strokeDasharray="4,3" />

        {/* Controlling labels — no raw numbers shown to fans */}
        <text x={PAD.left} y={14} fontSize="11" fontWeight="700" fill={teamColors?.[0] || C.blue600}>
          ▲ {teams?.[0]?.name || "Home"} controlling
        </text>
        <text x={PAD.left} y={PAD.top + PLOT_H - 4} fontSize="11" fontWeight="700" fill={teamColors?.[1] || C.orange700}>
          ▼ {teams?.[1]?.name || "Away"} controlling
        </text>

        {/* Area under the curve, clipped into the two halves same as the line */}
        <path d={areaPath} fill={teamColors?.[0] || C.blue600} fillOpacity="0.12" clipPath={`url(#${clipId}-home)`} />
        <path d={areaPath} fill={teamColors?.[1] || C.orange700} fillOpacity="0.12" clipPath={`url(#${clipId}-away)`} />

        {/* Momentum line, clipped into the two halves */}
        <path d={path} fill="none" stroke={teamColors?.[0] || C.blue600} strokeWidth="2" strokeLinejoin="round" clipPath={`url(#${clipId}-home)`} />
        <path d={path} fill="none" stroke={teamColors?.[1] || C.orange700} strokeWidth="2" strokeLinejoin="round" clipPath={`url(#${clipId}-away)`} />

        {/* Hover marker */}
        {hover && (
          <circle cx={hover.px} cy={hover.py} r="4" fill={hover.point.score >= 0 ? (teamColors?.[0] || C.blue600) : (teamColors?.[1] || C.orange700)} stroke={C.white} strokeWidth="1.5" />
        )}
      </svg>

      {/* Control split + lead changes — layman-friendly summary stats, no raw scores */}
      {points.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.gray90}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
            <span style={{ color: teamColors?.[0] || C.blue600 }}>{teams?.[0]?.name || "Home"} {control.pctHome}%</span>
            <span style={{ color: teamColors?.[1] || C.orange700 }}>{control.pctAway}% {teams?.[1]?.name || "Away"}</span>
          </div>
          <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${control.pctHome}%`, background: teamColors?.[0] || C.blue600 }} />
            <div style={{ width: `${control.pctAway}%`, background: teamColors?.[1] || C.orange700 }} />
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: C.gray500, textAlign: "center" }}>
            🔄 Momentum changed hands {control.leadChanges} {control.leadChanges === 1 ? "time" : "times"}
          </div>
        </div>
      )}

      {/* Tooltip */}
      {hover && (
        <div style={{
          position: "absolute",
          left: `${Math.min(85, Math.max(5, (hover.px / W) * 100))}%`,
          top: 8,
          transform: "translateX(-50%)",
          background: C.gray850, color: C.white, fontSize: 11, borderRadius: 6,
          padding: "4px 9px", pointerEvents: "none", whiteSpace: "nowrap", zIndex: 5,
        }}>
          {momentumPointLabel(hover.point, teams)}
        </div>
      )}
    </div>
  );
}
