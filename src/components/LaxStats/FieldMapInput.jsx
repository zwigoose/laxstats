import { useState } from 'react';
import { ZONE_BANDS } from '../../utils/shotZones';

// Six-zone shot location input (viewBox 0 0 120 110, same field as ShotMap).
// Zones cover midfield (y=0) to the goal line (y=90) only — by rule a ball
// released from behind the goal line extended cannot be a shot, so the
// behind-goal area is rendered dimmed and inert.
const COLS = [
  { key: 'L', x: 0, w: 40 },
  { key: 'C', x: 40, w: 40 },
  { key: 'R', x: 80, w: 40 },
];
const BANDS = [
  { key: '2', y: 0, h: ZONE_BANDS.closeTop },                                  // far band: midfield → 50% to restraining
  { key: '1', y: ZONE_BANDS.closeTop, h: ZONE_BANDS.goalLine - ZONE_BANDS.closeTop }, // close band: → goal line
];

export default function FieldMapInput({ onZoneSelected }) {
  const [activeZone, setActiveZone] = useState(null);

  function handleTap(zone) {
    setActiveZone(zone);
    onZoneSelected(zone);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>Which zone was the shot taken from?</div>
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          aspectRatio: '120/110',
          border: '2px solid #064e3b',
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        <svg viewBox="0 0 120 110" style={{ width: '100%', height: '100%', display: 'block', userSelect: 'none' }}>
          {/* Grass */}
          <rect x="0" y="0" width="120" height="110" fill="#34d399" fillOpacity="0.2" />
          {/* Sidelines */}
          <line x1="0" y1="0" x2="0" y2="110" stroke="#064e3b" strokeWidth="1" />
          <line x1="120" y1="0" x2="120" y2="110" stroke="#064e3b" strokeWidth="1" />
          {/* End line */}
          <line x1="0" y1="110" x2="120" y2="110" stroke="#064e3b" strokeWidth="2" />
          {/* Midline */}
          <line x1="0" y1="0" x2="120" y2="0" stroke="#064e3b" strokeWidth="1.5" />
          <text x="60" y="6" textAnchor="middle" fontSize="4" fill="#064e3b" opacity="0.45">Midfield</text>
          {/* Restraining line — 20 yd from midline, full width */}
          <line x1="0" y1="40" x2="120" y2="40" stroke="#064e3b" strokeWidth="0.75" strokeDasharray="3,2" opacity="0.8" />
          {/* Behind-goal area — not a valid shot origin */}
          <rect x="0" y="90" width="120" height="20" fill="#064e3b" fillOpacity="0.18" />
          <text x="60" y="103" textAnchor="middle" fontSize="3.5" fill="#064e3b" opacity="0.5">Behind goal — not a shot</text>
          {/* Goal crease */}
          <circle cx="60" cy="90" r="6" fill="rgba(255,255,255,0.35)" stroke="#064e3b" strokeWidth="0.75" />
          {/* Goal cage — triangle viewed from above */}
          <polygon points="57,90 63,90 60,94" fill="rgba(255,255,255,0.75)" stroke="#064e3b" strokeWidth="1" strokeLinejoin="round" />
          {/* Goal line (front of cage) */}
          <line x1="57" y1="90" x2="63" y2="90" stroke="#064e3b" strokeWidth="2" />

          {/* Tappable zones */}
          {BANDS.map(band => COLS.map(col => {
            const zone = col.key + band.key;
            const active = activeZone === zone;
            return (
              <g key={zone} onClick={() => handleTap(zone)} style={{ cursor: 'pointer' }}>
                <rect
                  x={col.x} y={band.y} width={col.w} height={band.h}
                  fill={active ? '#064e3b' : '#34d399'}
                  fillOpacity={active ? 0.5 : 0.12}
                  stroke="#064e3b" strokeWidth="0.6" strokeOpacity="0.55"
                />
                <text
                  x={col.x + col.w / 2} y={band.y + band.h / 2 + 2}
                  textAnchor="middle" fontSize="6" fontWeight="700"
                  fill="#064e3b" opacity={active ? 0.9 : 0.35}
                  style={{ pointerEvents: 'none' }}
                >
                  {zone}
                </text>
              </g>
            );
          }))}
        </svg>
      </div>
      <button
        onClick={() => onZoneSelected(null)}
        style={{ padding: '8px 20px', fontSize: 13, fontWeight: 500, background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 20, cursor: 'pointer', color: '#555' }}
      >
        Skip Location
      </button>
    </div>
  );
}
