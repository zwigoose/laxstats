import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { qLabel } from "../utils/stats";
import { getGameInfo, formatDate } from "../utils/game";
import RosterEditor from "../components/RosterEditor";
import SharePanel from "../components/SharePanel";
import { setGameVisibility } from "../services/games";
import { usePersonalGameUsage } from "../hooks/usePersonalGameUsage";
import { Helmet } from "react-helmet-async";
import SeoMeta from "../hooks/useSeoMeta";
import { C, F, SH } from "../styles/tokens";
export { RosterEditor, SharePanel, SavedTeamLogoSection, GameCard, LiveCard, PersonalUsageMeter, OwnedGame, PublicResultCard };

const IS_STAGING = (import.meta.env ?? {}).VITE_IS_STAGING === "true";

const HOME_JSON_LD = JSON.stringify([
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "LaxStats",
    "url": "https://laxstats.app",
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "LaxStats",
    "operatingSystem": "Web, iOS, Android",
    "applicationCategory": "SportsApplication",
    "description": "Digital scorebook and live stats platform for men's lacrosse.",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    "url": "https://laxstats.app",
  },
]);

// The mid stop matches the hero logo's background so the lockup blends in.
const HERO_NAVY = "radial-gradient(125% 150% at 12% 0%, #0d2c52 0%, #02112a 58%, #010a1c 100%)";
const PAGE_BG = "#f6f7f9";
const INNER = { maxWidth: 1160, margin: "0 auto", padding: "0 32px" };

function playerCount(roster) {
  if (!roster) return 0;
  return roster.split("\n").map(l => l.trim()).filter(Boolean).length;
}

function useIsNarrow(bp = 980) {
  const [narrow, setNarrow] = useState(() => window.matchMedia(`(max-width: ${bp}px)`).matches);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${bp}px)`);
    const onChange = e => setNarrow(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [bp]);
  return narrow;
}

// ── Section labels ────────────────────────────────────────────────────────────
function SectionLabel({ text, count }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 12px" }}>
      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: C.gray500 }}>{text}</span>
      {count != null && (
        <span style={{ fontSize: 11, fontWeight: 700, color: C.gray350, background: "#f0f1f3", borderRadius: 20, padding: "2px 8px", letterSpacing: "0.02em" }}>{count}</span>
      )}
    </div>
  );
}

function LiveLabel() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 12px" }}>
      <span style={{ width: 8, height: 8, borderRadius: 8, background: "#22a447", boxShadow: "0 0 0 4px rgba(34,164,71,.16)" }} />
      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: C.green600 }}>Live now</span>
    </div>
  );
}

// ── Game Card ─────────────────────────────────────────────────────────────────
function GameCard({ game, onDelete, deleteStage, onDeleteStage, orgMemberships = [], onMovedToOrg }) {
  const navigate = useNavigate();
  const info = getGameInfo(game);
  const c0 = info?.t0?.color || C.gray700;
  const c1 = info?.t1?.color || C.gray500;

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
  const selStyle  = { padding: "5px 8px", fontSize: 13, border: `1px solid ${C.gray200}`, borderRadius: 7, background: C.white, fontFamily: F.ui, flex: 1 };

  return (
    <div style={{ borderRadius: 16, overflow: "hidden", marginBottom: 12, boxShadow: SH.card, border: `1px solid ${C.gray100}`, background: C.white }}>
      {/* Color bar */}
      <div style={{ height: 5, background: info ? `linear-gradient(90deg, ${c0} 50%, ${c1} 50%)` : C.gray200 }} />

      {/* Main content */}
      <div style={{ padding: "14px 16px 12px" }}>
        {info ? (
          /* Game with state — show scoreboard */
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, marginBottom: 8 }}>
              {/* Team 0 */}
              <div>
                {info.t0?.logoUrl && <img src={info.t0.logoUrl} alt="" style={{ height: 40, maxWidth: 80, objectFit: "contain", display: "block", marginBottom: 6 }} />}
                <div style={{ fontSize: 30, fontWeight: 700, color: c0, lineHeight: 1 }}>
                  {info.t0.name}
                </div>
              </div>
              {/* Score */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                <span style={{ fontSize: 30, fontWeight: 700, color: info.gameOver && info.score0 < info.score1 ? C.gray350 : c0, lineHeight: 1, minWidth: 28, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{info.score0}</span>
                <span style={{ fontSize: 18, color: C.gray300, fontWeight: 300 }}>—</span>
                <span style={{ fontSize: 30, fontWeight: 700, color: info.gameOver && info.score1 < info.score0 ? C.gray350 : c1, lineHeight: 1, minWidth: 28, textAlign: "left", fontVariantNumeric: "tabular-nums" }}>{info.score1}</span>
              </div>
              {/* Team 1 */}
              <div style={{ textAlign: "right" }}>
                {info.t1?.logoUrl && <img src={info.t1.logoUrl} alt="" style={{ height: 40, maxWidth: 80, objectFit: "contain", display: "block", marginLeft: "auto", marginBottom: 6 }} />}
                <div style={{ fontSize: 30, fontWeight: 700, color: c1, lineHeight: 1 }}>
                  {info.t1.name}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* New / unstarted game */
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.gray900 }}>{game.name}</div>
          </div>
        )}

        {/* Footer row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {info?.gameOver ? (
              <span style={{ fontSize: 11, fontWeight: 600, color: C.gray500, background: C.gray75, borderRadius: 20, padding: "3px 9px", letterSpacing: "0.04em", textTransform: "uppercase" }}>Final</span>
            ) : info?.started ? (
              <span style={{ fontSize: 11, fontWeight: 700, color: C.green600, background: C.green50, borderRadius: 20, padding: "3px 9px", letterSpacing: "0.04em" }}>
                ● Live{info.latestTime ? ` · ${info.latestTime} ${qLabel(info.currentQuarter)}` : ""}
              </span>
            ) : (
              <span style={{ fontSize: 11, fontWeight: 700, color: C.orange600, background: C.orange50, borderRadius: 20, padding: "3px 9px", letterSpacing: "0.04em" }}>● Pending</span>
            )}
            <span style={{ fontSize: 11, color: C.gray350 }}>{formatDate(info?.gameDate || game.created_at)}</span>
          </div>
          <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
            {canMove && (
              <button style={{ padding: "7px 13px", fontSize: 13, fontWeight: 500, background: "transparent", border: `1px solid ${C.blue200}`, borderRadius: 8, cursor: "pointer", color: C.blue600 }}
                onClick={() => moveOpen ? setMoveOpen(false) : openMove()}>
                {moveOpen ? "Cancel" : "Move to org →"}
              </button>
            )}
            <Link to={`/games/${game.id}/view`} style={{ padding: "7px 13px", fontSize: 13, fontWeight: 500, background: "transparent", border: `1px solid ${C.gray250}`, borderRadius: 8, cursor: "pointer", color: C.gray650, textDecoration: "none" }}>View</Link>
            {!info?.gameOver && (
              <button style={{ padding: "7px 15px", fontSize: 13, fontWeight: 600, background: C.gray900, border: "none", borderRadius: 8, cursor: "pointer", color: C.white }}
                onClick={() => navigate(`/games/${game.id}/score`)}>{info?.started ? "Score" : "Setup"}</button>
            )}
            <button style={{ padding: "7px 9px", fontSize: 14, background: "transparent", border: `1px solid ${C.red300}`, borderRadius: 8, cursor: "pointer", color: C.red600, lineHeight: 1 }}
              onClick={() => onDeleteStage(deleteStage === 0 ? 1 : null)}>🗑</button>
          </div>
        </div>
      </div>

      {/* Move to org panel */}
      {moveOpen && canMove && (
        <div style={{ padding: "12px 16px", background: C.blue40, borderTop: `1px solid ${C.blue150}` }}>
          {orgMemberships.length > 1 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.gray500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Organization</div>
              <select style={{ ...selStyle, width: "100%", marginBottom: 0 }} value={moveOrgId} onChange={e => handleOrgChange(e.target.value)}>
                {orgMemberships.map(m => (
                  <option key={m.org_id} value={m.org_id}>{m.org?.name ?? m.org_id}</option>
                ))}
              </select>
            </>
          )}
          <div style={{ fontSize: 11, fontWeight: 700, color: C.gray500, textTransform: "uppercase", letterSpacing: "0.06em", margin: "10px 0 6px" }}>Season (optional)</div>
          {moveLoading ? (
            <div style={{ fontSize: 13, color: C.gray400 }}>Loading seasons…</div>
          ) : (
            <select style={{ ...selStyle, width: "100%" }} value={moveSeasonId} onChange={e => setMoveSeasonId(e.target.value)}>
              <option value="">— No season —</option>
              {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <button onClick={handleMove} disabled={!moveOrgId || moveSaving}
            style={{ marginTop: 10, padding: "8px 18px", fontSize: 13, fontWeight: 600, background: moveOrgId && !moveSaving ? C.blue600 : C.gray300, color: C.white, border: "none", borderRadius: 8, cursor: moveOrgId && !moveSaving ? "pointer" : "not-allowed" }}>
            {moveSaving ? "Moving…" : "Move to org →"}
          </button>
        </div>
      )}

      {/* Delete confirm strips */}
      {deleteStage === 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: C.red50, borderTop: `1px solid ${C.red100}` }}>
          <span style={{ fontSize: 13, color: C.red600, fontWeight: 500 }}>Delete this game?</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ padding: "5px 12px", fontSize: 12, background: "transparent", border: `1px solid ${C.gray250}`, borderRadius: 7, cursor: "pointer", color: C.gray650 }} onClick={() => onDeleteStage(null)}>Cancel</button>
            <button style={{ padding: "5px 12px", fontSize: 12, background: "transparent", border: `1px solid ${C.red400}`, borderRadius: 7, cursor: "pointer", color: C.red600, fontWeight: 600 }} onClick={() => onDeleteStage(2)}>Delete</button>
          </div>
        </div>
      )}
      {deleteStage === 2 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: C.red60, borderTop: `1px solid ${C.red310}` }}>
          <span style={{ fontSize: 13, color: C.red600, fontWeight: 600 }}>Permanently delete? Cannot be undone.</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ padding: "5px 12px", fontSize: 12, background: "transparent", border: `1px solid ${C.gray250}`, borderRadius: 7, cursor: "pointer", color: C.gray650 }} onClick={() => onDeleteStage(null)}>Cancel</button>
            <button style={{ padding: "5px 12px", fontSize: 12, background: C.red600, border: "none", borderRadius: 7, cursor: "pointer", color: C.white, fontWeight: 600 }} onClick={onDelete}>Yes, delete</button>
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
  const c0 = info?.t0?.color || C.gray700;
  const c1 = info?.t1?.color || C.gray500;

  return (
    <div style={{ borderRadius: 16, overflow: "hidden", marginBottom: 12, boxShadow: SH.card, border: `1px solid ${C.gray100}`, background: C.white }}>
      <div style={{ height: 5, background: info ? `linear-gradient(90deg, ${c0} 50%, ${c1} 50%)` : C.gray200 }} />
      <div style={{ padding: "14px 16px 12px" }}>
        {info && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div>
              {info.t0?.logoUrl && <img src={info.t0.logoUrl} alt="" style={{ height: 40, maxWidth: 80, objectFit: "contain", display: "block", marginBottom: 6 }} />}
              <div style={{ fontSize: 30, fontWeight: 700, color: c0, lineHeight: 1 }}>{info.t0.name}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
              <span style={{ fontSize: 30, fontWeight: 700, color: c0, lineHeight: 1, minWidth: 28, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{info.score0}</span>
              <span style={{ fontSize: 18, color: C.gray300, fontWeight: 300 }}>—</span>
              <span style={{ fontSize: 30, fontWeight: 700, color: c1, lineHeight: 1, minWidth: 28, textAlign: "left", fontVariantNumeric: "tabular-nums" }}>{info.score1}</span>
            </div>
            <div style={{ textAlign: "right" }}>
              {info.t1?.logoUrl && <img src={info.t1.logoUrl} alt="" style={{ height: 40, maxWidth: 80, objectFit: "contain", display: "block", marginLeft: "auto", marginBottom: 6 }} />}
              <div style={{ fontSize: 30, fontWeight: 700, color: c1, lineHeight: 1 }}>{info.t1.name}</div>
            </div>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.green600, background: C.green50, borderRadius: 20, padding: "3px 9px", letterSpacing: "0.04em" }}>
            ● Live{info?.latestTime ? ` · ${info.latestTime} ${qLabel(info.currentQuarter)}` : ""}
          </span>
          <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
            <Link to={`/games/${game.id}/view`} style={{ padding: "7px 13px", fontSize: 13, fontWeight: 500, background: "transparent", border: `1px solid ${C.gray250}`, borderRadius: 8, cursor: "pointer", color: C.gray650, textDecoration: "none" }}>View</Link>
            {hasPressbox && (
              <button style={{ padding: "7px 13px", fontSize: 13, fontWeight: 500, background: "transparent", border: `1px solid ${C.gray250}`, borderRadius: 8, cursor: "pointer", color: C.gray650 }}
                onClick={() => window.open(`/games/${game.id}/pressbox`, "_blank")}>Press Box</button>
            )}
            {isOwner && (
              <button style={{ padding: "7px 15px", fontSize: 13, fontWeight: 600, background: C.gray900, border: "none", borderRadius: 8, cursor: "pointer", color: C.white }}
                onClick={() => navigate(`/games/${game.id}/score`)}>Score</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Public Result Card ────────────────────────────────────────────────────────
// Read-only final/live score card for logged-out visitors. Mirrors GameCard's
// final layout without the owner actions (GameCard always renders delete/score,
// LiveCard always says "Live" — neither fits a read-only completed game).
function PublicResultCard({ game, live = false, sample = false }) {
  const info = getGameInfo(game);
  if (!info) return null;
  const c0 = info.t0?.color || C.gray700;
  const c1 = info.t1?.color || C.gray500;
  const btnStyle = { padding: "7px 13px", fontSize: 13, fontWeight: 500, background: "transparent", border: `1px solid ${C.gray250}`, borderRadius: 8, color: C.gray650, textDecoration: "none" };

  return (
    <div style={{ borderRadius: 16, overflow: "hidden", boxShadow: SH.card, border: `1px solid ${C.gray100}`, background: C.white }}>
      <div style={{ height: 5, background: `linear-gradient(90deg, ${c0} 50%, ${c1} 50%)` }} />
      <div style={{ padding: "14px 16px 12px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: c0, lineHeight: 1 }}>{info.t0.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: !live && info.score0 < info.score1 ? C.gray350 : c0, lineHeight: 1, minWidth: 28, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{info.score0}</span>
            <span style={{ fontSize: 18, color: C.gray300, fontWeight: 300 }}>—</span>
            <span style={{ fontSize: 30, fontWeight: 700, color: !live && info.score1 < info.score0 ? C.gray350 : c1, lineHeight: 1, minWidth: 28, textAlign: "left", fontVariantNumeric: "tabular-nums" }}>{info.score1}</span>
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, color: c1, lineHeight: 1, textAlign: "right" }}>{info.t1.name}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {live ? (
              <span style={{ fontSize: 11, fontWeight: 700, color: C.green600, background: C.green50, borderRadius: 20, padding: "3px 9px", letterSpacing: "0.04em" }}>● Live</span>
            ) : (
              <span style={{ fontSize: 11, fontWeight: 600, color: C.gray500, background: C.gray75, borderRadius: 20, padding: "3px 9px", letterSpacing: "0.04em", textTransform: "uppercase" }}>Final</span>
            )}
            <span style={{ fontSize: 11, color: C.gray350 }}>{formatDate(info.gameDate)}</span>
          </div>
          {sample ? (
            <span style={{ ...btnStyle, cursor: "default" }}>View</span>
          ) : (
            <Link to={`/games/${game.id}/view`} style={btnStyle}>{live ? "Watch live" : "View"}</Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Owned Game (GameCard + visibility control strip) ──────────────────────────
function VisibilityToggle({ on, onToggle }) {
  return (
    <button onClick={onToggle} aria-pressed={on} title={on ? "Make private" : "Make public"}
      style={{ width: 38, height: 22, borderRadius: 22, border: "none", cursor: "pointer", padding: 0,
        background: on ? "#22a447" : "#cbd0d6", position: "relative", transition: "background .15s", flex: "0 0 auto" }}>
      <span style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: 18, background: C.white, boxShadow: "0 1px 2px rgba(0,0,0,.25)", transition: "left .15s" }} />
    </button>
  );
}

function OwnedGame({ game, onToggleVisibility, ...gameCardProps }) {
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const pub = !!game.is_public;
  const shareUrl = `${window.location.origin}/games/${game.id}/view`;

  function copyLink() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  return (
    <div style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 14, overflow: "hidden", boxShadow: SH.card }}>
      {/* GameCard carries a 12px bottom margin; pull the strip back up so the
          gap matches the 4px frame padding */}
      <div style={{ padding: 4, marginBottom: -8 }}>
        <GameCard game={game} {...gameCardProps} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 16px", borderTop: "1px solid #eceef1", background: "#fbfbfc" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <VisibilityToggle on={pub} onToggle={() => onToggleVisibility(game.id, !pub)} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.gray900, lineHeight: 1.2 }}>{pub ? "Public" : "Private"}</div>
            <div style={{ fontSize: 12, color: C.gray350, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {pub ? "Anyone with the link can follow" : "Only you can see this"}
            </div>
          </div>
        </div>
        <button onClick={() => setShareOpen(v => !v)}
          style={{ fontSize: 13, fontWeight: 600, color: C.blue600, background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap", fontFamily: F.ui }}>
          Share settings {shareOpen ? "˅" : ">"}
        </button>
      </div>
      {shareOpen && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderTop: "1px solid #eceef1", background: "#fbfbfc" }}>
          <span style={{ fontSize: 12, color: C.gray500, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {pub ? shareUrl : "Make the game public to share this link."}
          </span>
          {pub && (
            <button onClick={copyLink} style={{ fontSize: 12, fontWeight: 500, color: copied ? C.green600 : C.gray650, background: copied ? C.green60 : C.gray50, border: `1px solid ${copied ? C.green100 : C.gray200}`, borderRadius: 20, padding: "4px 10px", cursor: "pointer", whiteSpace: "nowrap", fontFamily: F.ui }}>
              {copied ? "✓ Copied" : "Copy link"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Personal Usage Meter ──────────────────────────────────────────────────────
function PersonalUsageMeter({ usage }) {
  if (!usage) return null;
  const unlimited = usage.game_limit === null;
  const pct = unlimited ? 0 : Math.min(100, Math.round((usage.current_count / usage.game_limit) * 100));
  const atLimit = usage.at_limit;
  return (
    <div style={{
      background: atLimit ? C.red50 : C.gray40,
      border: `1px solid ${atLimit ? C.red100 : C.gray100}`,
      borderRadius: 12, padding: "12px 14px", marginBottom: 14,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: unlimited ? 0 : 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: atLimit ? C.red600 : C.gray650 }}>
          {atLimit ? "Personal game limit reached" : "Personal games"}
        </span>
        <span style={{ fontSize: 12, color: C.gray500, fontVariantNumeric: "tabular-nums" }}>
          {unlimited ? `${usage.current_count} / ∞` : `${usage.current_count} / ${usage.game_limit}`}
        </span>
      </div>
      {!unlimited && (
        <div style={{ height: 5, background: C.gray200, borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: atLimit ? C.red600 : C.blue600, borderRadius: 99, transition: "width 0.3s" }} />
        </div>
      )}
      {atLimit && (
        <div style={{ fontSize: 11, color: C.red600, marginTop: 6 }}>
          Upgrade your plan to create more personal games.
        </div>
      )}
    </div>
  );
}

// ── Right rail: plan + organizations ──────────────────────────────────────────
function UsageCard({ usage }) {
  const navigate = useNavigate();
  const btn = { padding: "7px 13px", fontSize: 13, fontWeight: 600, background: C.white, color: C.gray900, border: `1px solid ${C.gray200}`, borderRadius: 9, cursor: "pointer", fontFamily: F.ui };
  return (
    <div>
      <SectionLabel text="Your plan" />
      <PersonalUsageMeter usage={usage} />
      <div style={{ display: "flex", gap: 8 }}>
        <button style={btn} onClick={() => navigate("/profile")}>Manage plan</button>
        {usage?.game_limit != null && (
          <button style={btn} onClick={() => navigate("/pricing")}>Upgrade</button>
        )}
      </div>
    </div>
  );
}

function OrgRail({ orgMemberships }) {
  const navigate = useNavigate();
  if (!orgMemberships?.length) return null;

  const roleLabel = (role) => role === "org_admin" ? "Admin" : role.charAt(0).toUpperCase() + role.slice(1);

  return (
    <div>
      <SectionLabel text="Your organizations" count={orgMemberships.length} />
      <div style={{ display: "grid", gap: 12 }}>
        {orgMemberships.map(m => {
          const orgName = m.org?.name ?? "Org";
          const orgSlug = m.org?.slug;
          return (
            <div key={m.org_id} style={{ borderRadius: 16, border: `1px solid ${C.gray200}`, background: C.white, boxShadow: SH.card2, overflow: "hidden" }}>
              <div style={{ padding: "14px 16px" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.gray900, letterSpacing: "-0.01em", marginBottom: 3 }}>{orgName}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: m.role === "org_admin" ? C.orange600 : C.blue600, background: m.role === "org_admin" ? C.orange50 : C.blue50, borderRadius: 6, padding: "2px 7px", letterSpacing: "0.05em" }}>
                    {roleLabel(m.role)}
                  </span>
                  {orgSlug && <span style={{ fontSize: 12, color: C.gray350 }}>/{orgSlug}</span>}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => navigate("/games/new", { state: { orgMembership: m } })}
                    style={{ padding: "7px 12px", fontSize: 12, fontWeight: 600, background: C.gray50, color: C.gray900, border: `1px solid ${C.gray200}`, borderRadius: 9, cursor: "pointer", fontFamily: F.ui }}>
                    + New Game
                  </button>
                  {orgSlug && (
                    <button
                      onClick={() => navigate(`/orgs/${orgSlug}`)}
                      style={{ padding: "7px 14px", fontSize: 12, fontWeight: 700, background: C.gray900, color: C.white, border: "none", borderRadius: 9, cursor: "pointer", fontFamily: F.ui }}>
                      Open →
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Saved team logo upload ────────────────────────────────────────────────────
function SavedTeamLogoSection({ teamId, initialLogoUrl, onSaved }) {
  const [logoUrl, setLogoUrl]     = useState(initialLogoUrl || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState(null);
  const inputRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError("Image must be under 2 MB."); return; }
    setUploading(true);
    setError(null);
    const path = `saved/${teamId}/logo`;
    const { error: uploadErr } = await supabase.storage
      .from("game-logos")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadErr) { setError(uploadErr.message); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("game-logos").getPublicUrl(path);
    const { error: dbErr } = await supabase.from("saved_teams").update({ logo_url: publicUrl }).eq("id", teamId);
    if (dbErr) { setError(dbErr.message); setUploading(false); return; }
    setLogoUrl(publicUrl);
    onSaved?.(publicUrl);
    setUploading(false);
  }

  async function handleRemove() {
    setUploading(true);
    await supabase.storage.from("game-logos").remove([`saved/${teamId}/logo`]);
    await supabase.from("saved_teams").update({ logo_url: null }).eq("id", teamId);
    setLogoUrl(null);
    onSaved?.(null);
    setUploading(false);
  }

  const btnBase = { padding: "4px 10px", fontSize: 11, background: "transparent", border: `1px solid ${C.gray250}`, borderRadius: 7, cursor: "pointer", color: C.gray650 };

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: C.gray40, borderRadius: 10, border: `1px solid ${C.gray100}` }}>
        {logoUrl ? (
          <img src={logoUrl} alt="Team logo" style={{ width: 32, height: 32, objectFit: "contain", borderRadius: 4, border: `1px solid ${C.gray200}`, background: C.white }} />
        ) : (
          <div style={{ width: 32, height: 32, borderRadius: 4, border: `1px dashed ${C.gray300}`, background: C.gray75, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: C.gray350 }}>🏑</div>
        )}
        <span style={{ fontSize: 12, color: C.gray650, flex: 1 }}>
          Team logo {uploading && <span style={{ color: C.gray400 }}>· uploading…</span>}
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => inputRef.current?.click()} disabled={uploading} style={btnBase}>
            {logoUrl ? "Replace" : "Upload"}
          </button>
          {logoUrl && (
            <button onClick={handleRemove} disabled={uploading} style={{ ...btnBase, color: C.red600, borderColor: C.red200 }}>
              Remove
            </button>
          )}
        </div>
      </div>
      {error && <div style={{ fontSize: 11, color: C.red600, marginTop: 4 }}>{error}</div>}
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
        style={{ display: "none" }} onChange={handleFile} />
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
    const { data, error: err } = await supabase.from("saved_teams").select("id, name, roster, color, user_id, logo_url").order("name");
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
      <li style={{ border: `1px solid ${C.gray100}`, borderRadius: 14, marginBottom: 10, overflow: "hidden", background: C.white, boxShadow: SH.subtle }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer" }}
          onClick={() => setExpandedId(open ? null : team.id)}>
          {team.logo_url
            ? <img src={team.logo_url} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
            : <div style={{ width: 32, height: 32, borderRadius: "50%", background: team.color, flexShrink: 0 }} />
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: C.gray900 }}>{team.name}</span>
              {!isOwned && <span style={{ fontSize: 10, fontWeight: 700, color: C.blue600, background: C.blue50, borderRadius: 6, padding: "2px 6px", letterSpacing: "0.05em" }}>Shared</span>}
            </div>
            <div style={{ fontSize: 12, color: C.gray400, marginTop: 1 }}>{count} player{count !== 1 ? "s" : ""}</div>
          </div>
          <div style={{ fontSize: 14, color: C.gray300, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>›</div>
        </div>
        {open && (
          <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${C.gray75}` }}>
            {isOwned ? (
              <>
                <RosterEditor initial={team}
                  onSave={(fields) => handleUpdate(team.id, fields)}
                  onDelete={() => handleDelete(team.id)} />
                <SavedTeamLogoSection
                  teamId={team.id}
                  initialLogoUrl={team.logo_url}
                  onSaved={url => setTeams(prev => prev.map(t => t.id === team.id ? { ...t, logo_url: url } : t))}
                />
                <SharePanel rosterId={team.id} />
              </>
            ) : (
              <div style={{ padding: "12px 0" }}>
                <div style={{ fontSize: 12, color: C.gray400, marginBottom: 8 }}>Shared with you — view only</div>
                <div style={{ fontFamily: F.mono, fontSize: 12, color: C.gray650, whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{team.roster}</div>
              </div>
            )}
          </div>
        )}
      </li>
    );
  }

  if (loading) return <div style={{ textAlign: "center", padding: "48px 0", color: C.gray400, fontSize: 14 }}>Loading…</div>;

  return (
    <div>
      {!showNew && myTeams.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button onClick={() => setShowNew(true)}
            style={{ padding: "7px 16px", fontSize: 13, fontWeight: 600, background: C.gray900, color: C.white, border: "none", borderRadius: 9, cursor: "pointer" }}>
            + New Team
          </button>
        </div>
      )}

      {error && <div style={{ background: C.red50, border: `1px solid ${C.red100}`, borderRadius: 10, padding: "12px 16px", color: C.red600, fontSize: 13, marginBottom: 16 }}>{error}</div>}

      {showNew && (
        <div style={{ border: `1px solid ${C.gray200}`, borderRadius: 16, padding: 18, marginBottom: 12, background: C.gray25 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.gray500, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>New Team</div>
          <RosterEditor isNew onSave={handleCreate} onCancel={() => setShowNew(false)} />
        </div>
      )}

      {myTeams.length === 0 && !showNew && sharedTeams.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 20px" }}>
          <div style={{ fontSize: 14, color: C.gray500, marginBottom: 20 }}>No saved teams yet.</div>
          <button style={{ padding: "11px 24px", fontSize: 14, fontWeight: 600, background: C.gray900, color: C.white, border: "none", borderRadius: 12, cursor: "pointer" }}
            onClick={() => setShowNew(true)}>+ New Team</button>
        </div>
      ) : (
        <>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {myTeams.map(team => <TeamRow key={team.id} team={team} isOwned />)}
          </ul>

          {sharedTeams.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.gray400, textTransform: "uppercase", letterSpacing: "0.07em", margin: "18px 0 10px" }}>Shared with me</div>
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

// ── Signed-in home ────────────────────────────────────────────────────────────
function WelcomeBand({ user, onNewGame, newGameBlocked, view, onToggleRosters, isNarrow }) {
  const btnLight = { fontSize: 14, fontWeight: 600, padding: "10px 16px", borderRadius: 9, cursor: "pointer", whiteSpace: "nowrap", lineHeight: 1, letterSpacing: "0.01em", background: C.white, color: "#0f1117", border: `1px solid ${C.white}`, fontFamily: F.ui };
  const btnOutline = { ...btnLight, background: "transparent", color: "rgba(255,255,255,.92)", border: "1px solid rgba(255,255,255,.28)" };

  return (
    <header style={{ background: HERO_NAVY, color: C.white }}>
      <div style={{ ...INNER, paddingTop: 26, paddingBottom: 26, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,.55)" }}>Welcome back, {user.email}</span>
            {IS_STAGING && (
              <span style={{ fontSize: 10, fontWeight: 700, color: C.red500, letterSpacing: "0.08em", textTransform: "uppercase", border: `1px solid ${C.red500}`, borderRadius: 5, padding: "1px 6px" }}>Staging</span>
            )}
          </div>
          <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.025em", margin: "0 0 20px", lineHeight: 1.05 }}>Your season, at a glance</h1>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button style={{ ...btnLight, ...(newGameBlocked ? { background: "rgba(255,255,255,.4)", borderColor: "transparent", color: "rgba(0,0,0,.35)", cursor: "not-allowed" } : {}) }}
              onClick={newGameBlocked ? undefined : onNewGame}
              title={newGameBlocked ? "Personal game limit reached — upgrade your plan" : undefined}>
              +  New game
            </button>
            <button style={view === "rosters" ? btnLight : btnOutline} onClick={onToggleRosters}>Rosters</button>
          </div>
        </div>
        {!isNarrow && (
          <img src="/LaxStatsIcon.png" alt="LaxStats" style={{ height: 132, width: "auto", flex: "0 0 auto", display: "block", filter: "drop-shadow(0 10px 30px rgba(0,0,0,.35))" }} />
        )}
      </div>
    </header>
  );
}

function SignedInHome({ user, orgMemberships, usage }) {
  const navigate = useNavigate();
  const isNarrow = useIsNarrow();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteStages, setDeleteStages] = useState({});
  const [view, setView] = useState("games");
  const [showAllFinal, setShowAllFinal] = useState(false);

  useEffect(() => { loadGames(); }, [user.id]);

  async function loadGames() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("games")
      .select("id, created_at, name, state, summary, schema_ver, is_public, pressbox_enabled, org_id")
      .eq("user_id", user.id)
      .is("org_id", null)
      .order("created_at", { ascending: false });
    if (err) { setError(err.message); setLoading(false); return; }
    setGames(data || []);
    setLoading(false);
  }

  async function handleDelete(id) {
    const { error: err } = await supabase.from("games").delete().eq("id", id);
    if (err) setError(err.message);
    else setGames(prev => prev.filter(g => g.id !== id));
    setDeleteStages(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

  function handleMovedToOrg(id) {
    setGames(prev => prev.filter(g => g.id !== id));
  }

  async function handleToggleVisibility(id, isPublic) {
    const before = games;
    setGames(prev => prev.map(g => g.id === id ? { ...g, is_public: isPublic } : g));
    const { error: err } = await setGameVisibility(id, isPublic);
    if (err) { setGames(before); setError(err.message); }
  }

  const liveGames    = games.filter(g => { const i = getGameInfo(g); return i?.started && !i?.gameOver; });
  const pendingGames = games.filter(g => { const i = getGameInfo(g); return !i?.started; });
  const finalGames   = games.filter(g => { const i = getGameInfo(g); return i?.gameOver; });
  const shownFinal   = showAllFinal ? finalGames : finalGames.slice(0, 5);

  const hasOrg = orgMemberships?.length > 0;
  const newGameBlocked = !hasOrg && usage?.at_limit;

  function ownedCard(game) {
    return (
      <OwnedGame key={game.id} game={game}
        deleteStage={deleteStages[game.id] ?? 0}
        onDeleteStage={(stage) => setDeleteStages(prev => stage === null ? (({ [game.id]: _, ...rest }) => rest)(prev) : { ...prev, [game.id]: stage })}
        onDelete={() => handleDelete(game.id)}
        orgMemberships={orgMemberships}
        onMovedToOrg={handleMovedToOrg}
        onToggleVisibility={handleToggleVisibility}
      />
    );
  }

  const mainColumn = view === "rosters" ? (
    <RostersTab />
  ) : loading ? (
    <div style={{ textAlign: "center", padding: "48px 0", color: C.gray400, fontSize: 14 }}>Loading…</div>
  ) : games.length === 0 ? (
    <div style={{ textAlign: "center", padding: "48px 20px" }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: C.gray900, marginBottom: 6 }}>No personal games yet</div>
      <div style={{ fontSize: 14, color: C.gray500, marginBottom: 24 }}>Create a game to start tracking stats.</div>
      {!newGameBlocked && (
        <button style={{ padding: "12px 28px", fontSize: 15, fontWeight: 600, background: C.gray900, color: C.white, border: "none", borderRadius: 12, cursor: "pointer" }}
          onClick={() => navigate("/games/new")}>+ New Game</button>
      )}
    </div>
  ) : (
    <>
      {pendingGames.length > 0 && (
        <section style={{ marginBottom: 34 }}>
          <SectionLabel text="Upcoming" count={pendingGames.length} />
          <div style={{ display: "grid", gap: 14 }}>{pendingGames.map(ownedCard)}</div>
        </section>
      )}
      {finalGames.length > 0 && (
        <section>
          <SectionLabel text="Completed" count={finalGames.length} />
          <div style={{ display: "grid", gap: 14 }}>{shownFinal.map(ownedCard)}</div>
          {finalGames.length > 5 && (
            <button onClick={() => setShowAllFinal(v => !v)}
              style={{ marginTop: 12, padding: "8px 16px", fontSize: 13, fontWeight: 600, background: C.white, color: C.gray650, border: `1px solid ${C.gray200}`, borderRadius: 9, cursor: "pointer", fontFamily: F.ui }}>
              {showAllFinal ? "Show fewer" : `Show all ${finalGames.length} completed`}
            </button>
          )}
        </section>
      )}
    </>
  );

  return (
    <div style={{ fontFamily: F.ui, minHeight: "100%", background: PAGE_BG }}>
      <WelcomeBand user={user} view={view} isNarrow={isNarrow}
        onNewGame={() => navigate("/games/new")}
        newGameBlocked={newGameBlocked}
        onToggleRosters={() => setView(v => v === "rosters" ? "games" : "rosters")} />

      <div style={{ ...INNER, paddingTop: 34, paddingBottom: 72 }}>
        {error && (
          <div style={{ background: C.red50, border: `1px solid ${C.red100}`, borderRadius: 10, padding: "12px 16px", color: C.red600, fontSize: 13, marginBottom: 16 }}>{error}</div>
        )}

        {view === "games" && liveGames.length > 0 && (
          <section style={{ marginBottom: 34 }}>
            <LiveLabel />
            {liveGames.map(game => (
              <LiveCard key={game.id} game={game} isOwner hasPressbox={!!game.pressbox_enabled} />
            ))}
          </section>
        )}

        <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "minmax(0,1fr)" : "minmax(0,1fr) 340px", gap: 40, alignItems: "start" }}>
          <div style={{ minWidth: 0 }}>{mainColumn}</div>
          <aside style={{ position: isNarrow ? "static" : "sticky", top: 24, display: "grid", gap: 30 }}>
            <UsageCard usage={usage} />
            <OrgRail orgMemberships={orgMemberships} />
          </aside>
        </div>
      </div>
    </div>
  );
}

// ── Logged-out (marketing) home ───────────────────────────────────────────────
const SAMPLE_GAME = {
  id: "sample",
  created_at: "2026-06-30T17:30:00Z",
  state: {
    teams: [{ name: "Riverside", color: "#1a6bab" }, { name: "Oakhill", color: "#b84e1a" }],
    trackingStarted: true, gameOver: true, currentQuarter: 4,
    score0: 9, score1: 7, gameDate: "2026-06-30",
  },
};

function FeatureStrip() {
  const feats = [
    ["Score from the sideline", "Track goals, assists, ground balls, faceoffs and penalties from your phone — no laptop, no paper scorebook."],
    ["Share the game live", "Send one link. Parents, coaches and fans follow the score and box in real time from anywhere."],
    ["Box score at the whistle", "The moment the game ends you have a complete box score and shot chart, ready to share or export."],
  ];
  return (
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
      {feats.map(([title, body], i) => (
        <div key={i} style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 14, padding: "22px 22px 24px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: C.gray350, marginBottom: 12 }}>0{i + 1}</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em", color: C.gray900, margin: "0 0 8px" }}>{title}</h3>
          <p style={{ fontSize: 14.5, lineHeight: 1.5, color: C.gray500, margin: 0 }}>{body}</p>
        </div>
      ))}
    </section>
  );
}

function HowItWorks({ isNarrow }) {
  const navigate = useNavigate();
  const steps = [
    ["Set up teams", "Add rosters or paste them in."],
    ["Track live", "Tap events as the game happens."],
    ["Share the link", "Fans follow in real time."],
    ["Final box score", "Complete stats, instantly."],
  ];
  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <SectionLabel text="How it works" />
        <button onClick={() => navigate("/guide")}
          style={{ fontSize: 14, fontWeight: 600, color: C.blue600, background: "none", border: "none", cursor: "pointer", marginTop: -12, fontFamily: F.ui }}>
          Read the full guide ›
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "repeat(2, 1fr)" : "repeat(4, 1fr)", background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 14, overflow: "hidden" }}>
        {steps.map(([title, sub], i) => {
          const firstInRow = isNarrow ? i % 2 === 0 : i === 0;
          const border = {
            borderLeft: firstInRow ? "none" : "1px solid #eceef1",
            borderTop: isNarrow && i >= 2 ? "1px solid #eceef1" : "none",
          };
          return (
            <div key={i} style={{ padding: "20px 20px 22px", ...border }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 26, background: "#0f1117", color: C.white, fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{i + 1}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.gray900, marginBottom: 5 }}>{title}</div>
              <div style={{ fontSize: 13.5, lineHeight: 1.45, color: C.gray500 }}>{sub}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PublicGamesSection({ isNarrow }) {
  const [publicGames, setPublicGames] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    load();
    const channel = supabase.channel("public-games-home")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games" }, () => load())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  async function load() {
    const { data } = await supabase
      .from("games")
      .select("id, created_at, name, state, summary, schema_ver, user_id, org_id, is_public")
      .eq("is_public", true)
      .not("state", "is", null)
      .order("created_at", { ascending: false })
      .limit(12);
    const games = (data || []).filter(g => {
      const info = getGameInfo(g);
      return info?.started;
    });

    setPublicGames(games);
    setLoaded(true);
  }

  if (!loaded) return null;

  const live      = publicGames.filter(g => !getGameInfo(g)?.gameOver);
  const completed = publicGames.filter(g => getGameInfo(g)?.gameOver).slice(0, 4);

  if (publicGames.length === 0) {
    return (
      <section>
        <SectionLabel text="A shared game" />
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", top: 12, left: 12, zIndex: 2, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", background: "#0f1117", color: C.white, padding: "4px 9px", borderRadius: 6 }}>SAMPLE</div>
          <div style={{ border: `1px dashed ${C.gray200}`, borderRadius: 16, padding: 16, background: C.white }}>
            <PublicResultCard game={SAMPLE_GAME} sample />
            <p style={{ fontSize: 13.5, color: C.gray350, textAlign: "center", margin: "12px 4px 4px" }}>
              No public games right now. This is what a shared game looks like — when a coach flags a game public, it shows up here for anyone to follow.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <SectionLabel text="Follow live & recent" count={live.length + completed.length} />
      <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 16, alignItems: "start" }}>
        {live.map(game => (
          <div key={game.id} style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 14, padding: 4, boxShadow: SH.card }}>
            <LiveCard game={game} isOwner={false} hasPressbox={false} />
          </div>
        ))}
        {completed.map(game => (
          <PublicResultCard key={game.id} game={game} />
        ))}
      </div>
    </section>
  );
}

function MarketingHome() {
  const navigate = useNavigate();
  const isNarrow = useIsNarrow(760);
  const howRef = useRef(null);
  const btnLight = { fontSize: 14, fontWeight: 600, padding: "10px 16px", borderRadius: 9, cursor: "pointer", whiteSpace: "nowrap", lineHeight: 1, letterSpacing: "0.01em", background: C.white, color: "#0f1117", border: `1px solid ${C.white}`, fontFamily: F.ui };
  const btnOutline = { ...btnLight, background: "transparent", color: "rgba(255,255,255,.92)", border: "1px solid rgba(255,255,255,.28)" };

  return (
    <div style={{ fontFamily: F.ui, minHeight: "100%", background: PAGE_BG }}>
      {/* Hero */}
      <header style={{ background: HERO_NAVY, color: C.white }}>
        <div style={{ ...INNER, paddingTop: 48, paddingBottom: 48 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 40, flexWrap: "wrap" }}>
            <div style={{ maxWidth: 600, minWidth: 280, flex: "1 1 380px" }}>
              {IS_STAGING && (
                <div style={{ fontSize: 10, fontWeight: 700, color: C.red500, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Staging</div>
              )}
              <h1 style={{ fontSize: isNarrow ? 34 : 46, fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 16px", lineHeight: 1.02 }}>
                The digital scorebook for men's lacrosse.
              </h1>
              <p style={{ fontSize: 18, lineHeight: 1.5, color: "rgba(255,255,255,.72)", margin: "0 0 26px" }}>
                Score a game from your phone, share it live with anyone, and get a full box score the moment the final whistle blows.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <button style={btnLight} onClick={() => navigate("/games/new")}>Start scoring — it's free</button>
                <button style={btnOutline} onClick={() => howRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>See how it works</button>
              </div>
            </div>
            <img src="/LaxStatsIcon.png" alt="LaxStats" style={{ height: isNarrow ? 150 : 236, width: "auto", flex: "0 0 auto", display: "block", filter: "drop-shadow(0 14px 40px rgba(0,0,0,.4))" }} />
          </div>
        </div>
      </header>

      {/* Body */}
      <div style={{ ...INNER, paddingTop: 48, paddingBottom: 40, display: "grid", gap: 48 }}>
        <FeatureStrip />
        <PublicGamesSection isNarrow={isNarrow} />
        <div ref={howRef} style={{ scrollMarginTop: 60 }}>
          <HowItWorks isNarrow={isNarrow} />
        </div>

        {/* Closing CTA */}
        <section style={{ background: HERO_NAVY, borderRadius: 18, padding: "40px 40px 44px", color: C.white, textAlign: "center" }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 10px" }}>Ready for your next game?</h2>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,.72)", margin: "0 0 22px" }}>Free to start. No card required.</p>
          <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
            <button style={btnLight} onClick={() => navigate("/games/new")}>Create your first game</button>
            <button style={btnOutline} onClick={() => navigate("/pricing")}>View plans</button>
          </div>
        </section>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function GameList() {
  const { user, orgMemberships, loading: authLoading } = useAuth();
  const personalUsage = usePersonalGameUsage(user);

  return (
    <>
      <SeoMeta
        title="Home"
        description="Score lacrosse games on your phone, share live stats with anyone, and get a full box score instantly. Free to start."
        url="https://laxstats.app"
      />
      <Helmet>
        <script type="application/ld+json">{HOME_JSON_LD}</script>
      </Helmet>

      {authLoading ? (
        <div style={{ fontFamily: F.ui, minHeight: "100%", background: PAGE_BG }} />
      ) : user ? (
        <SignedInHome user={user} orgMemberships={orgMemberships} usage={personalUsage} />
      ) : (
        <MarketingHome />
      )}
    </>
  );
}
