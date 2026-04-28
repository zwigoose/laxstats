import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function MigrationTab() {
  const [running, setRunning] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);

  async function run(dryRun) {
    setRunning(true); setResult(null); setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/migrate_v1_games`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ dry_run: dryRun }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }

  const btnBase = { padding: "10px 20px", fontSize: 14, fontWeight: 700, border: "none", borderRadius: 10, cursor: "pointer" };

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 20, marginBottom: 16, border: "1px solid #e8e8e8" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#111", marginBottom: 6 }}>v1 → v2 Game Migration</div>
        <div style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>
          Translates JSONB <code>state.log</code> from all <code>schema_ver=1</code> games into normalized <code>game_events</code> rows.
          Verifies goal counts before committing. Idempotent — already-migrated games are skipped.
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={{ ...btnBase, background: "#f0f0f0", color: "#555" }} onClick={() => run(true)} disabled={running}>
            {running ? "Running…" : "Dry Run"}
          </button>
          <button style={{ ...btnBase, background: "#111", color: "#fff" }} onClick={() => run(false)} disabled={running}>
            {running ? "Migrating…" : "Run Migration"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "#fff5f5", border: "1px solid #fdd", borderRadius: 10, padding: "12px 16px", color: "#c0392b", fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #f0f0f0", display: "flex", gap: 24 }}>
            {result.dry_run && <span style={{ fontSize: 11, fontWeight: 700, color: "#d4820a", background: "rgba(212,130,10,0.1)", borderRadius: 6, padding: "2px 8px", letterSpacing: "0.06em" }}>DRY RUN</span>}
            <span style={{ fontSize: 13, color: "#2a7a3b", fontWeight: 600 }}>✓ {result.migrated} migrated</span>
            <span style={{ fontSize: 13, color: "#888" }}>{result.skipped} skipped</span>
            {result.errors > 0 && <span style={{ fontSize: 13, color: "#c0392b", fontWeight: 600 }}>✗ {result.errors} errors</span>}
            <span style={{ fontSize: 13, color: "#bbb" }}>{result.total} total</span>
          </div>
          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {result.details.map((d, i) => (
              <div key={i} style={{ padding: "10px 18px", borderBottom: "1px solid #f8f8f8", display: "flex", gap: 10, alignItems: "baseline" }}>
                <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 4, padding: "1px 6px",
                  color: d.status === "migrated" || d.status === "dry_run" ? "#2a7a3b" : d.status === "skipped" ? "#888" : "#c0392b",
                  background: d.status === "migrated" || d.status === "dry_run" ? "#eaf6ec" : d.status === "skipped" ? "#f5f5f5" : "#fff5f5",
                }}>{d.status}</span>
                <span style={{ fontSize: 13, color: "#111", flex: 1 }}>{d.name || d.game_id}</span>
                {d.events != null && <span style={{ fontSize: 12, color: "#aaa" }}>{d.events} events</span>}
                {d.error && <span style={{ fontSize: 12, color: "#c0392b" }}>{d.error}</span>}
                {d.reason && <span style={{ fontSize: 12, color: "#aaa" }}>{d.reason}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
