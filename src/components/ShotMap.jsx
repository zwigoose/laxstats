export default function ShotMap({ log, teamColors }) {
  const shots = log.filter(e => (e.event === 'shot' || e.event === 'goal') && e.shotX != null && e.shotY != null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e5e5' }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 400, aspectRatio: '4/3', background: '#ecfdf5', border: '2px solid #064e3b', borderRadius: 8, overflow: 'hidden' }}>
        <svg viewBox="0 0 100 75" style={{ width: '100%', height: '100%', display: 'block' }}>
          <rect x="0" y="0" width="100" height="75" fill="#34d399" fillOpacity="0.1" />
          <line x1="0" y1="75" x2="100" y2="75" stroke="#064e3b" strokeWidth="2" />
          <circle cx="50" cy="65" r="9" fill="none" stroke="#064e3b" strokeWidth="1" />
          <line x1="44" y1="65" x2="56" y2="65" stroke="#064e3b" strokeWidth="2" />
          <rect x="47" y="64.5" width="6" height="1" fill="#064e3b" />
          <line x1="0" y1="20" x2="100" y2="20" stroke="#064e3b" strokeWidth="1" strokeDasharray="2,2" />
          {shots.map((s, i) => (
            <circle
              key={i}
              cx={s.shotX * 100}
              cy={s.shotY * 75}
              r={s.event === 'goal' ? 2.5 : 1.5}
              fill={s.event === 'goal' ? '#fff' : teamColors[s.teamIdx]}
              stroke={s.event === 'goal' ? teamColors[s.teamIdx] : 'none'}
              strokeWidth={s.event === 'goal' ? 1.5 : 0}
              fillOpacity={s.event === 'goal' ? 1 : 0.6}
            />
          ))}
        </svg>
      </div>
      {shots.length === 0 && (
        <div style={{ fontSize: 13, color: '#aaa' }}>No shot locations recorded yet</div>
      )}
      <div style={{ display: 'flex', gap: 16, fontSize: 12, fontWeight: 500 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid #666', background: '#fff' }} />
          <span>Goal</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#666' }} />
          <span>Shot</span>
        </div>
      </div>
    </div>
  );
}
