import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

const ROLE_LABELS = { org_admin: "Admin", coach: "Coach", scorekeeper: "Scorekeeper", viewer: "Viewer" };
const ROLE_COLORS = {
  org_admin:   { bg: "#fff3e0", color: "#d4820a" },
  coach:       { bg: "#e8f5e9", color: "#2a7a3b" },
  scorekeeper: { bg: "#e3f2fd", color: "#1a6bab" },
  viewer:      { bg: "#f5f5f5", color: "#555" },
};

function parseDate(str) {
  return str?.length === 10 ? new Date(str + "T12:00:00") : new Date(str);
}
function fmtDate(str) {
  if (!str) return "";
  return parseDate(str).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtShort(str) {
  if (!str) return "";
  return parseDate(str).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function gameScores(game) {
  const log = game.state?.log || [];
  return {
    home: log.filter(e => e.event === "goal" && e.teamIdx === 0).length,
    away: log.filter(e => e.event === "goal" && e.teamIdx === 1).length,
    started: !!game.state?.trackingStarted,
    over: !!game.state?.gameOver,
  };
}

// ─── Sub-components ────────────────────────────────────────────────────────

function RoleBadge({ role }) {
  const style = ROLE_COLORS[role] || ROLE_COLORS.viewer;
  return (
    <span style={{
      display: "inline-block", fontSize: 10, fontWeight: 700,
      padding: "3px 9px", borderRadius: 6, letterSpacing: "0.05em",
      ...style,
    }}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

function StatChip({ value, label }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#111", letterSpacing: "-0.02em", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: "#999", marginTop: 3, fontWeight: 500 }}>{label}</div>
    </div>
  );
}

function RecentGameRow({ game, canScore, navigate }) {
  const { home, away, started, over } = gameScores(game);
  // Prefer DB-joined team rows; fall back to names embedded in game state JSONB
  // (games created without a linked org team have null home/away_team_id).
  const stateTeams = game.state?.teams ?? [];
  const homeTeam = game.home_team ?? stateTeams[0] ?? null;
  const awayTeam = game.away_team ?? stateTeams[1] ?? null;
  const homeColor = homeTeam?.color || "#444";
  const awayColor = awayTeam?.color || "#888";
  const date = fmtShort(game.game_date || game.created_at);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f5f5f5" }}>
      {/* Status dot */}
      <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: over ? "#ccc" : started ? "#2a7a3b" : "#f0a500" }} />

      {/* Teams + score */}
      {started ? (
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr auto auto auto 1fr", alignItems: "center", gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: homeColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {homeTeam?.name ?? ""}
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: home > away ? homeColor : "#bbb", fontVariantNumeric: "tabular-nums" }}>{home}</span>
          <span style={{ fontSize: 12, color: "#ddd" }}>–</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: away > home ? awayColor : "#bbb", fontVariantNumeric: "tabular-nums" }}>{away}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: awayColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>
            {awayTeam?.name ?? ""}
          </span>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: homeColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {homeTeam?.name ?? ""}
          </span>
          <span style={{ fontSize: 11, color: "#ccc" }}>vs</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: awayColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {awayTeam?.name ?? ""}
          </span>
        </div>
      )}

      {/* Date + actions */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#bbb" }}>{date}</div>
          {over && <div style={{ fontSize: 10, fontWeight: 600, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.04em" }}>Final</div>}
          {started && !over && <div style={{ fontSize: 10, fontWeight: 700, color: "#2a7a3b" }}>Live</div>}
        </div>
        {canScore && !over && (
          <button
            onClick={() => navigate(`/games/${game.id}/score`)}
            style={{ padding: "3px 10px", fontSize: 11, fontWeight: 700, background: "#111", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            Score
          </button>
        )}
        {over && (
          <button
            onClick={() => navigate(`/games/${game.id}/view`)}
            style={{ padding: "3px 10px", fontSize: 11, fontWeight: 600, background: "transparent", color: "#888", border: "1px solid #e0e0e0", borderRadius: 6, cursor: "pointer" }}
          >
            View
          </button>
        )}
      </div>
    </div>
  );
}

function OrgCard({ membership, data, navigate }) {
  const { role, org } = membership;
  const { teamCount = 0, playerCount = 0, gameCount = 0, seasons = [], recentGames = [] } = data || {};
  const isAdmin = role === "org_admin";
  const canScore = role === "org_admin" || role === "coach" || role === "scorekeeper";
  const activeSeason = seasons[0] ?? null;

  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e8e8e8",
      borderRadius: 18,
      overflow: "hidden",
      marginBottom: 16,
      boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
    }}>
      {/* Accent bar */}
      <div style={{ height: 5, background: "linear-gradient(90deg, #111 0%, #444 100%)" }} />

      <div style={{ padding: "20px 22px 0" }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#111", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              {org?.name}
            </div>
            <div style={{ fontSize: 11, color: "#ccc", marginTop: 3, fontFamily: "monospace" }}>/orgs/{org?.slug}</div>
          </div>
          <RoleBadge role={role} />
        </div>

        {/* Season */}
        <div style={{ marginTop: 14 }}>
          {activeSeason ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                fontSize: 12, fontWeight: 700, color: "#2a7a3b",
                background: "#eaf6ec", border: "1px solid #c0e8c8",
                borderRadius: 7, padding: "3px 10px",
              }}>
                {activeSeason.name}
              </span>
              {activeSeason.start_date && (
                <span style={{ fontSize: 12, color: "#aaa" }}>
                  {fmtDate(activeSeason.start_date)}
                  {activeSeason.end_date ? ` – ${fmtDate(activeSeason.end_date)}` : ""}
                </span>
              )}
            </div>
          ) : (
            <span style={{
              fontSize: 12, fontWeight: 600,
              color: isAdmin ? "#c0392b" : "#bbb",
              background: isAdmin ? "#fff5f5" : "#f8f8f8",
              border: `1px solid ${isAdmin ? "#fdd" : "#eee"}`,
              borderRadius: 7, padding: "3px 10px",
            }}>
              {isAdmin ? "No active season — set one up" : "No active season"}
            </span>
          )}
        </div>

        {/* Stats strip */}
        <div style={{
          display: "flex", alignItems: "center", gap: 0,
          margin: "18px 0 0", padding: "14px 0",
          borderTop: "1px solid #f5f5f5", borderBottom: "1px solid #f5f5f5",
        }}>
          <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
            <StatChip value={teamCount} label={teamCount === 1 ? "Team" : "Teams"} />
          </div>
          <div style={{ width: 1, height: 32, background: "#f0f0f0" }} />
          <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
            <StatChip value={playerCount} label={playerCount === 1 ? "Player" : "Players"} />
          </div>
          <div style={{ width: 1, height: 32, background: "#f0f0f0" }} />
          <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
            <StatChip value={gameCount} label={gameCount === 1 ? "Game" : "Games"} />
          </div>
          {seasons.length > 0 && (
            <>
              <div style={{ width: 1, height: 32, background: "#f0f0f0" }} />
              <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
                <StatChip value={seasons.length} label={seasons.length === 1 ? "Season" : "Seasons"} />
              </div>
            </>
          )}
        </div>

        {/* Recent games */}
        {recentGames.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
              Recent Games
            </div>
            {recentGames.map(g => <RecentGameRow key={g.id} game={g} canScore={canScore} navigate={navigate} />)}
          </div>
        )}
      </div>

      {/* Actions footer */}
      <div style={{
        display: "flex", gap: 8, flexWrap: "wrap",
        padding: "14px 22px 18px",
        marginTop: 14,
        background: "#fafafa",
        borderTop: "1px solid #f0f0f0",
      }}>
        <button
          onClick={() => navigate(`/orgs/${org?.slug}`)}
          style={{ padding: "8px 16px", fontSize: 13, fontWeight: 700, background: "#111", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer" }}
        >
          Dashboard →
        </button>
        {canScore && (
          <button
            onClick={() => navigate("/games/new", { state: { orgMembership: membership } })}
            style={{ padding: "8px 14px", fontSize: 12, fontWeight: 600, background: "transparent", color: "#555", border: "1px solid #ddd", borderRadius: 10, cursor: "pointer" }}
          >
            + New Game
          </button>
        )}
        {activeSeason && (
          <button
            onClick={() => navigate(`/orgs/${org?.slug}/seasons/${activeSeason.id}`)}
            style={{ padding: "8px 14px", fontSize: 12, fontWeight: 600, background: "transparent", color: "#555", border: "1px solid #ddd", borderRadius: 10, cursor: "pointer" }}
          >
            Season Stats
          </button>
        )}
        <button
          onClick={() => navigate(`/orgs/${org?.slug}/teams`)}
          style={{ padding: "8px 14px", fontSize: 12, fontWeight: 600, background: "transparent", color: "#555", border: "1px solid #ddd", borderRadius: 10, cursor: "pointer" }}
        >
          Teams &amp; Roster
        </button>
        {isAdmin && (
          <button
            onClick={() => navigate(`/orgs/${org?.slug}`, { state: { tab: "members" } })}
            style={{ padding: "8px 14px", fontSize: 12, fontWeight: 600, background: "transparent", color: "#555", border: "1px solid #ddd", borderRadius: 10, cursor: "pointer" }}
          >
            Members
          </button>
        )}
      </div>
    </div>
  );
}

function SummaryBar({ memberships, orgData }) {
  const totalGames   = Object.values(orgData).reduce((s, d) => s + (d.gameCount  || 0), 0);
  const totalPlayers = Object.values(orgData).reduce((s, d) => s + (d.playerCount || 0), 0);
  const activeSeasons = Object.values(orgData).filter(d => d.seasons?.length > 0).length;

  const stats = [
    { value: memberships.length, label: "Organizations" },
    { value: activeSeasons,      label: "Active Seasons" },
    { value: totalGames,         label: "Total Games"    },
    { value: totalPlayers,       label: "Players"        },
  ];

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
      gap: 1,
      background: "#e8e8e8",
      border: "1px solid #e8e8e8",
      borderRadius: 14,
      overflow: "hidden",
      marginBottom: 28,
    }}>
      {stats.map(({ value, label }) => (
        <div key={label} style={{ background: "#fff", padding: "14px 10px", textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#111", letterSpacing: "-0.02em", lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: 11, color: "#999", marginTop: 4, fontWeight: 500 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Orgs() {
  const navigate = useNavigate();
  const { user, orgMemberships, loading: authLoading } = useAuth();
  const [orgData, setOrgData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/login", { replace: true }); return; }
    if (orgMemberships.length === 0) { setLoading(false); return; }
    loadOrgData();
  }, [authLoading, orgMemberships]);

  async function loadOrgData() {
    const orgIds = orgMemberships.map(m => m.org_id);

    const [teamsRes, playersRes, seasonsRes, gamesRes, recentRes] = await Promise.all([
      supabase.from("teams").select("id, org_id").in("org_id", orgIds),
      supabase.from("players").select("id, org_id").in("org_id", orgIds),
      supabase.from("seasons")
        .select("id, org_id, name, start_date, end_date")
        .in("org_id", orgIds)
        .order("start_date", { ascending: false }),
      supabase.from("games").select("id, org_id").in("org_id", orgIds),
      supabase.from("games")
        .select("id, org_id, state, game_date, created_at, home_team:teams!home_team_id(id, name, color), away_team:teams!away_team_id(id, name, color)")
        .in("org_id", orgIds)
        .order("created_at", { ascending: false })
        .limit(orgIds.length * 5),
    ]);

    const data = {};
    for (const id of orgIds) {
      const orgGames = (recentRes.data || []).filter(g => g.org_id === id);
      data[id] = {
        teamCount:   (teamsRes.data   || []).filter(t => t.org_id === id).length,
        playerCount: (playersRes.data || []).filter(p => p.org_id === id).length,
        gameCount:   (gamesRes.data   || []).filter(g => g.org_id === id).length,
        seasons:     (seasonsRes.data || []).filter(s => s.org_id === id),
        recentGames: orgGames.slice(0, 3),
      };
    }
    setOrgData(data);
    setLoading(false);
  }

  if (authLoading || loading) return (
    <div style={{ fontFamily: "system-ui, sans-serif", minHeight: "100%", background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 14, color: "#aaa" }}>Loading…</div>
    </div>
  );

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", minHeight: "100%", background: "#f5f5f5" }}>

      {/* Section header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #eee", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 20px 20px" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                Organizations
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: 0, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
                Your Orgs
              </h1>
            </div>
            <button
              onClick={() => navigate("/orgs/new")}
              style={{ padding: "9px 18px", fontSize: 13, fontWeight: 700, background: "#111", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
            >
              + New Org
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "28px 20px" }}>

        {orgMemberships.length === 0 ? (
          /* Empty state */
          <div style={{
            background: "#fff", border: "1px solid #e8e8e8", borderRadius: 18,
            padding: "56px 32px", textAlign: "center",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          }}>
            <div style={{ fontSize: 44, marginBottom: 18 }}>🥍</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#111", marginBottom: 10, letterSpacing: "-0.02em" }}>
              No organizations yet
            </div>
            <div style={{ fontSize: 14, color: "#888", marginBottom: 28, lineHeight: 1.7, maxWidth: 340, margin: "0 auto 28px" }}>
              Create an org to manage teams, seasons, and stats across multiple scorekeepers — or ask your league admin for an invite.
            </div>
            <button
              onClick={() => navigate("/orgs/new")}
              style={{ padding: "12px 28px", fontSize: 15, fontWeight: 700, background: "#111", color: "#fff", border: "none", borderRadius: 12, cursor: "pointer" }}
            >
              Create your first org →
            </button>
          </div>
        ) : (
          <>
            {/* Summary bar — only useful with 2+ orgs */}
            {orgMemberships.length >= 2 && Object.keys(orgData).length > 0 && (
              <SummaryBar memberships={orgMemberships} orgData={orgData} />
            )}

            {orgMemberships.map(m => (
              <OrgCard
                key={m.org_id}
                membership={m}
                data={orgData[m.org_id]}
                navigate={navigate}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
