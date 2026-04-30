import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { qLabel } from "../../utils/stats";
import { formatDate, getGameInfo } from "../../utils/game";
import { displayName } from "./helpers";

export default function AdminGameRow({ game, userMap, users, onReassigned, onDeleted }) {
  const navigate = useNavigate();
  const info = getGameInfo(game);
  const owner = userMap[game.user_id];
  const c0 = info?.t0?.color || "#444";
  const c1 = info?.t1?.color || "#888";
  const [adminOpen, setAdminOpen]         = useState(false);
  const [newOwnerId, setNewOwnerId]       = useState(game.user_id || "");
  const [reassigning, setReassigning]     = useState(false);
  const [reassignError, setReassignError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting]           = useState(false);
  const [deleteError, setDeleteError]     = useState(null);
  const [pressboxEnabled, setPressboxEnabled]       = useState(!!game.pressbox_enabled);
  const [togglingPressbox, setTogglingPressbox]     = useState(false);
  const [pressboxError, setPressboxError]           = useState(null);
  const [orgPressbox, setOrgPressbox]               = useState(null);
  const [multiScorerEnabled, setMultiScorerEnabled] = useState(!!game.multi_scorer_enabled);
  const [togglingMultiScorer, setTogglingMultiScorer] = useState(false);
  const [multiScorerError, setMultiScorerError]     = useState(null);

  async function handleDelete() {
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    setDeleting(true); setDeleteError(null);
    const { error: err } = await supabase.rpc("admin_delete_game", { p_game_id: game.id });
    if (err) { setDeleteError(err.message); setDeleting(false); }
    else { onDeleted(game.id); }
  }

  async function handleTogglePressbox() {
    setTogglingPressbox(true); setPressboxError(null);
    const next = !pressboxEnabled;
    const { error: err } = await supabase.rpc("admin_set_game_pressbox", { p_game_id: game.id, p_enabled: next });
    if (err) { setPressboxError(err.message); setTogglingPressbox(false); return; }
    setPressboxEnabled(next); setTogglingPressbox(false);
  }

  async function handleToggleMultiScorer() {
    setTogglingMultiScorer(true); setMultiScorerError(null);
    const next = !multiScorerEnabled;
    const { error: err } = await supabase.rpc("admin_set_game_multi_scorer", { p_game_id: game.id, p_enabled: next });
    if (err) { setMultiScorerError(err.message); setTogglingMultiScorer(false); return; }
    setMultiScorerEnabled(next); setTogglingMultiScorer(false);
  }

  async function handleReassign() {
    if (!newOwnerId || newOwnerId === game.user_id) return;
    setReassigning(true); setReassignError(null);
    const { error: err } = await supabase.rpc("admin_reassign_game", { p_game_id: game.id, p_user_id: newOwnerId });
    if (err) setReassignError(err.message);
    else { onReassigned(game.id, newOwnerId); setAdminOpen(false); }
    setReassigning(false);
  }

  return (
    <div style={{ borderRadius: 14, overflow: "hidden", marginBottom: 10, boxShadow: "0 2px 10px rgba(0,0,0,0.06)", border: "1px solid #e8e8e8", background: "#fff" }}>
      <div style={{ height: 4, background: info ? `linear-gradient(90deg, ${c0} 50%, ${c1} 50%)` : "#e0e0e0" }} />
      <div style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>
            {info ? `${info.t0.name} vs ${info.t1.name}` : game.name}
          </div>
          {info && (
            <div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#111" }}>
              <span style={{ color: c0 }}>{info.score0}</span>
              <span style={{ color: "#ccc", margin: "0 4px" }}>—</span>
              <span style={{ color: c1 }}>{info.score1}</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {info?.gameOver ? (
              <span style={{ fontSize: 11, fontWeight: 600, color: "#888", background: "#f0f0f0", borderRadius: 20, padding: "2px 8px" }}>Final</span>
            ) : info?.started ? (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#2a7a3b", background: "#eaf6ec", borderRadius: 20, padding: "2px 8px" }}>● Live{info.latestTime ? ` · ${info.latestTime} ${qLabel(info.currentQuarter)}` : ""}</span>
            ) : (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#d4820a", background: "#fff8ec", borderRadius: 20, padding: "2px 8px" }}>Pending</span>
            )}
            {owner && <span style={{ fontSize: 11, color: "#aaa" }}>{displayName(owner.email)}</span>}
            <span style={{ fontSize: 11, color: "#ccc" }}>
              Game: {formatDate((game.state?.gameDate) || game.created_at.split("T")[0])}
              {" · "}Created: {formatDate(game.created_at)}
            </span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={{ padding: "5px 10px", fontSize: 12, fontWeight: 500, background: "transparent", border: "1px solid #ddd", borderRadius: 7, cursor: "pointer", color: "#555" }}
              onClick={() => navigate(`/games/${game.id}/view`)}>View</button>
            <button style={{ padding: "5px 10px", fontSize: 12, fontWeight: 500, background: "transparent", border: "1px solid #ddd", borderRadius: 7, cursor: "pointer", color: "#555" }}
              onClick={() => window.open(`/games/${game.id}/pressbox`, "_blank")}>Press Box</button>
            <button style={{ padding: "5px 12px", fontSize: 12, fontWeight: 600, background: "#111", border: "none", borderRadius: 7, cursor: "pointer", color: "#fff" }}
              onClick={() => navigate(`/games/${game.id}/score`)}>{info?.started ? "Score" : "Setup"}</button>
            <button title="Reassign owner" style={{ padding: "5px 9px", fontSize: 12, background: adminOpen ? "#f0f0f0" : "transparent", border: "1px solid #ddd", borderRadius: 7, cursor: "pointer", color: "#888" }}
              onClick={() => {
                const opening = !adminOpen;
                setAdminOpen(opening);
                setDeleteConfirm(false);
                setDeleteError(null);
                if (opening && orgPressbox === null && game.org_id) {
                  supabase.rpc("org_feature_limit", { p_org_id: game.org_id, p_feature_id: "pressbox" })
                    .then(({ data }) => setOrgPressbox(data !== 0));
                }
              }}>⚙</button>
          </div>
        </div>
      </div>
      {adminOpen && (
        <div style={{ borderTop: "1px solid #f0f0f0", padding: "10px 16px 12px", background: "#fafafa" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Reassign owner</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select value={newOwnerId} onChange={e => setNewOwnerId(e.target.value)}
              style={{ flex: 1, padding: "6px 8px", fontSize: 13, border: "1px solid #e0e0e0", borderRadius: 8, background: "#fff" }}>
              <option value="">Select user…</option>
              {users.map(u => <option key={u.id} value={u.id}>{displayName(u.email)}</option>)}
            </select>
            <button onClick={handleReassign} disabled={!newOwnerId || newOwnerId === game.user_id || reassigning}
              style={{ padding: "6px 14px", fontSize: 13, fontWeight: 600, background: (newOwnerId && newOwnerId !== game.user_id && !reassigning) ? "#111" : "#ccc", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", flexShrink: 0 }}>
              {reassigning ? "…" : "Save"}
            </button>
          </div>
          {reassignError && <div style={{ fontSize: 12, color: "#c0392b", marginTop: 6 }}>{reassignError}</div>}
          <div style={{ marginTop: 14, borderTop: "1px solid #ebebeb", paddingTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Press Box</div>
            {orgPressbox ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ position: "relative", width: 40, height: 22, borderRadius: 11, background: "#111", flexShrink: 0 }}>
                  <span style={{ position: "absolute", top: 3, left: 21, width: 16, height: 16, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                </div>
                <span style={{ fontSize: 13, color: "#555" }}>Enabled via org plan</span>
                <button onClick={() => window.open(`/games/${game.id}/pressbox`, "_blank")}
                  style={{ fontSize: 11, color: "#1a6bab", background: "none", border: "1px solid #c0d8f0", borderRadius: 6, padding: "3px 8px", cursor: "pointer", flexShrink: 0 }}>Open ↗</button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={handleTogglePressbox} disabled={togglingPressbox}
                  style={{ position: "relative", width: 40, height: 22, borderRadius: 11, border: "none", background: pressboxEnabled ? "#111" : "#ddd", cursor: togglingPressbox ? "default" : "pointer", transition: "background 0.2s", flexShrink: 0, padding: 0 }}>
                  <span style={{ position: "absolute", top: 3, left: pressboxEnabled ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                </button>
                <span style={{ fontSize: 13, color: "#555" }}>
                  {pressboxEnabled ? "Enabled — press box link is active for this game" : "Disabled — enable to share the press box view"}
                </span>
                {pressboxEnabled && (
                  <button onClick={() => window.open(`/games/${game.id}/pressbox`, "_blank")}
                    style={{ fontSize: 11, color: "#1a6bab", background: "none", border: "1px solid #c0d8f0", borderRadius: 6, padding: "3px 8px", cursor: "pointer", flexShrink: 0 }}>Open ↗</button>
                )}
              </div>
            )}
            {pressboxError && <div style={{ fontSize: 12, color: "#c0392b", marginTop: 6 }}>{pressboxError}</div>}
          </div>
          {game.schema_ver === 2 && (
            <div style={{ marginTop: 14, borderTop: "1px solid #ebebeb", paddingTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Multi-Scorekeeper</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={handleToggleMultiScorer} disabled={togglingMultiScorer}
                  style={{ position: "relative", width: 40, height: 22, borderRadius: 11, border: "none", background: multiScorerEnabled ? "#111" : "#ddd", cursor: togglingMultiScorer ? "default" : "pointer", transition: "background 0.2s", flexShrink: 0, padding: 0 }}>
                  <span style={{ position: "absolute", top: 3, left: multiScorerEnabled ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                </button>
                <span style={{ fontSize: 13, color: "#555" }}>
                  {multiScorerEnabled ? "Enabled — scorer invite links can be generated" : "Disabled — only the game owner can score"}
                </span>
              </div>
              {multiScorerError && <div style={{ fontSize: 12, color: "#c0392b", marginTop: 6 }}>{multiScorerError}</div>}
            </div>
          )}
          <div style={{ marginTop: 14, borderTop: "1px solid #ebebeb", paddingTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Danger zone</div>
            {!deleteConfirm ? (
              <button onClick={handleDelete}
                style={{ padding: "6px 14px", fontSize: 13, fontWeight: 500, background: "transparent", border: "1px solid #e0a0a0", borderRadius: 8, cursor: "pointer", color: "#c0392b" }}>
                Delete game
              </button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, color: "#c0392b", fontWeight: 500 }}>Delete permanently?</span>
                <button onClick={handleDelete} disabled={deleting}
                  style={{ padding: "6px 14px", fontSize: 13, fontWeight: 700, background: deleting ? "#ccc" : "#c0392b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
                  {deleting ? "Deleting…" : "Yes, delete"}
                </button>
                <button onClick={() => { setDeleteConfirm(false); setDeleteError(null); }}
                  style={{ padding: "6px 12px", fontSize: 13, background: "transparent", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", color: "#888" }}>Cancel</button>
              </div>
            )}
            {deleteError && <div style={{ fontSize: 12, color: "#c0392b", marginTop: 6 }}>{deleteError}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
