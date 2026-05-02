import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { qLabel } from "../utils/stats";
import { useOrgRole } from "../hooks/useOrgRole";
import { PRESET_COLORS } from "../constants/lacrosse";
import { getGameInfo, getLatestTime, formatDate, formatDateLong, formatDateTime } from "../utils/game";
import RosterEditor from "../components/RosterEditor";
import SharePanel from "../components/SharePanel";
export { RosterEditor, SharePanel };

// ── Men's lacrosse field SVG (110yd × 60yd) ──────────────────────────────────
// Scale: 820px / 110yd = 7.45 px/yd (H), 420px / 60yd = 7.0 px/yd (V)
// Key positions (from left end line):
//   Goal line: 15yd → x=142    Restraining line: 35yd → x=291
//   Center: x=440              Mirror right: x=589 / x=738
// Wing hash marks: 10yd from each sideline at center line → y=100, y=380
const FIELD_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 880 480'>
  <!-- Field boundary -->
  <rect x='30' y='30' width='820' height='420' fill='none' stroke='rgba(255,255,255,0.22)' stroke-width='2'/>

  <!-- Center line -->
  <line x1='440' y1='30' x2='440' y2='450' stroke='rgba(255,255,255,0.22)' stroke-width='2'/>

  <!-- Restraining lines (attack/defense area, 35yd from each end) -->
  <line x1='291' y1='30' x2='291' y2='450' stroke='rgba(255,255,255,0.16)' stroke-width='1.5'/>
  <line x1='589' y1='30' x2='589' y2='450' stroke='rgba(255,255,255,0.16)' stroke-width='1.5'/>

  <!-- Goal lines (15yd from each end) -->
  <line x1='142' y1='30' x2='142' y2='450' stroke='rgba(255,255,255,0.13)' stroke-width='1.5'/>
  <line x1='738' y1='30' x2='738' y2='450' stroke='rgba(255,255,255,0.13)' stroke-width='1.5'/>

  <!-- Crease circles — full circles, 9ft radius (men's field, NOT a shooting arc) -->
  <circle cx='142' cy='240' r='32' fill='none' stroke='rgba(255,255,255,0.22)' stroke-width='2'/>
  <circle cx='738' cy='240' r='32' fill='none' stroke='rgba(255,255,255,0.22)' stroke-width='2'/>

  <!-- Face-off X at center (replaces circle) -->
  <line x1='430' y1='230' x2='450' y2='250' stroke='rgba(255,255,255,0.22)' stroke-width='2' stroke-linecap='round'/>
  <line x1='450' y1='230' x2='430' y2='250' stroke='rgba(255,255,255,0.22)' stroke-width='2' stroke-linecap='round'/>

  <!-- Wing hash marks at midfield: 10yd from each sideline, 5yd long toward center -->
  <line x1='440' y1='100' x2='440' y2='135' stroke='rgba(255,255,255,0.14)' stroke-width='2'/>
  <line x1='440' y1='380' x2='440' y2='345' stroke='rgba(255,255,255,0.14)' stroke-width='2'/>

  <!-- Goals: triangular frame viewed from above, apex points toward near end line -->
  <!-- Left goal: mouth on goal line (x=142), apex aims left toward end line -->
  <polygon points='142,233 142,247 125,240' fill='none' stroke='rgba(255,255,255,0.35)' stroke-width='2.5' stroke-linejoin='round'/>
  <!-- Right goal: mouth on goal line (x=738), apex aims right toward end line -->
  <polygon points='738,233 738,247 755,240' fill='none' stroke='rgba(255,255,255,0.35)' stroke-width='2.5' stroke-linejoin='round'/>
</svg>`;
const FIELD_BG = `url("data:image/svg+xml,${encodeURIComponent(FIELD_SVG)}")`;

function playerCount(roster) {
  if (!roster) return 0;
  return roster.split("\n").map(l => l.trim()).filter(Boolean).length;
}


// ── Game Card ─────────────────────────────────────────────────────────────────
function GameCard({ game, onDelete, deleteStage, onDeleteStage, orgMemberships = [], onMovedToOrg }) {
  const navigate = useNavigate();
  const info = getGameInfo(game);
  const c0 = info?.t0?.color || "#444";
  const c1 = info?.t1?.color || "#888";

  // Move-to-org state
  const [moveOpen, setMoveOpen]       = useState(false);
  const [moveOrgId, setMoveOrgId]     = useState(orgMemberships[0]?.org_id ?? "");
  const [seasons, setSeasons]         = useState([]);
  const [moveSeasonId, setMoveSeasonId] = useState("");
  const [moveLoading, setMoveLoading] = useState(false);
  const [moveSaving, setMoveSaving]   = useState(false);

  async function openMove() {
    setMoveOpen(true);
    const orgId = moveOrgId || orgMemberships[0]?.org_id;
    if (orgId) loadSeasons(orgId);
  }

  async function loadSeasons(orgId) {
    setMoveLoading(true);
    setMoveSeasonId("");
    const { data } = await supabase.from("seasons").select("id, name")
      .eq("org_id", orgId).order("start_date", { ascending: false });
    setSeasons(data || []);
    setMoveLoading(false);
  }

  async function handleOrgChange(orgId) {
    setMoveOrgId(orgId);
    loadSeasons(orgId);
  }

  async function handleMove() {
    if (!moveOrgId || moveSaving) return;
    setMoveSaving(true);
    const { error: err } = await supabase.from("games").update({
      org_id:    moveOrgId,
      season_id: moveSeasonId || null,
    }).eq("id", game.id);
    setMoveSaving(false);
    if (err) return;
    setMoveOpen(false);
    onMovedToOrg?.(game.id);
  }

  const isPending = !info?.started;
  const canMove   = isPending && orgMemberships.length > 0 && !game.org_id;
  const selStyle  = { padding: "5px 8px", fontSize: 13, border: "1px solid #e0e0e0", borderRadius: 7, background: "#fff", fontFamily: "system-ui, sans-serif", flex: 1 };

  return (
    <div style={{ borderRadius: 16, overflow: "hidden", marginBottom: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", border: "1px solid #e8e8e8", background: "#fff" }}>
      {/* Color bar */}
      <div style={{ height: 5, background: info ? `linear-gradient(90deg, ${c0} 50%, ${c1} 50%)` : "#e0e0e0" }} />

      {/* Main content */}
      <div style={{ padding: "14px 16px 12px" }}>
        {info ? (
          /* Game with state — show scoreboard */
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, marginBottom: 8 }}>
              {/* Team 0 */}
              <div>
                <div style={{ fontSize: 30, fontWeight: 700, color: c0, lineHeight: 1 }}>
                  {info.t0.name}
                </div>
              </div>
              {/* Score */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                <span style={{ fontSize: 30, fontWeight: 700, color: info.gameOver && info.score0 < info.score1 ? "#bbb" : c0, lineHeight: 1, minWidth: 28, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{info.score0}</span>
                <span style={{ fontSize: 18, color: "#ccc", fontWeight: 300 }}>—</span>
                <span style={{ fontSize: 30, fontWeight: 700, color: info.gameOver && info.score1 < info.score0 ? "#bbb" : c1, lineHeight: 1, minWidth: 28, textAlign: "left", fontVariantNumeric: "tabular-nums" }}>{info.score1}</span>
              </div>
              {/* Team 1 */}
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 30, fontWeight: 700, color: c1, lineHeight: 1 }}>
                  {info.t1.name}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* New / unstarted game */
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#111" }}>{game.name}</div>
          </div>
        )}

        {/* Footer row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {info?.gameOver ? (
              <span style={{ fontSize: 11, fontWeight: 600, color: "#888", background: "#f0f0f0", borderRadius: 20, padding: "3px 9px", letterSpacing: "0.04em", textTransform: "uppercase" }}>Final</span>
            ) : info?.started ? (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#2a7a3b", background: "#eaf6ec", borderRadius: 20, padding: "3px 9px", letterSpacing: "0.04em" }}>
                ● Live{info.latestTime ? ` · ${info.latestTime} ${qLabel(info.currentQuarter)}` : ""}
              </span>
            ) : (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#d4820a", background: "#fff8ec", borderRadius: 20, padding: "3px 9px", letterSpacing: "0.04em" }}>● Pending</span>
            )}
            <span style={{ fontSize: 11, color: "#bbb" }}>{formatDate(info?.gameDate || game.created_at)}</span>
          </div>
          <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
            {canMove && (
              <button style={{ padding: "7px 13px", fontSize: 13, fontWeight: 500, background: "transparent", border: "1px solid #c0d8f0", borderRadius: 8, cursor: "pointer", color: "#1a6bab" }}
                onClick={() => moveOpen ? setMoveOpen(false) : openMove()}>
                {moveOpen ? "Cancel" : "Move to org →"}
              </button>
            )}
            <button style={{ padding: "7px 13px", fontSize: 13, fontWeight: 500, background: "transparent", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", color: "#555" }}
              onClick={() => navigate(`/games/${game.id}/view`)}>View</button>
            <button style={{ padding: "7px 15px", fontSize: 13, fontWeight: 600, background: "#111", border: "none", borderRadius: 8, cursor: "pointer", color: "#fff" }}
              onClick={() => navigate(`/games/${game.id}/score`)}>{info?.started ? "Score" : "Setup"}</button>
            <button style={{ padding: "7px 9px", fontSize: 14, background: "transparent", border: "1px solid #f0a0a0", borderRadius: 8, cursor: "pointer", color: "#c0392b", lineHeight: 1 }}
              onClick={() => onDeleteStage(deleteStage === 0 ? 1 : null)}>🗑</button>
          </div>
        </div>
      </div>

      {/* Move to org panel */}
      {moveOpen && canMove && (
        <div style={{ padding: "12px 16px", background: "#f0f6ff", borderTop: "1px solid #d0e4f8" }}>
          {orgMemberships.length > 1 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Organization</div>
              <select style={{ ...selStyle, width: "100%", marginBottom: 0 }} value={moveOrgId} onChange={e => handleOrgChange(e.target.value)}>
                {orgMemberships.map(m => (
                  <option key={m.org_id} value={m.org_id}>{m.org?.name ?? m.org_id}</option>
                ))}
              </select>
            </>
          )}
          <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", margin: "10px 0 6px" }}>Season (optional)</div>
          {moveLoading ? (
            <div style={{ fontSize: 13, color: "#aaa" }}>Loading seasons…</div>
          ) : (
            <select style={{ ...selStyle, width: "100%" }} value={moveSeasonId} onChange={e => setMoveSeasonId(e.target.value)}>
              <option value="">— No season —</option>
              {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <button onClick={handleMove} disabled={!moveOrgId || moveSaving}
            style={{ marginTop: 10, padding: "8px 18px", fontSize: 13, fontWeight: 600, background: moveOrgId && !moveSaving ? "#1a6bab" : "#ccc", color: "#fff", border: "none", borderRadius: 8, cursor: moveOrgId && !moveSaving ? "pointer" : "not-allowed" }}>
            {moveSaving ? "Moving…" : "Move to org →"}
          </button>
        </div>
      )}

      {/* Delete confirm strips */}
      {deleteStage === 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: "#fff5f5", borderTop: "1px solid #fdd" }}>
          <span style={{ fontSize: 13, color: "#c0392b", fontWeight: 500 }}>Delete this game?</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ padding: "5px 12px", fontSize: 12, background: "transparent", border: "1px solid #ddd", borderRadius: 7, cursor: "pointer", color: "#555" }} onClick={() => onDeleteStage(null)}>Cancel</button>
            <button style={{ padding: "5px 12px", fontSize: 12, background: "transparent", border: "1px solid #e08080", borderRadius: 7, cursor: "pointer", color: "#c0392b", fontWeight: 600 }} onClick={() => onDeleteStage(2)}>Delete</button>
          </div>
        </div>
      )}
      {deleteStage === 2 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: "#fef0f0", borderTop: "1px solid #e8a0a0" }}>
          <span style={{ fontSize: 13, color: "#c0392b", fontWeight: 600 }}>Permanently delete? Cannot be undone.</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ padding: "5px 12px", fontSize: 12, background: "transparent", border: "1px solid #ddd", borderRadius: 7, cursor: "pointer", color: "#555" }} onClick={() => onDeleteStage(null)}>Cancel</button>
            <button style={{ padding: "5px 12px", fontSize: 12, background: "#c0392b", border: "none", borderRadius: 7, cursor: "pointer", color: "#fff", fontWeight: 600 }} onClick={onDelete}>Yes, delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Live Card (public, no edit/delete) ───────────────────────────────────────
function LiveCard({ game, isOwner, hasPressbox }) {
  const navigate = useNavigate();
  const info = getGameInfo(game);
  const c0 = info?.t0?.color || "#444";
  const c1 = info?.t1?.color || "#888";

  return (
    <div style={{ borderRadius: 16, overflow: "hidden", marginBottom: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", border: "1px solid #e8e8e8", background: "#fff" }}>
      <div style={{ height: 5, background: info ? `linear-gradient(90deg, ${c0} 50%, ${c1} 50%)` : "#e0e0e0" }} />
      <div style={{ padding: "14px 16px 12px" }}>
        {info && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 30, fontWeight: 700, color: c0, lineHeight: 1 }}>{info.t0.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
              <span style={{ fontSize: 30, fontWeight: 700, color: c0, lineHeight: 1, minWidth: 28, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{info.score0}</span>
              <span style={{ fontSize: 18, color: "#ccc", fontWeight: 300 }}>—</span>
              <span style={{ fontSize: 30, fontWeight: 700, color: c1, lineHeight: 1, minWidth: 28, textAlign: "left", fontVariantNumeric: "tabular-nums" }}>{info.score1}</span>
            </div>
            <div style={{ textAlign: "right", fontSize: 30, fontWeight: 700, color: c1, lineHeight: 1 }}>{info.t1.name}</div>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#2a7a3b", background: "#eaf6ec", borderRadius: 20, padding: "3px 9px", letterSpacing: "0.04em" }}>
            ● Live{info?.latestTime ? ` · ${info.latestTime} ${qLabel(info.currentQuarter)}` : ""}
          </span>
          <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
            <button style={{ padding: "7px 13px", fontSize: 13, fontWeight: 500, background: "transparent", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", color: "#555" }}
              onClick={() => navigate(`/games/${game.id}/view`)}>View</button>
            {hasPressbox && (
              <button style={{ padding: "7px 13px", fontSize: 13, fontWeight: 500, background: "transparent", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", color: "#555" }}
                onClick={() => window.open(`/games/${game.id}/pressbox`, "_blank")}>Press Box</button>
            )}
            {isOwner && (
              <button style={{ padding: "7px 15px", fontSize: 13, fontWeight: 600, background: "#111", border: "none", borderRadius: 8, cursor: "pointer", color: "#fff" }}
                onClick={() => navigate(`/games/${game.id}/score`)}>Score</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Live Games Section (public) ───────────────────────────────────────────────
function LiveGamesSection({ user }) {
  const [liveGames, setLiveGames] = useState([]);
  const [pressboxOrgs, setPressboxOrgs] = useState(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    load();
    const channel = supabase.channel("live-games-home")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games" }, () => load())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  async function load() {
    const { data } = await supabase
      .from("games")
      .select("id, created_at, name, state, schema_ver, user_id, org_id, pressbox_enabled")
      .not("state", "is", null)
      .order("created_at", { ascending: false });
    const games = data || [];

    // Fetch accurate goal counts from game_events for v2 games
    const v2Ids = games.filter(g => g.schema_ver === 2).map(g => g.id);
    let gamesWithScores = games;
    if (v2Ids.length > 0) {
      const { data: totals } = await supabase
        .from("v_game_team_totals")
        .select("game_id, team_idx, goals")
        .in("game_id", v2Ids);
      const scoreMap = {};
      (totals || []).forEach(r => {
        if (!scoreMap[r.game_id]) scoreMap[r.game_id] = [0, 0];
        scoreMap[r.game_id][r.team_idx] = r.goals;
      });
      gamesWithScores = games.map(g =>
        g.schema_ver === 2 && scoreMap[g.id]
          ? { ...g, state: { ...g.state, score0: scoreMap[g.id][0], score1: scoreMap[g.id][1] } }
          : g
      );
    }

    const live = gamesWithScores.filter(g => {
      const info = getGameInfo(g);
      return info?.started && !info?.gameOver;
    });
    setLiveGames(live);

    // Check pressbox access for orgs that don't already have per-game override
    const orgIds = [...new Set(live.filter(g => !g.pressbox_enabled && g.org_id).map(g => g.org_id))];
    if (orgIds.length > 0) {
      const results = await Promise.all(
        orgIds.map(id => supabase.rpc("org_feature_limit", { p_org_id: id, p_feature_id: "pressbox" }).then(({ data }) => ({ id, limit: data })))
      );
      setPressboxOrgs(new Set(results.filter(r => r.limit !== 0).map(r => r.id)));
    }

    setLoaded(true);
  }

  if (!loaded || liveGames.length === 0) return null;

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "20px 16px 4px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#2a7a3b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
        ● Live Now
      </div>
      {liveGames.map(game => (
        <LiveCard key={game.id} game={game} isOwner={user?.id === game.user_id}
          hasPressbox={game.pressbox_enabled || (game.org_id ? pressboxOrgs.has(game.org_id) : false)} />
      ))}
    </div>
  );
}

// ── Public Completed Games Section ───────────────────────────────────────────
function PublicCompletedSection() {
  const navigate = useNavigate();
  const [byDate, setByDate] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [openDates, setOpenDates] = useState({});

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase
      .from("games")
      .select("id, created_at, name, state, user_id")
      .not("state", "is", null)
      .order("created_at", { ascending: false });
    const completed = (data || []).filter(g => {
      const info = getGameInfo(g);
      return info?.gameOver;
    });
    const groups = {};
    completed.forEach(g => {
      const key = getGameInfo(g)?.gameDate || g.created_at.split("T")[0];
      if (!groups[key]) groups[key] = [];
      groups[key].push(g);
    });
    setByDate(groups);
    setLoaded(true);
  }

  if (!loaded || Object.keys(byDate).length === 0) return null;

  const dateGroups = Object.entries(byDate).sort(([a], [b]) => b.localeCompare(a));

  function toggleDate(key) {
    setOpenDates(prev => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "4px 16px 16px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
        Completed Games
      </div>
      {dateGroups.map(([dateKey, games]) => (
        <div key={dateKey} style={{ marginBottom: 4 }}>
          <button onClick={() => toggleDate(dateKey)} style={{
            width: "100%", padding: "9px 14px", display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "#f5f5f5", border: "1px solid #e8e8e8", borderRadius: 10,
            cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: openDates[dateKey] ? 8 : 0,
          }}>
            <span>{formatDateLong(dateKey)}</span>
            <span style={{ fontSize: 12, color: "#aaa", transform: openDates[dateKey] ? "rotate(90deg)" : "none", transition: "transform 0.15s", display: "inline-block" }}>›</span>
          </button>
          {openDates[dateKey] && games.map(game => {
            const info = getGameInfo(game);
            const c0 = info?.t0?.color || "#444";
            const c1 = info?.t1?.color || "#888";
            return (
              <div key={game.id} style={{ borderRadius: 16, overflow: "hidden", marginBottom: 10, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", border: "1px solid #e8e8e8", background: "#fff" }}>
                <div style={{ height: 5, background: `linear-gradient(90deg, ${c0} 50%, ${c1} 50%)` }} />
                <div style={{ padding: "14px 16px 12px" }}>
                  {info && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <div style={{ fontSize: 28, fontWeight: 700, color: c0, lineHeight: 1 }}>{info.t0.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 28, fontWeight: 700, color: info.score0 >= info.score1 ? c0 : "#bbb", fontVariantNumeric: "tabular-nums" }}>{info.score0}</span>
                        <span style={{ fontSize: 16, color: "#ccc", fontWeight: 300 }}>—</span>
                        <span style={{ fontSize: 28, fontWeight: 700, color: info.score1 >= info.score0 ? c1 : "#bbb", fontVariantNumeric: "tabular-nums" }}>{info.score1}</span>
                      </div>
                      <div style={{ textAlign: "right", fontSize: 28, fontWeight: 700, color: c1, lineHeight: 1 }}>{info.t1.name}</div>
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#888", background: "#f0f0f0", borderRadius: 20, padding: "3px 9px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Final</span>
                    <div style={{ display: "flex", gap: 7 }}>
                      <button style={{ padding: "7px 13px", fontSize: 13, fontWeight: 500, background: "transparent", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", color: "#555" }}
                        onClick={() => navigate(`/games/${game.id}/view`)}>View</button>
                      <button style={{ padding: "7px 13px", fontSize: 13, fontWeight: 500, background: "transparent", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", color: "#555" }}
                        onClick={() => window.open(`/games/${game.id}/pressbox`, "_blank")}>Press Box</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Org Games Section ─────────────────────────────────────────────────────────
function OrgGamesSection({ orgMemberships }) {
  const navigate = useNavigate();
  const [gamesByOrg, setGamesByOrg] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { if (orgMemberships?.length) load(); }, [orgMemberships]);

  async function load() {
    const orgIds = orgMemberships.map(m => m.org_id);
    const { data } = await supabase
      .from("games")
      .select("id, created_at, name, state, org_id, game_date, home_team:teams!home_team_id(id, name, color), away_team:teams!away_team_id(id, name, color)")
      .in("org_id", orgIds)
      .order("created_at", { ascending: false })
      .limit(30);

    const grouped = {};
    (data || []).forEach(g => {
      if (!grouped[g.org_id]) grouped[g.org_id] = [];
      grouped[g.org_id].push(g);
    });
    setGamesByOrg(grouped);
    setLoaded(true);
  }

  if (!orgMemberships?.length) return null;

  const roleLabel = (role) => {
    if (role === "org_admin") return "Admin";
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  return (
    <>
      {orgMemberships.length > 0 && (
        <div style={{ textAlign: "right", marginBottom: 8 }}>
          <button onClick={() => navigate("/orgs")}
            style={{ fontSize: 12, color: "#1a6bab", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            Orgs dashboard →
          </button>
        </div>
      )}
      {orgMemberships.map(m => {
        const orgGames = (gamesByOrg[m.org_id] || []).slice(0, 5);
        const orgName  = m.org?.name ?? "Org";
        const orgSlug  = m.org?.slug;

        return (
          <div key={m.org_id} style={{ marginBottom: 28 }}>
            {/* Org card */}
            <div style={{ borderRadius: 16, border: "1px solid #e0e0e0", background: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,0.06)", marginBottom: 12, overflow: "hidden" }}>
              <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#111", letterSpacing: "-0.01em", marginBottom: 3 }}>{orgName}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: m.role === "org_admin" ? "#d4820a" : "#1a6bab", background: m.role === "org_admin" ? "#fff8ec" : "#eef4fb", borderRadius: 6, padding: "2px 7px", letterSpacing: "0.05em" }}>
                      {roleLabel(m.role)}
                    </span>
                    {orgSlug && (
                      <span style={{ fontSize: 12, color: "#bbb" }}>/{orgSlug}</span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => navigate("/games/new", { state: { orgMembership: m } })}
                    style={{ padding: "8px 14px", fontSize: 13, fontWeight: 600, background: "#f5f5f5", color: "#111", border: "1px solid #e0e0e0", borderRadius: 10, cursor: "pointer" }}>
                    + New Game
                  </button>
                  {orgSlug && (
                    <button
                      onClick={() => navigate(`/orgs/${orgSlug}`)}
                      style={{ padding: "8px 16px", fontSize: 13, fontWeight: 700, background: "#111", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer" }}>
                      Open →
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Recent games for this org */}
            {loaded && (
              orgGames.length === 0 ? (
                <div style={{ fontSize: 13, color: "#aaa", padding: "4px 2px 8px" }}>No games yet — create the first one.</div>
              ) : (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Recent Games</div>
                  {orgGames.map(game => {
                    const info = getGameInfo(game);
                    const homeTeam = game.home_team;
                    const awayTeam = game.away_team;
                    const c0 = homeTeam?.color || info?.t0?.color || "#444";
                    const c1 = awayTeam?.color || info?.t1?.color || "#888";
                    const homeName = homeTeam?.name || info?.t0?.name || "Home";
                    const awayName = awayTeam?.name || info?.t1?.name || "Away";
                    const score0 = info?.score0 ?? 0;
                    const score1 = info?.score1 ?? 0;
                    const hasScore = info?.started;
                    const gameDate = game.game_date || game.created_at.split("T")[0];
                    return (
                      <div key={game.id} style={{ borderRadius: 14, overflow: "hidden", marginBottom: 8, border: "1px solid #e8e8e8", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                        <div style={{ height: 4, background: `linear-gradient(90deg, ${c0} 50%, ${c1} 50%)` }} />
                        <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {hasScore ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 15, fontWeight: 700, color: c0 }}>{homeName}</span>
                                <span style={{ fontSize: 14, fontWeight: 700, color: score0 >= score1 ? c0 : "#bbb", fontVariantNumeric: "tabular-nums" }}>{score0}</span>
                                <span style={{ fontSize: 12, color: "#ccc" }}>–</span>
                                <span style={{ fontSize: 14, fontWeight: 700, color: score1 >= score0 ? c1 : "#bbb", fontVariantNumeric: "tabular-nums" }}>{score1}</span>
                                <span style={{ fontSize: 15, fontWeight: 700, color: c1 }}>{awayName}</span>
                              </div>
                            ) : (
                              <div style={{ fontSize: 14, color: "#555" }}>{game.name}</div>
                            )}
                            <div style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>{formatDate(gameDate)}</div>
                          </div>
                          <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                            {info?.gameOver
                              ? <span style={{ fontSize: 10, fontWeight: 600, color: "#888", background: "#f0f0f0", borderRadius: 20, padding: "2px 7px", textTransform: "uppercase" }}>Final</span>
                              : info?.started
                              ? <span style={{ fontSize: 10, fontWeight: 700, color: "#2a7a3b", background: "#eaf6ec", borderRadius: 20, padding: "2px 7px" }}>● Live</span>
                              : <span style={{ fontSize: 10, fontWeight: 700, color: "#d4820a", background: "#fff8ec", borderRadius: 20, padding: "2px 7px" }}>● Pending</span>}
                            <button onClick={() => navigate(`/games/${game.id}/score`)}
                              style={{ padding: "5px 10px", fontSize: 12, fontWeight: 600, background: "#111", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer" }}>
                              {info?.started ? "Score" : "Setup"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {orgSlug && (
                    <button onClick={() => navigate(`/orgs/${orgSlug}`)}
                      style={{ fontSize: 12, color: "#1a6bab", background: "none", border: "none", cursor: "pointer", padding: "4px 2px", fontWeight: 500 }}>
                      View all games in {orgName} →
                    </button>
                  )}
                </>
              )
            )}
          </div>
        );
      })}
    </>
  );
}

// ── Games Tab ─────────────────────────────────────────────────────────────────
function GamesTab({ onNewGame, user, orgMemberships = [] }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteStages, setDeleteStages] = useState({});

  useEffect(() => { if (user) loadGames(); }, [user]);

  async function loadGames() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("games")
      .select("id, created_at, name, state, schema_ver")
      .eq("user_id", user.id)
      .is("org_id", null)
      .order("created_at", { ascending: false });
    if (err) { setError(err.message); setLoading(false); return; }
    const games = data || [];

    // Fetch accurate goal counts from game_events for v2 games
    const v2Ids = games.filter(g => g.schema_ver === 2).map(g => g.id);
    if (v2Ids.length > 0) {
      const { data: totals } = await supabase
        .from("v_game_team_totals")
        .select("game_id, team_idx, goals")
        .in("game_id", v2Ids);
      const scoreMap = {};
      (totals || []).forEach(r => {
        if (!scoreMap[r.game_id]) scoreMap[r.game_id] = [0, 0];
        scoreMap[r.game_id][r.team_idx] = r.goals;
      });
      setGames(games.map(g =>
        g.schema_ver === 2 && scoreMap[g.id]
          ? { ...g, state: { ...g.state, score0: scoreMap[g.id][0], score1: scoreMap[g.id][1] } }
          : g
      ));
    } else {
      setGames(games);
    }
    setLoading(false);
  }

  async function handleDelete(id) {
    const { error: err } = await supabase.from("games").delete().eq("id", id);
    if (err) setError(err.message);
    else setGames(prev => prev.filter(g => g.id !== id));
    setDeleteStages(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

  const liveGames    = games.filter(g => { const i = getGameInfo(g); return i?.started && !i?.gameOver; });
  const pendingGames = games.filter(g => { const i = getGameInfo(g); return !i?.started; });
  const finalGames   = games.filter(g => { const i = getGameInfo(g); return i?.gameOver; });
  const [showFinal, setShowFinal] = useState(false);

  if (loading) return <div style={{ textAlign: "center", padding: "48px 0", color: "#aaa", fontSize: 14 }}>Loading…</div>;
  if (error) return <div style={{ background: "#fff5f5", border: "1px solid #fdd", borderRadius: 10, padding: "12px 16px", color: "#c0392b", fontSize: 13, marginBottom: 16 }}>{error}</div>;

  if (games.length === 0) return (
    <div style={{ textAlign: "center", padding: "64px 20px" }}>
      <img src="/LaxStatsIcon.png" alt="LaxStats" style={{ width: 96, height: 96, marginBottom: 8, objectFit: "contain" }} />
      <div style={{ fontSize: 26, fontWeight: 800, color: "#111", letterSpacing: "-0.02em", marginBottom: 16 }}>LaxStats</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: "#111", marginBottom: 6 }}>No personal games yet</div>
      <div style={{ fontSize: 14, color: "#888", marginBottom: 24 }}>Create a game to start tracking stats.</div>
      <button style={{ padding: "12px 28px", fontSize: 15, fontWeight: 600, background: "#111", color: "#fff", border: "none", borderRadius: 12, cursor: "pointer" }}
        onClick={onNewGame}>+ New Game</button>
    </div>
  );

  function handleMovedToOrg(id) {
    setGames(prev => prev.filter(g => g.id !== id));
  }

  function card(game) {
    return (
      <GameCard key={game.id} game={game}
        deleteStage={deleteStages[game.id] ?? 0}
        onDeleteStage={(stage) => setDeleteStages(prev => stage === null ? (({ [game.id]: _, ...rest }) => rest)(prev) : { ...prev, [game.id]: stage })}
        onDelete={() => handleDelete(game.id)}
        orgMemberships={orgMemberships}
        onMovedToOrg={handleMovedToOrg}
      />
    );
  }

  return (
    <div>
      {liveGames.map(card)}
      {pendingGames.map(card)}
      {finalGames.length > 0 && (() => {
        const byDate = {};
        finalGames.forEach(g => {
          const key = getGameInfo(g)?.gameDate || g.created_at.split("T")[0];
          if (!byDate[key]) byDate[key] = [];
          byDate[key].push(g);
        });
        const dateGroups = Object.entries(byDate).sort(([a], [b]) => b.localeCompare(a));
        return (
          <>
            <button onClick={() => setShowFinal(v => !v)} style={{
              width: "100%", padding: "10px 14px", marginTop: 4, marginBottom: showFinal ? 10 : 4,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "#f5f5f5", border: "1px solid #e8e8e8", borderRadius: 10,
              cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#555",
            }}>
              <span>{finalGames.length} completed game{finalGames.length !== 1 ? "s" : ""}</span>
              <span style={{ fontSize: 12, color: "#aaa", transform: showFinal ? "rotate(90deg)" : "none", transition: "transform 0.15s", display: "inline-block" }}>›</span>
            </button>
            {showFinal && dateGroups.map(([dateKey, dateGames]) => (
              <div key={dateKey}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.07em", margin: "4px 0 8px" }}>
                  {formatDateLong(dateKey)}
                </div>
                {dateGames.map(card)}
              </div>
            ))}
          </>
        );
      })()}
    </div>
  );
}


// ── Rosters Tab ───────────────────────────────────────────────────────────────
function RostersTab({ showNewInit = false }) {
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [showNew, setShowNew] = useState(showNewInit);

  useEffect(() => { loadTeams(); }, []);

  async function loadTeams() {
    setLoading(true);
    const { data, error: err } = await supabase.from("saved_teams").select("id, name, roster, color, user_id").order("name");
    if (err) setError(err.message);
    else setTeams(data || []);
    setLoading(false);
  }

  const myTeams = teams.filter(t => t.user_id === user?.id);
  const sharedTeams = teams.filter(t => t.user_id !== user?.id);

  async function handleCreate(fields) {
    const { data, error: err } = await supabase.from("saved_teams").insert({ ...fields, user_id: user.id }).select().single();
    if (err) { setError(err.message); return; }
    setTeams(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setShowNew(false);
  }

  async function handleUpdate(id, fields) {
    const { error: err } = await supabase.from("saved_teams").update(fields).eq("id", id);
    if (err) { setError(err.message); return; }
    setTeams(prev => prev.map(t => t.id === id ? { ...t, ...fields } : t).sort((a, b) => a.name.localeCompare(b.name)));
    setExpandedId(null);
  }

  async function handleDelete(id) {
    const { error: err } = await supabase.from("saved_teams").delete().eq("id", id);
    if (err) { setError(err.message); return; }
    setTeams(prev => prev.filter(t => t.id !== id));
    setExpandedId(null);
  }

  function TeamRow({ team, isOwned }) {
    const open = expandedId === team.id;
    const count = playerCount(team.roster);
    return (
      <li style={{ border: "1px solid #e8e8e8", borderRadius: 14, marginBottom: 10, overflow: "hidden", background: "#fff", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer" }}
          onClick={() => setExpandedId(open ? null : team.id)}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: team.color, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: "#111" }}>{team.name}</span>
              {!isOwned && <span style={{ fontSize: 10, fontWeight: 700, color: "#1a6bab", background: "#eef4fb", borderRadius: 6, padding: "2px 6px", letterSpacing: "0.05em" }}>Shared</span>}
            </div>
            <div style={{ fontSize: 12, color: "#aaa", marginTop: 1 }}>{count} player{count !== 1 ? "s" : ""}</div>
          </div>
          <div style={{ fontSize: 14, color: "#ccc", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>›</div>
        </div>
        {open && (
          <div style={{ padding: "0 16px 16px", borderTop: "1px solid #f0f0f0" }}>
            {isOwned ? (
              <>
                <RosterEditor initial={team}
                  onSave={(fields) => handleUpdate(team.id, fields)}
                  onDelete={() => handleDelete(team.id)} />
                <SharePanel rosterId={team.id} />
              </>
            ) : (
              <div style={{ padding: "12px 0" }}>
                <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8 }}>Shared with you — view only</div>
                <div style={{ fontFamily: "monospace", fontSize: 12, color: "#555", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{team.roster}</div>
              </div>
            )}
          </div>
        )}
      </li>
    );
  }

  if (loading) return <div style={{ textAlign: "center", padding: "48px 0", color: "#aaa", fontSize: 14 }}>Loading…</div>;

  return (
    <div>
      {!showNew && myTeams.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button onClick={() => setShowNew(true)}
            style={{ padding: "7px 16px", fontSize: 13, fontWeight: 600, background: "#111", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer" }}>
            + New Team
          </button>
        </div>
      )}

      {error && <div style={{ background: "#fff5f5", border: "1px solid #fdd", borderRadius: 10, padding: "12px 16px", color: "#c0392b", fontSize: 13, marginBottom: 16 }}>{error}</div>}

      {showNew && (
        <div style={{ border: "1px solid #e0e0e0", borderRadius: 16, padding: 18, marginBottom: 12, background: "#fafafa" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>New Team</div>
          <RosterEditor isNew onSave={handleCreate} onCancel={() => setShowNew(false)} />
        </div>
      )}

      {myTeams.length === 0 && !showNew && sharedTeams.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 20px" }}>
          <div style={{ fontSize: 14, color: "#888", marginBottom: 20 }}>No saved teams yet.</div>
          <button style={{ padding: "11px 24px", fontSize: 14, fontWeight: 600, background: "#111", color: "#fff", border: "none", borderRadius: 12, cursor: "pointer" }}
            onClick={() => setShowNew(true)}>+ New Team</button>
        </div>
      ) : (
        <>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {myTeams.map(team => <TeamRow key={team.id} team={team} isOwned />)}
          </ul>

          {sharedTeams.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.07em", margin: "18px 0 10px" }}>Shared with me</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {sharedTeams.map(team => <TeamRow key={team.id} team={team} isOwned={false} />)}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function GameList() {
  const navigate = useNavigate();
  const { user, isAdmin, orgMemberships, loading: authLoading } = useAuth();
  const [tab, setTab] = useState("games");

  function handleNewGame() {
    navigate("/games/new");
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/");
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", minHeight: "100%", background: "#f5f5f5" }}>

      {/* ── Hero ── */}
      <div style={{
        background: "#0f1117",
        backgroundImage: FIELD_BG,
        backgroundSize: "cover",
        backgroundPosition: "center",
        padding: "16px 24px 20px",
        position: "sticky",
        top: 0,
        zIndex: 10,
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 0%, transparent 40%, rgba(0,0,0,0.6) 100%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", maxWidth: 560, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
              <img src="/LaxStatsIcon.png" alt="LaxStats" style={{ width: 96, height: 96, objectFit: "contain" }} />
              <span style={{ fontSize: 36, fontWeight: 800, color: import.meta.env.VITE_IS_STAGING === "true" ? "#e53935" : "#fff", letterSpacing: "-0.02em", lineHeight: 1 }}>LaxStats</span>
              {import.meta.env.VITE_IS_STAGING === "true" && (
                <span style={{ fontSize: 11, fontWeight: 700, color: "#e53935", letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.85 }}>v2.0.0 staging</span>
              )}
            </div>
            {!authLoading && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                {user ? (
                  <>
                    {isAdmin && (
                      <button onClick={() => navigate("/admin")} style={{
                        padding: "4px 10px", fontSize: 11, fontWeight: 700,
                        color: "#d4820a", background: "rgba(212,130,10,0.15)",
                        border: "1px solid rgba(212,130,10,0.3)", borderRadius: 6, cursor: "pointer",
                        letterSpacing: "0.06em", textTransform: "uppercase",
                      }}>Admin →</button>
                    )}
                    <button onClick={handleSignOut} style={{
                      padding: "5px 12px", fontSize: 12, fontWeight: 500,
                      background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)",
                      border: "1px solid rgba(255,255,255,0.18)", borderRadius: 8, cursor: "pointer",
                    }}>Sign out</button>
                  </>
                ) : (
                  <button onClick={() => navigate("/login")} style={{
                    padding: "7px 16px", fontSize: 13, fontWeight: 600,
                    background: "#fff", color: "#111",
                    border: "none", borderRadius: 10, cursor: "pointer",
                  }}>Sign in →</button>
                )}
              </div>
            )}
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 28 }}>
            Stat Tracker
          </div>
          {user && (
            <button onClick={handleNewGame} style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "11px 22px", fontSize: 14, fontWeight: 700,
              background: "#fff", color: "#111",
              border: "none", borderRadius: 12, cursor: "pointer",
            }}>
              ＋ New Game
            </button>
          )}
        </div>
      </div>

      {/* ── Live Games (all users, public) ── */}
      <LiveGamesSection user={user} />

      {/* ── Completed games (public, unauth only — auth users see theirs in My Games) ── */}
      {!authLoading && !user && <PublicCompletedSection />}

      {/* ── My Games + Rosters tabs (authenticated only) ── */}
      {user && (
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 16px" }}>
          <div style={{ display: "flex", gap: 4, padding: "12px 0 0", marginBottom: 16, borderBottom: "1px solid #e8e8e8" }}>
            {[
              ["games", "My Games"],
              ...(orgMemberships?.length ? [["orgs", "Orgs"]] : []),
              ["rosters", "Rosters"],
            ].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} style={{
                padding: "8px 18px", fontSize: 14, fontWeight: tab === id ? 700 : 500,
                border: "none", background: "transparent", cursor: "pointer",
                color: tab === id ? "#111" : "#aaa",
                borderBottom: tab === id ? "2px solid #111" : "2px solid transparent",
                marginBottom: -1,
              }}>{label}</button>
            ))}
          </div>

          {tab === "games" && <GamesTab onNewGame={handleNewGame} user={user} orgMemberships={orgMemberships} />}
          {tab === "orgs" && <OrgGamesSection orgMemberships={orgMemberships} />}
          {tab === "rosters" && <RostersTab />}
        </div>
      )}
    </div>
  );
}
