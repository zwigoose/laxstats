import { useState } from 'react';

// viewBox 0 0 120 110 — 2 units per yard, full half-field
// y=0: midline  y=110: end line
// x=0: left sideline  x=120: right sideline
// Restraining line at y=70 (20 yd from end)
// Goal line at y=80 (15 yd from end), goal x=58–62 (6 ft wide)
// Crease: center (60,80) radius 6 (9 ft = 3 yd)
const VW = 120;
const VH = 110;

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
      {/* Restraining line (dashed) */}
      <line x1="0" y1="70" x2={VW} y2="70" stroke="#064e3b" strokeWidth="0.75" strokeDasharray="3,2" opacity="0.7" />
      <text x="3" y="68" fontSize="3" fill="#064e3b" opacity="0.4">Restraining</text>
      {/* GLE — goal line extended, sideline to sideline (solid) */}
      <line x1="0" y1="80" x2={VW} y2="80" stroke="#064e3b" strokeWidth="0.75" opacity="0.6" />
      {/* Goal crease */}
      <circle cx="60" cy="80" r="6" fill="rgba(255,255,255,0.35)" stroke="#064e3b" strokeWidth="0.75" />
      {/* Goal cage — triangle viewed from above.
           Posts at (57,80) and (63,80); net converges to apex at (60,84).
           Apex is 4 units behind goal line = 2 yards = 6 ft (standard cage depth). */}
      <polygon points="57,80 63,80 60,84" fill="rgba(255,255,255,0.75)" stroke="#064e3b" strokeWidth="1" strokeLinejoin="round" />
      {/* Goal line (front of cage, drawn over GLE for emphasis) */}
      <line x1="57" y1="80" x2="63" y2="80" stroke="#064e3b" strokeWidth="2" />
    </>
  );
}

export default function ShotMap({ log, teamColors, teams }) {
  const [teamFilter, setTeamFilter] = useState("both");

  const shots = log
    .filter(e => (e.event === 'shot' || e.event === 'goal') && e.shotX != null && e.shotY != null)
    .filter(e => teamFilter === "both" || e.teamIdx === Number(teamFilter));

  const teamName = (idx) => teams?.[idx]?.name || `Team ${idx + 1}`;

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

      {/* Field */}
      <div style={{ width: '100%', aspectRatio: `${VW}/${VH}`, border: '1.5px solid #064e3b', borderRadius: 8, overflow: 'hidden' }}>
        <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: '100%', height: '100%', display: 'block' }}>
          <HalfField />
          {shots.map((s, i) => (
            <circle
              key={i}
              cx={s.shotX * VW}
              cy={s.shotY * VH}
              r={s.event === 'goal' ? 2.5 : 1.8}
              fill={s.event === 'goal' ? '#fff' : teamColors[s.teamIdx]}
              stroke={teamColors[s.teamIdx]}
              strokeWidth={s.event === 'goal' ? 1.5 : 0.5}
              fillOpacity={s.event === 'goal' ? 1 : 0.65}
            />
          ))}
        </svg>
      </div>

      {shots.length === 0 && (
        <div style={{ textAlign: 'center', fontSize: 13, color: '#aaa' }}>No shot locations recorded yet</div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, fontSize: 12, fontWeight: 500, justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid #888', background: '#fff' }} />
          <span>Goal</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#888', opacity: 0.65 }} />
          <span>Shot</span>
        </div>
      </div>
    </div>
  );
}
