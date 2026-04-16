import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import NDPBLAXStats from "../components/NDPBLAXStats";

const S = {
  header: { display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid #e5e5e5", background: "#fff", position: "sticky", top: 0, zIndex: 10 },
  backBtn: { fontSize: 13, color: "#888", background: "none", border: "none", cursor: "pointer", padding: "4px 0" },
  headerTitle: { fontSize: 14, fontWeight: 500, color: "#111", flex: 1 },
  saveStatus: { fontSize: 12, color: "#aaa" },
  viewBtn: { padding: "6px 12px", fontSize: 12, fontWeight: 500, background: "transparent", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", color: "#555" },
  loading: { fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "#888", fontSize: 14 },
  error: { fontFamily: "system-ui, sans-serif", maxWidth: 400, margin: "40px auto", padding: 20, background: "#fff5f5", border: "1px solid #f0a0a0", borderRadius: 10, color: "#c0392b", fontSize: 14 },
};

export default function Scorekeeper() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saveStatus, setSaveStatus] = useState(""); // "" | "saving" | "saved" | "error"
  const saveTimer = useRef(null);
  const pendingSave = useRef(null);
  const saveInFlight = useRef(false);

  useEffect(() => {
    loadGame();
  }, [id]);

  async function loadGame() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("games")
      .select("id, created_at, name, state")
      .eq("id", id)
      .single();
    if (err) { setError(err.message); setLoading(false); return; }
    setGame(data);
    setLoading(false);
  }

  // Debounced save: coalesces rapid state changes into one write per 800ms
  const handleStateChange = useCallback(async (newState) => {
    console.log("[Scorekeeper] onStateChange fired, log entries:", newState?.log?.length, "teams:", newState?.teams?.map(t => t.name));
    pendingSave.current = newState;

    // Update the display name only — do NOT write state back into game here,
    // as that would change the initialState prop and re-trigger hydration in NDPBLAXStats.
    if (newState.teams?.[0]?.name && newState.teams?.[1]?.name) {
      const autoName = `${newState.teams[0].name} vs ${newState.teams[1].name}`;
      setGame(prev => prev ? { ...prev, name: autoName } : prev);
    }

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (saveInFlight.current) return; // will retry on next change
      const stateToSave = pendingSave.current;
      if (!stateToSave) return;
      saveInFlight.current = true;
      setSaveStatus("saving");
      pendingSave.current = null;

      const updatePayload = { state: stateToSave };
      if (stateToSave.teams?.[0]?.name && stateToSave.teams?.[1]?.name) {
        updatePayload.name = `${stateToSave.teams[0].name} vs ${stateToSave.teams[1].name}`;
      }

      console.log("[Scorekeeper] saving state to Supabase, game id:", id, "payload:", updatePayload);
      const { error: err } = await supabase
        .from("games")
        .update(updatePayload)
        .eq("id", id);

      saveInFlight.current = false;
      if (err) {
        console.error("[Scorekeeper] save error:", err);
        setSaveStatus("error");
        setTimeout(() => setSaveStatus(""), 3000);
      } else {
        console.log("[Scorekeeper] save succeeded");
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus(""), 2000);
        // If more changes arrived while saving, trigger another save
        if (pendingSave.current) handleStateChange(pendingSave.current);
      }
    }, 800);
  }, [id]);

  if (loading) return <div style={S.loading}>Loading game…</div>;
  if (error) return <div style={S.error}>{error}</div>;

  return (
    <div>
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => navigate("/")}>← Games</button>
        <span style={S.headerTitle}>{game?.name || "Scorekeeper"}</span>
        <span style={S.saveStatus}>
          {saveStatus === "saving" && "Saving…"}
          {saveStatus === "saved" && "Saved ✓"}
          {saveStatus === "error" && "Save failed"}
        </span>
        <button style={S.viewBtn} onClick={() => navigate(`/games/${id}/view`)}>
          Live view →
        </button>
      </div>
      <NDPBLAXStats
        initialState={game?.state}
        onStateChange={handleStateChange}
      />
    </div>
  );
}
