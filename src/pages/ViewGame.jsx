import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { linkGameToAwaySeason } from "../services/games";
import {
  buildPlayerStats, buildTeamTotals, buildScoringTimeline,
  qLabel, isOT,
} from "../components/LaxStats";
import { useDocTitle } from "../hooks/useDocTitle";
import { dbRowToEntry } from "../hooks/useGameLog";
import { isStatEventType, isMetaEventType } from "../domain/eventTypes";
import { deriveQuarterFromStream } from "../domain/reduceGame";
import GameTimeline from "../components/GameTimeline";
import MomentumTracker from "../components/analytics/MomentumTracker";
import PlayerStatsTable, { PLAYER_STAT_KEYS } from "../components/PlayerStatsTable";
import ShotMap from "../components/ShotMap";
import HeroCard from "../components/HeroCard";
import GameLiveStream from "../components/GameLiveStream";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { C, F, SH } from "../styles/tokens";

function getLatestTime(log, currentQuarter) {
  if (!log?.length) return null;
  const toS = t => { const [m, s] = t.split(":").map(Number); return m * 60 + s; };
  const timed = log
    .filter(e => e.quarter === currentQuarter && (e.goalTime || e.timeoutTime || e.penaltyTime))
    .map(e => { const str = e.goalTime || e.timeoutTime || e.penaltyTime; return { str, secs: toS(str) }; });
  if (!timed.length) return null;
  return timed.reduce((min, t) => t.secs < min.secs ? t : min).str;
}

// ── Styles (matches LaxStats style conventions) ──────────────────────────────
const S = {
  page: { fontFamily: F.ui, maxWidth: 600, margin: "0 auto", padding: "0 0 40px" },
  header: { display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: `1px solid ${C.gray150}`, background: C.white, position: "sticky", top: 0, zIndex: 10, fontFamily: F.ui },
  backBtn: { fontSize: 13, fontWeight: 500, color: C.gray500, background: "none", border: "none", cursor: "pointer", padding: "4px 0", letterSpacing: "0.01em" },
  headerTitle: { fontSize: 17, fontWeight: 700, color: C.gray900, flex: 1, letterSpacing: "-0.01em", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  liveBadge: { fontSize: 11, fontWeight: 600, color: C.white, background: C.green400, borderRadius: 20, padding: "3px 9px" },
  finalBadge: { fontSize: 11, fontWeight: 600, color: C.gray500, background: C.gray75, borderRadius: 20, padding: "3px 9px" },
  pendingBadge: { fontSize: 11, fontWeight: 700, color: C.orange600, background: C.orange50, borderRadius: 20, padding: "3px 9px" },
  copyBtn: { fontSize: 12, fontWeight: 500, color: C.gray650, background: C.gray50, border: `1px solid ${C.gray200}`, borderRadius: 20, padding: "4px 10px", cursor: "pointer", whiteSpace: "nowrap" },
  copyBtnDone: { fontSize: 12, fontWeight: 500, color: C.green600, background: C.green60, border: `1px solid ${C.green100}`, borderRadius: 20, padding: "4px 10px", cursor: "default", whiteSpace: "nowrap" },
  body: { padding: "0 16px" },
  loading: { display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: C.gray500, fontSize: 14 },
  error: { maxWidth: 400, margin: "40px auto", padding: 20, background: C.red50, border: `1px solid ${C.red300}`, borderRadius: 10, color: C.red600, fontSize: 14 },
  finalBanner: { background: C.gray850, color: C.white, borderRadius: 12, padding: "20px", textAlign: "center", marginBottom: 20, marginTop: 16 },
  scoreHeader: { display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", marginBottom: 16, gap: 12, paddingTop: 16 },
  scoreBig: { fontSize: 38, fontWeight: 500, textAlign: "center", letterSpacing: 2 },
  tableWrap: { border: `1px solid ${C.gray150}`, borderRadius: 12, overflow: "hidden", marginBottom: 20 },
  tableTitle: { fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: C.gray500, padding: "10px 14px 8px", borderBottom: `1px solid ${C.gray150}`, background: C.gray30, display: "flex", justifyContent: "space-between", alignItems: "center" },
  table: { width: "100%", fontSize: 13, borderCollapse: "collapse" },
  thLeft: { padding: "8px 14px", textAlign: "left", fontWeight: 600, fontSize: 11, color: C.gray500, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `1px solid ${C.gray150}`, background: C.gray50, whiteSpace: "nowrap" },
  th: (sorted) => ({ padding: "8px 8px", textAlign: "right", fontWeight: 600, fontSize: 11, color: sorted ? C.gray900 : C.gray500, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `1px solid ${C.gray150}`, background: C.gray50, cursor: "pointer", whiteSpace: "nowrap" }),
  tdLeft: { padding: "9px 14px", borderBottom: `1px solid ${C.gray75}`, color: C.gray900, textAlign: "left", whiteSpace: "nowrap" },
  td: { padding: "9px 8px", borderBottom: `1px solid ${C.gray75}`, color: C.gray900, textAlign: "right" },
  numBadge: { display: "inline-block", width: 24, height: 24, borderRadius: "50%", background: C.gray75, fontSize: 11, fontWeight: 600, textAlign: "center", lineHeight: "24px", marginRight: 6, color: C.gray500 },
  summaryGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 },
  summaryCard: { background: C.gray45, borderRadius: 10, padding: "12px 14px" },
  summaryLabel: { fontSize: 11, color: C.gray500, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 },
  summaryRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 },
  tabsRow: { display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" },
  tabBtn: (active) => ({ padding: "6px 14px", fontSize: 13, border: `1px solid ${C.gray250}`, borderRadius: 20, background: active ? C.gray900 : "transparent", color: active ? C.white : C.gray500, cursor: "pointer" }),
  emptyState: { textAlign: "center", padding: "40px 16px", color: C.gray400, fontSize: 14 },
  noGame: { textAlign: "center", padding: "40px 16px", color: C.gray400, fontSize: 14 },
};



export default function ViewGame() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statsTab, setStatsTab] = useState("summary");
  const [statsQtr, setStatsQtr] = useState("all");
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const qrCanvasRef = useRef(null);
  const [hasPressbox, setHasPressbox] = useState(false);
  const [derivedQuarterState, setDerivedQuarterState] = useState(null);
  const [heroCardOpen, setHeroCardOpen] = useState(false);
  const [orgLogos, setOrgLogos] = useState([null, null]);
  const push = usePushNotifications(id, user?.id);

  // Away org "Add to my season" state
  const [awayOrgRole, setAwayOrgRole]       = useState(null); // role string if viewer is a member of away org
  const [awayOrgName, setAwayOrgName]       = useState(null);
  const [awaySeasons, setAwaySeasons]       = useState([]);
  const [addSeasonState, setAddSeasonState] = useState("idle"); // idle | picking | saving | done
  const [addSeasonId, setAddSeasonId]       = useState("");
  const [addSeasonError, setAddSeasonError] = useState(null);

  function copyUrl() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function saveQrImage() {
    const canvas = qrCanvasRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `laxstats-game-${id}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }


useEffect(() => {
    loadGame();

    const channel = supabase.channel(`game-events-${id}`)
      // Broadcasts from the scorekeeper — primary live-update path
      .on("broadcast", { event: "new_events" }, ({ payload }) => {
        const rows = (payload?.entries ?? []).filter(r => !r.deleted_at);
        rows.filter(r => isMetaEventType(r.event_type)).forEach(applyMetaRow);
        const incoming = rows.filter(r => isStatEventType(r.event_type)).map(dbRowToEntry);
        if (!incoming.length) return;
        setV2Log(prev => {
          const base = prev ?? [];
          const existingIds = new Set(base.map(e => e.dbId));
          const toAdd = incoming.filter(e => !existingIds.has(e.dbId));
          if (!toAdd.length) return prev;
          return [...base, ...toAdd].sort((a, b) => a.seq - b.seq);
        });
      })
      .on("broadcast", { event: "delete_group" }, ({ payload }) => {
        setV2Log(prev => prev ? prev.filter(e => e.groupId !== payload?.groupId) : prev);
      })
      // postgres_changes as fallback — handles reconnect gaps and soft-deletes
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${id}`,
      }, (payload) => {
        setGame(prev => prev ? { ...prev, ...payload.new } : payload.new);
      })
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "game_events", filter: `game_id=eq.${id}`,
      }, (payload) => {
        const row = payload.new;
        if (row.deleted_at) return;
        if (isMetaEventType(row.event_type)) { applyMetaRow(row); return; }
        if (!isStatEventType(row.event_type)) return;
        const entry = dbRowToEntry(row);
        setV2Log(prev => {
          if (!prev) return [entry];
          if (prev.some(e => e.dbId === entry.dbId)) return prev;
          return [...prev, entry].sort((a, b) => a.seq - b.seq);
        });
      })
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "game_events", filter: `game_id=eq.${id}`,
      }, (payload) => {
        const row = payload.new;
        if (row.deleted_at) {
          setV2Log(prev => prev ? prev.filter(e => e.dbId !== row.id) : prev);
        } else if (isStatEventType(row.event_type)) {
          // Stamp corrections (quarter relabel, player fix) sync live.
          const entry = dbRowToEntry(row);
          setV2Log(prev => prev ? prev.map(e => (e.dbId === row.id ? entry : e)) : prev);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const [v2Log, setV2Log] = useState(null);
  // Meta rows arrive on multiple realtime paths; incremental quarter replay
  // is not idempotent, so track applied row ids.
  const appliedMetaIds = useRef(new Set());

  const applyMetaRow = (row) => {
    if (appliedMetaIds.current.has(row.id)) return;
    appliedMetaIds.current.add(row.id);
    setDerivedQuarterState(prev => {
      if (!prev) return deriveQuarterFromStream([row]);
      let { currentQuarter, completedQuarters, gameOver } = prev;
      const p = row.payload ?? {};
      if (row.event_type === "quarter_end") {
        completedQuarters = [...completedQuarters, p.fromQuarter];
        currentQuarter    = p.toQuarter;
      } else if (row.event_type === "game_over") {
        completedQuarters = [...completedQuarters, p.fromQuarter];
        gameOver          = true;
        currentQuarter    = p.fromQuarter;
      } else if (row.event_type === "quarter_override") {
        currentQuarter = p.toQuarter;
      }
      return { currentQuarter, completedQuarters, gameOver };
    });
  };

  async function loadGame() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("games")
      .select("id, created_at, name, state, summary, schema_ver, org_id, away_org_id, away_season_id, pressbox_enabled, user_id, referee_names, weather_conditions, field_location")
      .eq("id", id)
      .single();
    if (err) { setError(err.message); setLoading(false); return; }
    setGame(data);

    // Check if viewer is an org_admin of the away org (only they can add the game to a season)
    if (data?.away_org_id && user) {
      const [roleRes, orgRes, seasonsRes] = await Promise.all([
        supabase.rpc("get_org_role", { p_org_id: data.away_org_id }),
        supabase.from("organizations").select("name").eq("id", data.away_org_id).single(),
        supabase.from("seasons").select("id, name").eq("org_id", data.away_org_id).order("start_date", { ascending: false }),
      ]);
      if (roleRes.data === "org_admin") {
        setAwayOrgRole(roleRes.data);
        setAwayOrgName(orgRes.data?.name ?? null);
        setAwaySeasons(seasonsRes.data || []);
        if (data.away_season_id) setAddSeasonState("done");
      }
    }

    // Fetch org logos for home and away
    const orgIds = [data.org_id, data.away_org_id].filter(Boolean);
    if (orgIds.length) {
      const { data: orgs } = await supabase
        .from("organizations").select("id, logo_url").in("id", orgIds);
      const logoMap = Object.fromEntries((orgs || []).map(o => [o.id, o.logo_url]));
      setOrgLogos([logoMap[data.org_id] ?? null, logoMap[data.away_org_id] ?? null]);
    }

    // Pressbox: per-game override OR org feature flag
    if (data?.pressbox_enabled) {
      setHasPressbox(true);
    } else if (data?.org_id) {
      const { data: limit } = await supabase.rpc("org_feature_limit", {
        p_org_id: data.org_id, p_feature_id: "pressbox",
      });
      setHasPressbox(limit !== 0);
    }

    const evRes = await supabase
      .from("game_events")
      .select("*")
      .eq("game_id", id)
      .is("deleted_at", null)
      .order("seq");
    const rows = evRes.data || [];
    setV2Log(rows.filter(r => isStatEventType(r.event_type)).map(dbRowToEntry));
    appliedMetaIds.current = new Set(
      rows.filter(r => isMetaEventType(r.event_type)).map(r => r.id)
    );
    const derived = deriveQuarterFromStream(rows);
    if (derived) setDerivedQuarterState(derived);

    setLoading(false);
  }

  // ── Derived from game state ──────────────────────────────────────
  // Server-projected summary first; legacy state only for pre-refactor games
  // (schema_ver 3 games have state = null forever).
  const state = game?.summary ?? game?.state;
  const teams = state?.teams || [{ name: "Home", color: C.blue600 }, { name: "Away", color: C.orange700 }];
  useDocTitle(game ? `${teams[0].name} vs ${teams[1].name}` : null);
  const log = v2Log ?? [];
  const currentQuarter    = derivedQuarterState?.currentQuarter    ?? state?.currentQuarter    ?? 1;
  const completedQuarters = derivedQuarterState?.completedQuarters ?? state?.completedQuarters ?? [];
  const gameOver          = derivedQuarterState?.gameOver          ?? state?.gameOver          ?? false;
  const teamColors = [teams[0]?.color || C.blue600, teams[1]?.color || C.orange700];
  const displayLogos = [
    teams[0]?.logoUrl || orgLogos[0],
    teams[1]?.logoUrl || orgLogos[1],
  ];

  const totalScores = useMemo(() => [
    log.filter(e => e.event === "goal" && e.teamIdx === 0).length,
    log.filter(e => e.event === "goal" && e.teamIdx === 1).length,
  ], [log]);

  const scoresByQuarter = useMemo(() => {
    const qs = {};
    log.filter(e => e.event === "goal").forEach(e => {
      if (!qs[e.quarter]) qs[e.quarter] = [0, 0];
      qs[e.quarter][e.teamIdx]++;
    });
    return qs;
  }, [log]);

  const allQuarters = useMemo(() => {
    const qs = new Set([...completedQuarters, currentQuarter]);
    return [...qs].sort((a, b) => a - b);
  }, [completedQuarters, currentQuarter]);

  const filteredLog = useMemo(() =>
    statsQtr === "all" ? log : log.filter(e => e.quarter === parseInt(statsQtr)),
    [log, statsQtr]
  );

  const playerStats = useMemo(() => buildPlayerStats(filteredLog), [filteredLog]);
  const teamTotals = useMemo(() => buildTeamTotals(filteredLog, completedQuarters), [filteredLog, completedQuarters]);

  const shotPct  = (ti) => { const s = teamTotals[ti].shot,  g = teamTotals[ti].goal;          return s     ? `${Math.round((g/s)*100)}%` : "—"; };
  const sogPct   = (ti) => { const sog = teamTotals[ti].sog, g = teamTotals[ti].goal;           return sog   ? `${Math.round((g/sog)*100)}%` : "—"; };
  const clearPct = (ti) => { const c = teamTotals[ti].clear, f = teamTotals[ti].failed_clear;   return (c+f) ? `${Math.round((c/(c+f))*100)}%` : "—"; };
  const emoPct   = (ti) => { const s = teamTotals[ti].emo_goal,    f = teamTotals[ti].emo_fail;  return (s+f) ? `${Math.round((s/(s+f))*100)}%` : "—"; };
  const mddPct   = (ti) => { const s = teamTotals[ti].mdd_success, f = teamTotals[ti].mdd_fail; return (s+f) ? `${Math.round((s/(s+f))*100)}%` : "—"; };
  const savePct = (ti) => {
    const sogFaced = teamTotals[1 - ti].sog;
    const saves = teamTotals[ti].shot_saved;
    return sogFaced ? `${Math.round((saves / sogFaced) * 100)}%` : "—";
  };
  const foPct = (ti) => {
    // Legacy games only recorded faceoff wins — losses unknown, so no percentage
    const lossesKnown = teamTotals[0].faceoff_loss + teamTotals[1].faceoff_loss > 0;
    const w = teamTotals[ti].faceoff_win, l = teamTotals[ti].faceoff_loss;
    return lossesKnown && (w + l) ? `${Math.round((w / (w + l)) * 100)}%` : "—";
  };

  const scoringTimeline = useMemo(() => buildScoringTimeline(filteredLog), [filteredLog]);

  async function handleLinkToSeason() {
    if (!addSeasonId) return;
    setAddSeasonState("saving");
    setAddSeasonError(null);
    const { error: err } = await linkGameToAwaySeason(id, addSeasonId);
    if (err) { setAddSeasonError(err.message); setAddSeasonState("picking"); return; }
    setGame(prev => ({ ...prev, away_season_id: addSeasonId }));
    setAddSeasonState("done");
  }

  if (loading) return <div style={{ ...S.loading, fontFamily: F.ui }}>Loading game…</div>;
  if (error) return <div style={{ ...S.error, fontFamily: F.ui }}>{error}</div>;

  const hasState = !!state;

  return (
    <div style={S.page}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => navigate("/")}>← Games</button>
        <img src="/LaxStatsIcon.png" alt="LaxStats" style={{ width: 28, height: 28, objectFit: "contain" }} />
        <span style={S.headerTitle}>{game?.name || "Game"}</span>
        {gameOver
          ? <span style={S.finalBadge}>Final</span>
          : state?.trackingStarted
            ? <span style={S.liveBadge}>● Live</span>
            : <span style={S.pendingBadge}>● Pending</span>
        }
        {hasPressbox && (
          <button style={S.copyBtn} onClick={() => window.open(`/games/${id}/pressbox`, "_blank")}>Press Box ↗</button>
        )}
        {push.isSupported && !gameOver && (
          <button
            style={push.isSubscribed ? { ...S.copyBtn, color: C.green600, background: C.green60, borderColor: C.green100 } : S.copyBtn}
            onClick={push.isSubscribed ? push.unsubscribe : push.subscribe}
            disabled={push.loading}>
            {push.loading ? "…" : push.isSubscribed ? "✓ Following" : "Follow"}
          </button>
        )}
        {gameOver && (
          <button style={S.copyBtn} onClick={() => window.open(`/games/${id}/print`, "_blank")}>Export ↗</button>
        )}
        {gameOver && (
          <button style={S.copyBtn} onClick={() => setHeroCardOpen(true)}>Hero Card</button>
        )}
<button style={copied ? S.copyBtnDone : S.copyBtn} onClick={copyUrl}>
          {copied ? "✓ Copied" : "Copy link"}
        </button>
        <button style={S.copyBtn} onClick={() => setQrOpen(true)} title="Show QR code">
          QR
        </button>
      </div>

      {qrOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: C.blackA55, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.ui }}
          onClick={(e) => { if (e.target === e.currentTarget) setQrOpen(false); }}
        >
          <div style={{ background: C.white, borderRadius: 16, padding: "28px 28px 24px", maxWidth: 320, width: "calc(100% - 40px)", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, boxShadow: SH.modal }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.gray900, textAlign: "center" }}>{game?.name || "Game"}</div>
            <div ref={qrCanvasRef} style={{ lineHeight: 0, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.gray150}` }}>
              <QRCodeCanvas
                value={`${window.location.origin}/games/${id}/view`}
                size={220}
                level="M"
                includeMargin
              />
            </div>
            <div style={{ fontSize: 11, color: C.gray450, textAlign: "center", wordBreak: "break-all", maxWidth: 240 }}>
              {window.location.origin}/games/{id}/view
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                style={{ fontSize: 13, fontWeight: 600, background: C.gray900, color: C.white, border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer" }}
                onClick={saveQrImage}
              >
                Save image
              </button>
              <button
                style={{ fontSize: 13, color: C.gray500, background: "none", border: `1px solid ${C.gray200}`, borderRadius: 8, padding: "8px 16px", cursor: "pointer" }}
                onClick={() => setQrOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}


{/* Away org "Add to my season" banner */}
      {awayOrgRole && addSeasonState !== "done" && (
        <div style={{ padding: "12px 16px", background: C.amber60, borderBottom: `1px solid ${C.amber210}`, fontFamily: F.ui, maxWidth: 600, margin: "0 auto" }}>
          {addSeasonState === "idle" && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: C.amber810, flex: 1 }}>
                This game involves <strong>{awayOrgName}</strong>. Add it to a season to include it in your stats.
              </span>
              <button
                style={{ fontSize: 12, fontWeight: 600, background: C.gray900, color: C.white, border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", whiteSpace: "nowrap" }}
                onClick={() => { setAddSeasonState("picking"); setAddSeasonId(awaySeasons[0]?.id || ""); }}>
                Add to season
              </button>
            </div>
          )}
          {addSeasonState === "picking" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: C.amber810, whiteSpace: "nowrap" }}>Add to season:</span>
              <select
                style={{ fontSize: 13, padding: "5px 8px", border: `1px solid ${C.amber310}`, borderRadius: 8, background: C.white, flex: 1, minWidth: 120 }}
                value={addSeasonId}
                onChange={e => setAddSeasonId(e.target.value)}>
                <option value="" disabled>Select season…</option>
                {awaySeasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button
                style={{ fontSize: 12, fontWeight: 600, background: C.gray900, color: C.white, border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", opacity: !addSeasonId ? 0.4 : 1, whiteSpace: "nowrap" }}
                disabled={!addSeasonId}
                onClick={handleLinkToSeason}>
                Confirm
              </button>
              <button
                style={{ fontSize: 12, color: C.gray500, background: "none", border: "none", cursor: "pointer", padding: "6px 4px" }}
                onClick={() => setAddSeasonState("idle")}>
                Cancel
              </button>
              {addSeasonError && <span style={{ fontSize: 12, color: C.red600, width: "100%" }}>{addSeasonError}</span>}
            </div>
          )}
          {addSeasonState === "saving" && (
            <span style={{ fontSize: 13, color: C.amber810 }}>Saving…</span>
          )}
        </div>
      )}
      {awayOrgRole && addSeasonState === "done" && game?.away_season_id && (
        <div style={{ padding: "8px 16px", background: C.green30, borderBottom: `1px solid ${C.green200}`, fontFamily: F.ui, fontSize: 12, color: C.green600, maxWidth: 600, margin: "0 auto" }}>
          ✓ Game added to {awayOrgName} season
        </div>
      )}

      {heroCardOpen && (
        <HeroCard
          teams={teams}
          teamColors={teamColors}
          totalScores={totalScores}
          playerStats={playerStats}
          gameName={game?.name}
          logos={displayLogos}
          onClose={() => setHeroCardOpen(false)}
        />
      )}

      <div style={S.body}>
        {!hasState ? (
          <div style={S.noGame}>Game hasn't started yet. Check back when the scorekeeper begins tracking.</div>
        ) : (
          <>
            {/* Latest known time — shown above score for live games */}
            {!gameOver && (() => {
              const t = getLatestTime(log, currentQuarter);
              return t ? (
                <div style={{ textAlign: "center", padding: "10px 0 0", fontSize: 13, color: C.gray500 }}>
                  <span style={{ fontWeight: 600, color: C.gray900 }}>{t}</span> remaining · {qLabel(currentQuarter)}
                </div>
              ) : null;
            })()}

            {/* Score / final banner */}
            {gameOver ? (
              <div style={S.finalBanner}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: C.gray400, marginBottom: 12 }}>Final</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    {displayLogos[0] && <img src={displayLogos[0]} alt="" style={{ height: 52, maxWidth: 96, objectFit: "contain" }} />}
                    <div style={{ fontSize: 12, color: teamColors[0], fontWeight: 600 }}>{teams[0].name}</div>
                  </div>
                  <div style={{ fontSize: 42, fontWeight: 500, letterSpacing: 4 }}>
                    <span style={{ color: teamColors[0] }}>{totalScores[0]}</span>
                    <span style={{ color: C.gray650, margin: "0 10px" }}>—</span>
                    <span style={{ color: teamColors[1] }}>{totalScores[1]}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    {displayLogos[1] && <img src={displayLogos[1]} alt="" style={{ height: 52, maxWidth: 96, objectFit: "contain" }} />}
                    <div style={{ fontSize: 12, color: teamColors[1], fontWeight: 600 }}>{teams[1].name}</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: C.gray400 }}>
                  {totalScores[0] > totalScores[1] ? teams[0].name : teams[1].name} wins
                  {allQuarters.some(q => isOT(q)) ? " in overtime" : ""}
                </div>
              </div>
            ) : (
              <div style={S.scoreHeader}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                  {displayLogos[0] && <img src={displayLogos[0]} alt="" style={{ height: 44, maxWidth: 80, objectFit: "contain" }} />}
                  <div style={{ fontSize: 13, fontWeight: 600, color: teamColors[0] }}>{teams[0].name}</div>
                  {state?.activeGoalies?.[0] && (
                    <div style={{ fontSize: 11, color: C.gray500 }}>GK: #{state.activeGoalies[0].num} {state.activeGoalies[0].name}</div>
                  )}
                </div>
                <div style={S.scoreBig}>
                  <span style={{ color: teamColors[0] }}>{totalScores[0]}</span>
                  <span style={{ color: C.gray250, margin: "0 8px" }}>—</span>
                  <span style={{ color: teamColors[1] }}>{totalScores[1]}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  {displayLogos[1] && <img src={displayLogos[1]} alt="" style={{ height: 44, maxWidth: 80, objectFit: "contain" }} />}
                  <div style={{ fontSize: 13, fontWeight: 600, color: teamColors[1], textAlign: "right" }}>{teams[1].name}</div>
                  {state?.activeGoalies?.[1] && (
                    <div style={{ fontSize: 11, color: C.gray500 }}>GK: #{state.activeGoalies[1].num} {state.activeGoalies[1].name}</div>
                  )}
                </div>
              </div>
            )}

            {/* Momentum tracker — fan view, directly below the score banner */}
            <MomentumTracker
              log={log}
              teams={teams}
              teamColors={teamColors}
              currentQuarter={currentQuarter}
              gameOver={gameOver}
            />

            {/* Game logistics */}
            {(() => {
              const loc  = game?.field_location     || state?.fieldLocation;
              const cond = game?.weather_conditions || state?.weatherConditions;
              const refs = game?.referee_names      || state?.refereeNames;
              if (!loc && !cond && !refs) return null;
              return (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", padding: "8px 2px 16px", fontSize: 12, color: C.gray550 }}>
                  {loc  && <span><span style={{ color: C.gray400, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: 10 }}>Field </span>{loc}</span>}
                  {cond && <span><span style={{ color: C.gray400, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: 10 }}>Conditions </span>{cond}</span>}
                  {refs && <span><span style={{ color: C.gray400, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: 10 }}>Referees </span>{refs}</span>}
                </div>
              );
            })()}

            {/* Quarter score grid */}
            {allQuarters.length > 1 && (
              <div style={{ ...S.tableWrap, marginBottom: 20 }}>
                <table style={{ ...S.table, fontSize: 13 }}>
                  <thead><tr>
                    <th style={S.thLeft}>Team</th>
                    {allQuarters.map(q => (
                      <th key={q} style={{ ...S.th(false), color: completedQuarters.includes(q) ? C.gray500 : C.green400 }}>
                        {qLabel(q)}
                        {!completedQuarters.includes(q) && !gameOver && (
                          <span style={{ display: "block", fontSize: 9, color: C.green400, fontWeight: 400 }}>live</span>
                        )}
                      </th>
                    ))}
                    <th style={{ ...S.th(false), color: C.gray900, borderLeft: `1px solid ${C.gray150}` }}>Total</th>
                  </tr></thead>
                  <tbody>{[0, 1].map(ti => (
                    <tr key={ti}>
                      <td style={{ ...S.tdLeft, fontWeight: 600, color: teamColors[ti] }}>{teams[ti].name}</td>
                      {allQuarters.map(q => <td key={q} style={S.td}>{(scoresByQuarter[q] || [0, 0])[ti]}</td>)}
                      <td style={{ ...S.td, fontWeight: 600, borderLeft: `1px solid ${C.gray150}` }}>{totalScores[ti]}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}

            {/* Quarter filter */}
            <div style={S.tabsRow}>
              <button style={S.tabBtn(statsQtr === "all")} onClick={() => setStatsQtr("all")}>All</button>
              {completedQuarters.map(q => (
                <button key={q} style={S.tabBtn(statsQtr === String(q))} onClick={() => setStatsQtr(String(q))}>{qLabel(q)}</button>
              ))}
              {!gameOver && (
                <button style={S.tabBtn(statsQtr === String(currentQuarter))} onClick={() => setStatsQtr(String(currentQuarter))}>
                  {qLabel(currentQuarter)} <span style={{ fontSize: 10, color: statsQtr === String(currentQuarter) ? C.gray400 : C.green400 }}>●</span>
                </button>
              )}
            </div>

            {/* Stats sub-tabs */}
            <div style={S.tabsRow}>
              {["summary", "players", "map", "timeline", "feed"].map(t => (
                <button key={t} style={S.tabBtn(statsTab === t)} onClick={() => setStatsTab(t)}>
                  {t === "feed" ? (gameOver ? "Feed" : "● Feed") : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {/* Summary */}
            {statsTab === "summary" && (
              <div style={S.summaryGrid}>
                {[
                  { heading: "Scoring" },
                  { label: "Goals", key: "goal" }, { label: "Assists", key: "assist" },
                  { label: "Successful EMO", key: "emo_goal" }, { label: "Failed EMO", key: "emo_fail" },
                  { label: "EMO %", custom: emoPct },
                  { heading: "Defense" },
                  { label: "Successful MDD", key: "mdd_success" }, { label: "Failed MDD", key: "mdd_fail" },
                  { label: "MDD %", custom: mddPct },
                  { label: "Saves", key: "shot_saved" }, { label: "Save %", custom: savePct },
                  { label: "Forced TOs", key: "forced_to" },
                  { heading: "Shooting" },
                  { label: "Total Shots", key: "shot" }, { label: "Shot %", custom: shotPct },
                  { label: "Shots on Goal", key: "sog" }, { label: "SOG %", custom: sogPct },
                  { heading: "Possession" },
                  { label: "Ground Balls", key: "ground_ball" }, { label: "Turnovers", key: "turnover" },
                  { label: "Faceoffs Won", key: "faceoff_win" }, { label: "Faceoffs Lost", key: "faceoff_loss" },
                  { label: "Faceoff %", custom: foPct },
                  { heading: "Clearing" },
                  { label: "Successful Clears", key: "clear" }, { label: "Failed Clears", key: "failed_clear" },
                  { label: "Clearing %", custom: clearPct },
                  { label: "Successful Rides", key: "successful_ride" }, { label: "Failed Rides", key: "failed_ride" },
                  { heading: "Penalties" },
                  { label: "Technicals", key: "penalty_tech" }, { label: "PF Minutes", key: "penalty_min" },
                ].map((item) => item.heading ? (
                  <div key={item.heading} style={{ gridColumn: "1 / -1", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.gray350, padding: "8px 2px 2px" }}>{item.heading}</div>
                ) : (
                  <div key={item.label} style={S.summaryCard}>
                    <div style={S.summaryLabel}>{item.label}</div>
                    {[0, 1].map(ti => (
                      <div key={ti} style={S.summaryRow}>
                        <div style={{ fontSize: 12, color: teamColors[ti] }}>{teams[ti].name}</div>
                        <div style={{ fontSize: 20, fontWeight: 500, color: teamColors[ti] }}>
                          {item.custom ? item.custom(ti) : (teamTotals[ti][item.key] || 0)}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Shot Map */}
            {statsTab === "map" && (
              <ShotMap log={filteredLog} teamColors={teamColors} teams={teams} />
            )}

            {/* Players */}
            {statsTab === "players" && (
              <div style={S.tableWrap}>
                <PlayerStatsTable
                  teams={teams}
                  teamColors={teamColors}
                  playerStats={playerStats}
                  statKeys={PLAYER_STAT_KEYS}
                  goalieDecisions={state?.goalieDecisions || null}
                />
              </div>
            )}

            {/* Timeline */}
            {statsTab === "timeline" && (
              <div style={S.tableWrap}>
                <div style={S.tableTitle}><span>Timeline</span></div>
                <GameTimeline scoringTimeline={scoringTimeline} teams={teams} teamColors={teamColors} />
              </div>
            )}

            {/* Live Feed */}
            {statsTab === "feed" && (
              <GameLiveStream
                log={log}
                teams={teams}
                teamColors={teamColors}
                completedQuarters={completedQuarters}
                currentQuarter={currentQuarter}
                gameOver={gameOver}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}