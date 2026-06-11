import { useState } from 'react';
import { entryZone, ZONE_BANDS } from '../utils/shotZones';

// viewBox 0 0 120 110 — 2 units per yard, full half-field
// y=0: midline  y=110: end line
// Restraining line at y=40 · Goal line at y=90
// Per-zone aggregates over the six shot zones (L/C/R × close/far bands).
// Legacy entries that only carry {shotX, shotY} are bucketed on the fly.
const VW = 120;
const VH = 110;

const ZONE_RECTS = [
  { zone: 'L2', x: 0,  y: 0,  w: 40, h: ZONE_BANDS.closeTop },
  { zone: 'C2', x: 40, y: 0,  w: 40, h: ZONE_BANDS.closeTop },
  { zone: 'R2', x: 80, y: 0,  w: 40, h: ZONE_BANDS.closeTop },
  { zone: 'L1', x: 0,  y: ZONE_BANDS.closeTop, w: 40, h: ZONE_BANDS.goalLine - ZONE_BANDS.closeTop },
  { zone: 'C1', x: 40, y: ZONE_BANDS.closeTop, w: 40, h: ZONE_BANDS.goalLine - ZONE_BANDS.closeTop },
  { zone: 'R1', x: 80, y: ZONE_BANDS.closeTop, w: 40, h: ZONE_BANDS.goalLine - ZONE_BANDS.closeTop },
];

function HalfField() {
  return (
    <>
      <rect x="0" y="0" width={VW} height={VH} fill="#34d399" fillOpacity="0.12" />
      {/* Sidelines */}
      <line x1="0" y1="0" x2="0" y2={VH} stroke="#064e3b" strokeWidth="1" />
      <line x1={VW} y1="0" x2={VW} y2={VH} stroke="#064e3b" strokeWidth="1" />
      {/* End line */}
      <line x1="0" y1={VH} x2={VW} y2={VH} stroke="#064e3b" strokeWidth="2" />
      {/* Midline */}
      <line x1="0" y1="0" x2={VW} y2="0" stroke="#064e3b" strokeWidth="1.5" />
      <text x="60" y="6" textAnchor="middle" fontSize="4" fill="#064e3b" opacity="0.45">Midfield</text>
      {/* Restraining line — 20 yd from midline, full width */}
      <line x1="0" y1="40" x2={VW} y2="40" stroke="#064e3b" strokeWidth="0.75" strokeDasharray="3,2" opacity="0.8" />
      {/* Goal crease */}
      <circle cx="60" cy="90" r="6" fill="rgba(255,255,255,0.35)" stroke="#064e3b" strokeWidth="0.75" />
      {/* Goal cage — triangle viewed from above */}
      <polygon points="57,90 63,90 60,94" fill="rgba(255,255,255,0.75)" stroke="#064e3b" strokeWidth="1" strokeLinejoin="round" />
      {/* Goal line (front of cage) */}
      <line x1="57" y1="90" x2="63" y2="90" stroke="#064e3b" strokeWidth="2" />
    </>
  );
}

export default function ShotMap({ log, teamColors, teams }) {
  const [teamFilter, setTeamFilter] = useState("both");

  // A goal is logged as a shot + goal entry pair sharing one groupId, and the
  // zone is stamped on both — so aggregate per group (one attempt each), not
  // per entry, or every goal would count as two shots in its zone.
  const attempts = new Map(); // groupId → { zone, isGoal }
  for (const e of log) {
    if (e.event !== 'shot' && e.event !== 'goal') continue;
    if (teamFilter !== "both" && e.teamIdx !== Number(teamFilter)) continue;
    const zone = entryZone(e);
    if (zone == null) continue;
    const key = e.groupId ?? `solo-${e.id}`;
    const prev = attempts.get(key);
    attempts.set(key, { zone: prev?.zone ?? zone, isGoal: (prev?.isGoal ?? false) || e.event === 'goal' });
  }
  const shots = [...attempts.values()];

  const zoneStats = Object.fromEntries(ZONE_RECTS.map(z => [z.zone, { shots: 0, goals: 0 }]));
  for (const s of shots) {
    if (!zoneStats[s.zone]) continue;
    zoneStats[s.zone].shots++;
    if (s.isGoal) zoneStats[s.zone].goals++;
  }
  const maxShots = Math.max(1, ...Object.values(zoneStats).map(z => z.shots));

  const teamName = (idx) => teams?.[idx]?.name || `Team ${idx + 1}`;
  const fillColor = teamFilter === "both" ? "#064e3b" : teamColors[Number(teamFilter)];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e5e5' }}>

      {/* Team filter */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
        {[["both", "Both"], ["0", teamName(0)], ["1", teamName(1)]].map(([val, label]) => (
          <button key={val} onClick={() => setTeamFilter(val)} style={{
            padding: "5px 14px",
            fontSize: 12,
            fontWeight: 500,
            border: `1px solid ${teamFilter === val ? '#111' : '#ddd'}`,
            borderRadius: 20,
            background: teamFilter === val
              ? (val === "both" ? "#111" : teamColors[Number(val)])
              : "transparent",
            color: teamFilter === val ? "#fff" : "#888",
            cursor: "pointer",
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* Field with per-zone aggregates */}
      <div style={{ width: '100%', aspectRatio: `${VW}/${VH}`, border: '1.5px solid #064e3b', borderRadius: 8, overflow: 'hidden' }}>
        <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: '100%', height: '100%', display: 'block' }}>
          <HalfField />
          {/* Behind-goal area — not a valid shot origin */}
          <rect x="0" y="90" width={VW} height="20" fill="#064e3b" fillOpacity="0.1" />
          {ZONE_RECTS.map(({ zone, x, y, w, h }) => {
            const { shots: zShots, goals } = zoneStats[zone];
            const pct = zShots ? Math.round((goals / zShots) * 100) : null;
            return (
              <g key={zone}>
                <rect
                  x={x} y={y} width={w} height={h}
                  fill={fillColor}
                  fillOpacity={zShots ? 0.12 + 0.45 * (zShots / maxShots) : 0}
                  stroke="#064e3b" strokeWidth="0.5" strokeOpacity="0.5"
                />
                <text x={x + w / 2} y={y + h / 2 - 3} textAnchor="middle" fontSize="4" fontWeight="700" fill="#064e3b" opacity="0.45">
                  {zone}
                </text>
                {zShots > 0 && (
                  <text x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle" fontSize="5.5" fontWeight="700" fill="#063e2e">
                    {zShots}-{goals} · {pct}%
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {shots.length === 0 && (
        <div style={{ textAlign: 'center', fontSize: 13, color: '#aaa' }}>No shot locations recorded yet</div>
      )}

      {/* Legend */}
      <div style={{ textAlign: 'center', fontSize: 12, color: '#888' }}>
        Per zone: shots-goals · shooting % — shading scales with shot volume
      </div>
    </div>
  );
}
