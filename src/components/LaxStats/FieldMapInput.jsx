import { useRef } from 'react';

// Matches ShotMap viewBox: 0 0 120 110 (2 units/yard, full half-field)
// Clicks are normalized to 0-1 relative to container width/height,
// which maps 1:1 to shotX/shotY stored in game_events.

export default function FieldMapInput({ onLocationSelected }) {
  const containerRef = useRef(null);

  const handleClick = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    onLocationSelected({ x, y });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>Where was the shot taken?</div>
      <div
        ref={containerRef}
        onClick={handleClick}
        style={{
          width: '100%',
          maxWidth: 420,
          aspectRatio: '120/110',
          border: '2px solid #064e3b',
          borderRadius: 8,
          overflow: 'hidden',
          cursor: 'crosshair',
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
          {/* Restraining line */}
          <line x1="0" y1="70" x2="120" y2="70" stroke="#064e3b" strokeWidth="0.75" strokeDasharray="3,2" opacity="0.7" />
          <text x="3" y="68" fontSize="3" fill="#064e3b" opacity="0.4">Restraining</text>
          {/* Goal crease */}
          <circle cx="60" cy="80" r="6" fill="rgba(255,255,255,0.4)" stroke="#064e3b" strokeWidth="0.75" />
          {/* Goal line */}
          <line x1="57" y1="80" x2="63" y2="80" stroke="#064e3b" strokeWidth="1.5" />
          {/* Goal cage */}
          <line x1="57" y1="80" x2="57" y2="84" stroke="#064e3b" strokeWidth="1" />
          <line x1="63" y1="80" x2="63" y2="84" stroke="#064e3b" strokeWidth="1" />
          <line x1="57" y1="84" x2="63" y2="84" stroke="#064e3b" strokeWidth="1" />
          {/* Tap-to-mark hint */}
          <text x="60" y="40" textAnchor="middle" fontSize="4" fill="#064e3b" opacity="0.2">Tap to mark shot</text>
        </svg>
      </div>
      <button
        onClick={() => onLocationSelected({ x: null, y: null })}
        style={{ padding: '8px 20px', fontSize: 13, fontWeight: 500, background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 20, cursor: 'pointer', color: '#555' }}
      >
        Skip Location
      </button>
    </div>
  );
}
