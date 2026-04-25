import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useOrgRole } from "../hooks/useOrgRole";

function parseDate(str) {
  return str?.length === 10 ? new Date(str + "T12:00:00") : new Date(str);
}
function formatDate(str) {
  if (!str) return "";
  return parseDate(str).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const S = {
  page:   { fontFamily: "system-ui, sans-serif", minHeight: "100vh", background: "#f5f5f5" },
  wrap:   { maxWidth: 600, margin: "0 auto", padding: "32px 20px" },
  back:   { fontSize: 13, color: "#888", background: "none", border: "none", cursor: "pointer", padding: "0 0 20px", display: "block" },
  h1:     { fontSize: 24, fontWeight: 800, color: "#111", margin: "0 0 4px", letterSpacing: "-0.02em" },
  sub:    { fontSize: 13, color: "#888", margin: "0 0 28px" },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", margin: "24px 0 10px" },
  card:   { background: "#fff", border: "1px solid #e8e8e8", borderRadius: 14, overflow: "hidden", marginBottom: 10, boxShadow: "0 1px 6px rgba(0,0,0,0.05)" },
  err:    { background: "#fff5f5", border: "1px solid #fdd", borderRadius: 10, padding: "10px 14px", color: "#c0392b", fontSize: 13, marginBottom: 16 },
};

function GameStatusBadge({ game }) {
  const s = game.state;
  const started = s?.trackingStarted;
  const gameOver = s?.gameOver;
  if (gameOver)  return <span style={{ fontSize: 11, fontWeight: 600, color: "#888", background: "#f0f0f0", borderRadius: 20, padding: "3px 9px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Final</span>;
  if (started)   return <span style={{ fontSize: 11, fontWeight: 700, color: "#2a7a3b", background: "#eaf6ec", borderRadius: 20, padding: "3px 9px" }}>● Live</span>;
  return <span style={{ fontSize: 11, fontWeight: 600, color: "#d4820a", background: "#fff8ec", borderRadius: 20, padding: "3px 9px" }}>Scheduled</span>;
}

function GameRow({ game, navigate }) {
  const s = game.state;
  const homeTeam = game.home_team;
  const awayTeam = game.away_team;
  const homeColor = homeTeam?.color || "#444";
  const awayColor = awayTeam?.color || "#888";

  // Score from state (v1 JSONB)
  const log = s?.log || [];
  const homeScore = log.filter(e => e.event === "goal" && e.teamIdx === 0).length;
  const awayScore  = log.filter(e => e.event === "goal" && e.teamIdx === 1).length;
  const hasScore = s?.trackingStarted;

  return (
    <div style={S.card}>
      <div style={{ height: 4, background: `linear-gradient(90deg, ${homeColor} 50%, ${awayColor} 50%)` }} />
      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {hasScore ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 6 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: homeColor }}>{homeTeam?.name ?? "Home"}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: homeScore >= awayScore ? homeColor : "#bbb", fontVariantNumeric: "tabular-nums" }}>{homeScore}</span>
                <span style={{ fontSize: 14, color: "#ddd" }}>–</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: awayScore >= homeScore ? awayColor : "#bbb", fontVariantNumeric: "tabular-nums" }}>{awayScore}</span>
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: awayColor, textAlign: "right" }}>{awayTeam?.name ?? "Away"}</div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: homeColor }}>{homeTeam?.name ?? "Home"}</span>
              <span style={{ fontSize: 13, color: "#ccc" }}>vs</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: awayColor }}>{awayTeam?.name ?? "Away"}</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
          <GameStatusBadge game={game} />
          <span style={{ fontSize: 11, color: "#bbb" }}>{formatDate(game.game_date || game.created_at)}</span>
        </div>
      </div>
      <div style={{ padding: "0 16px 12px", display: "flex", gap: 6 }}>
        <button onClick={() => navigate(`/games/${game.id}/view`)}
          style={{ padding: "5px 12px", fontSize: 12, background: "transparent", border: "1px solid #ddd", borderRadius: 7, cursor: "pointer", color: "#555" }}>
          View
        </button>
        <button onClick={() => window.open(`/games/${game.id}/pressbox`, "_blank")}
          style={{ padding: "5px 12px", fontSize: 12, background: "transparent", border: "1px solid #ddd", borderRadius: 7, cursor: "pointer", color: "#555" }}>
          Press Box
        </button>
      </div>
    </div>
  );
}

function StandingsTable({ teamStats }) {
  if (!teamStats.length) return (
    <div style={{ fontSize: 13, color: "#aaa", textAlign: "center", padding: "20px 0" }}>
      Standings will appear once games are completed.
    </div>
  );

  const sorted = [...teamStats].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    const pctA = a.wins + a.losses > 0 ? a.wins / (a.wins + a.losses) : 0;
    const pctB = b.wins + b.losses > 0 ? b.wins / (b.wins + b.losses) : 0;
    return pctB - pctA;
  });

  return (
    <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr repeat(4, 40px)", gap: 0, padding: "8px 16px", background: "#f7f7f7", borderBottom: "1px solid #eee" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em" }}>Team</span>
        {["W", "L", "GF", "GA"].map(h => (
          <span key={h} style={{ fontSize: 11, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>{h}</span>
        ))}
      </div>
      {sorted.map((row, i) => (
        <div key={row.team_id} style={{ display: "grid", gridTemplateColumns: "1fr repeat(4, 40px)", gap: 0, padding: "10px 16px", borderBottom: i < sorted.length - 1 ? "1px solid #f5f5f5" : "none", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: row.team_color || "#888", flexShrink: 0 }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>{row.team_name}</span>
          </div>
          <span style={{ fontSize: 14, color: "#111", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{row.wins}</span>
          <span style={{ fontSize: 14, color: "#888", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{row.losses}</span>
          <span style={{ fontSize: 14, color: "#555", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{row.goals_for}</span>
          <span style={{ fontSize: 14, color: "#888", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{row.goals_against}</span>
        </div>
      ))}
    </div>
  );
}

function StatLeaders({ playerStats }) {
  if (!playerStats.length) return (
    <div style={{ fontSize: 13, color: "#aaa", textAlign: "center", padding: "20px 0" }}>
      Stat leaders will appear once games are scored.
    </div>
  );

  const topGoals   = [...playerStats].sort((a, b) => b.goals - a.goals).slice(0, 5).filter(p => p.goals > 0);
  const topAssists = [...playerStats].sort((a, b) => b.assists - a.assists).slice(0, 5).filter(p => p.assists > 0);

  function LeaderList({ title, players, statKey, statLabel }) {
    if (!players.length) return null;
    return (
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>{title}</div>
        {players.map((p, i) => (
          <div key={`${p.player_id}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid #f5f5f5" }}>
            <span style={{ fontSize: 12, color: "#bbb", width: 16, textAlign: "right" }}>{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.display_name}</div>
              <div style={{ fontSize: 11, color: "#aaa" }}>{p.team_name}</div>
            </div>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#111", fontVariantNumeric: "tabular-nums" }}>{p[statKey]}</span>
            <span style={{ fontSize: 11, color: "#aaa", width: 24 }}>{statLabel}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
      <LeaderList title="Goals" players={topGoals} statKey="goals" statLabel="G" />
      <LeaderList title="Assists" players={topAssists} statKey="assists" statLabel="A" />
    </div>
  );
}

export default function SeasonView() {
  const { slug, id } = useParams();
  const navigate = useNavigate();
  const [org, setOrg] = useState(null);
  const [season, setSeason] = useState(null);
  const [games, setGames] = useState([]);
  const [teamStats, setTeamStats] = useState([]);
  const [playerStats, setPlayerStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { canView } = useOrgRole(org?.id);

  useEffect(() => { load(); }, [slug, id]);

  async function load() {
    setLoading(true);
    setError(null);

    // Load org
    const { data: orgData, error: orgErr } = await supabase
      .from("organizations")
      .select("id, name, slug")
      .eq("slug", slug)
      .single();
    if (orgErr || !orgData) { setError("Organization not found."); setLoading(false); return; }
    setOrg(orgData);

    // Load season
    const { data: seasonData, error: seasonErr } = await supabase
      .from("seasons")
      .select("id, name, start_date, end_date")
      .eq("id", id)
      .eq("org_id", orgData.id)
      .single();
    if (seasonErr || !seasonData) { setError("Season not found."); setLoading(false); return; }
    setSeason(seasonData);

    // Load games for this season
    const { data: gamesData } = await supabase
      .from("games")
      .select("id, name, state, created_at, game_date, game_type, home_team_id, away_team_id, home_team:teams!home_team_id(id, name, color), away_team:teams!away_team_id(id, name, color)")
      .eq("season_id", id)
      .order("created_at", { ascending: false });
    setGames(gamesData || []);

    // Try to load standings from materialized view (may be empty)
    const { data: tsData } = await supabase
      .from("v_season_team_stats")
      .select("*")
      .eq("season_id", id);
    setTeamStats(tsData || []);

    // Try to load stat leaders from materialized view
    const { data: psData } = await supabase
      .from("v_season_player_stats")
      .select("*")
      .eq("season_id", id)
      .order("goals", { ascending: false });
    setPlayerStats(psData || []);

    setLoading(false);
  }

  if (loading) return (
    <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 14, color: "#888" }}>Loading…</div>
    </div>
  );

  if (error) return (
    <div style={S.page}>
      <div style={S.wrap}>
        <button style={S.back} onClick={() => navigate(-1)}>← Back</button>
        <div style={S.err}>{error}</div>
      </div>
    </div>
  );

  const upcoming = games.filter(g => !g.state?.trackingStarted);
  const inProgress = games.filter(g => g.state?.trackingStarted && !g.state?.gameOver);
  const completed = games.filter(g => g.state?.gameOver);

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <button style={S.back} onClick={() => navigate(`/orgs/${slug}`)}>← {org?.name}</button>

        <h1 style={S.h1}>{season?.name}</h1>
        <p style={S.sub}>
          {season?.start_date && season?.end_date
            ? `${formatDate(season.start_date)} – ${formatDate(season.end_date)}`
            : org?.name}
        </p>

        {/* Standings */}
        <div style={S.sectionTitle}>Standings</div>
        <StandingsTable teamStats={teamStats} />

        {/* Games */}
        {inProgress.length > 0 && (
          <>
            <div style={{ ...S.sectionTitle, color: "#2a7a3b" }}>● Live</div>
            {inProgress.map(g => <GameRow key={g.id} game={g} navigate={navigate} />)}
          </>
        )}

        {upcoming.length > 0 && (
          <>
            <div style={S.sectionTitle}>Schedule</div>
            {upcoming.map(g => <GameRow key={g.id} game={g} navigate={navigate} />)}
          </>
        )}

        {completed.length > 0 && (
          <>
            <div style={S.sectionTitle}>Results</div>
            {completed.map(g => <GameRow key={g.id} game={g} navigate={navigate} />)}
          </>
        )}

        {games.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#aaa", fontSize: 14 }}>
            No games yet for this season.
          </div>
        )}

        {/* Stat Leaders */}
        <div style={S.sectionTitle}>Stat Leaders</div>
        <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 14, padding: "16px" }}>
          <StatLeaders playerStats={playerStats} />
        </div>
      </div>
    </div>
  );
}
