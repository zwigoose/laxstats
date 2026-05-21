export default function MigrationTab() {
  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 20, border: "1px solid #e8e8e8" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#111", marginBottom: 6 }}>Migration</div>
        <div style={{ fontSize: 13, color: "#888" }}>
          All games now use the <code>game_events</code> architecture. No migration is needed —
          new games (personal and org) are created with <code>schema_ver=2</code> and write
          directly to <code>game_events</code> and <code>game_meta_events</code>.
        </div>
      </div>
    </div>
  );
}
