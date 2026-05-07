import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useOrgRole } from "../hooks/useOrgRole";
import { useDocTitle } from "../hooks/useDocTitle";

function parseDate(str) {
  return str?.length === 10 ? new Date(str + "T12:00:00") : new Date(str);
}
function formatDate(str) {
  if (!str) return "";
  return parseDate(str).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const S = {
  page:   { fontFamily: "system-ui, sans-serif", minHeight: "100%", background: "#f5f5f5" },
  wrap:   { maxWidth: 600, margin: "0 auto", padding: "0 20px 32px" },
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

function GameRow({ game, navigate, hasPressbox, v2Scores }) {
  const s = game.state;
  const homeTeam = game.home_team;
  const awayTeam = game.away_team;
  const homeColor = homeTeam?.color || "#444";
  const awayColor = awayTeam?.color || "#888";

  const homeScore = v2Scores?.[game.id]?.[0] ?? 0;
  const awayScore  = v2Scores?.[game.id]?.[1] ?? 0;
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
        {hasPressbox && (
          <button onClick={() => window.open(`/games/${game.id}/pressbox`, "_blank")}
            style={{ padding: "5px 12px", fontSize: 12, background: "transparent", border: "1px solid #ddd", borderRadius: 7, cursor: "pointer", color: "#555" }}>
            Press Box
          </button>
        )}
      </div>
    </div>
  );
}

function StatLeaders({ playerStats }) {
  if (!playerStats.length) return (
    <div style={{ fontSize: 13, color: "#aaa", textAlign: "center", padding: "20px 0" }}>
      Stat leaders will appear once games are scored.
    </div>
  );

  const top = (key, n = 5) => [...playerStats].sort((a, b) => b[key] - a[key]).slice(0, n).filter(p => p[key] > 0);

  const categories = [
    { title: "Goals",         key: "goals",         label: "G"  },
    { title: "Assists",       key: "assists",        label: "A"  },
    { title: "Points",        key: "points",         label: "Pts" },
    { title: "Shots on Goal", key: "sog",            label: "SOG" },
    { title: "Ground Balls",  key: "ground_balls",   label: "GB" },
    { title: "Faceoff Wins",  key: "faceoff_wins",   label: "FO" },
    { title: "Saves",         key: "saves",          label: "SV" },
  ];

  function LeaderList({ title, players, statKey, statLabel }) {
    if (!players.length) return null;
    return (
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>{title}</div>
        {players.map((p, i) => (
            <div key={`${p.player_id ?? p.player_name}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid #f5f5f5" }}>
              <span style={{ fontSize: 12, color: "#bbb", width: 16, textAlign: "right" }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.player_name}</div>
              </div>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#111", fontVariantNumeric: "tabular-nums" }}>{p[statKey]}</span>
              <span style={{ fontSize: 11, color: "#aaa", width: 28 }}>{statLabel}</span>
            </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
      {categories.map(({ title, key, label }) => {
        const players = top(key);
        if (!players.length) return null;
        return <LeaderList key={key} title={title} players={players} statKey={key} statLabel={label} />;
      })}
    </div>
  );
}

function Standings({ teamStats }) {
  if (!teamStats.length) return null;

  // Aggregate home+away rows per team
  const byTeam = {};
  teamStats.forEach(r => {
    if (!byTeam[r.team_id]) {
      byTeam[r.team_id] = { team_id: r.team_id, team_name: r.team_name, team_color: r.team_color, games_played: 0, wins: 0, losses: 0, goals_for: 0, goals_against: 0 };
    }
    const t = byTeam[r.team_id];
    t.games_played += Number(r.games_played);
    t.wins         += Number(r.wins);
    t.losses       += Number(r.losses);
    t.goals_for    += Number(r.goals_for);
    t.goals_against+= Number(r.goals_against);
  });
  const rows = Object.values(byTeam).sort((a, b) => b.wins - a.wins || (b.goals_for - b.goals_against) - (a.goals_for - a.goals_against));

  const colH = { fontSize: 11, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", padding: "10px 8px", textAlign: "center" };
  const cell = { padding: "10px 8px", textAlign: "center", fontSize: 13, fontWeight: 600, color: "#111", fontVariantNumeric: "tabular-nums" };

  return (
    <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr repeat(5, 44px)", borderBottom: "2px solid #f0f0f0" }}>
        <div style={{ ...colH, textAlign: "left", padding: "10px 16px" }}>Team</div>
        <div style={colH}>W</div>
        <div style={colH}>L</div>
        <div style={colH}>GF</div>
        <div style={colH}>GA</div>
        <div style={colH}>+/-</div>
      </div>
      {rows.map((t, i) => (
        <div key={t.team_id} style={{ display: "grid", gridTemplateColumns: "1fr repeat(5, 44px)", background: i % 2 === 0 ? "#fff" : "#fafafa", borderBottom: i < rows.length - 1 ? "1px solid #f5f5f5" : "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px" }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: t.team_color || "#888", flexShrink: 0 }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>{t.team_name}</span>
          </div>
          <div style={cell}>{t.wins}</div>
          <div style={cell}>{t.losses}</div>
          <div style={cell}>{t.goals_for}</div>
          <div style={cell}>{t.goals_against}</div>
          <div style={{ ...cell, color: t.goals_for - t.goals_against >= 0 ? "#2a7a3b" : "#c0392b" }}>
            {t.goals_for - t.goals_against > 0 ? "+" : ""}{t.goals_for - t.goals_against}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SeasonView() {
  const { slug, id } = useParams();
  const navigate = useNavigate();
  const [org, setOrg] = useState(null);
  const [season, setSeason] = useState(null);
  useDocTitle(season ? (org ? `${season.name} · ${org.name}` : season.name) : null);
  const [games, setGames] = useState([]);
  const [v2Scores, setV2Scores] = useState({});
  const [playerStats, setPlayerStats] = useState([]);
  const [teamStats, setTeamStats] = useState([]);
  const [hasPressbox, setHasPressbox] = useState(false);
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

    // Check pressbox feature for this org
    const { data: pbLimit } = await supabase.rpc("org_feature_limit", {
      p_org_id: orgData.id, p_feature_id: "pressbox",
    });
    setHasPressbox(pbLimit !== 0);

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
      .select("id, name, state, schema_ver, created_at, game_date, game_type, home_team_id, away_team_id, home_team:teams!home_team_id(id, name, color), away_team:teams!away_team_id(id, name, color)")
      .or(`season_id.eq.${id},away_season_id.eq.${id}`)
      .order("created_at", { ascending: false });
    const allGames = gamesData || [];
    setGames(allGames);

    if (allGames.length > 0) {
      const { data: totals } = await supabase
        .from("v_game_team_totals")
        .select("game_id, team_idx, goals")
        .in("game_id", allGames.map(g => g.id));
      const scoreMap = {};
      (totals || []).forEach(r => {
        if (!scoreMap[r.game_id]) scoreMap[r.game_id] = [0, 0];
        scoreMap[r.game_id][r.team_idx] = r.goals;
      });
      setV2Scores(scoreMap);
    }

    // Load stat leaders
    const { data: psData } = await supabase
      .from("v_season_player_stats")
      .select("*")
      .eq("season_id", id)
      .order("goals", { ascending: false });
    setPlayerStats(psData || []);

    // Load team standings
    const { data: tsData } = await supabase
      .from("v_season_team_stats")
      .select("team_id, team_name, team_color, games_played, wins, losses, goals_for, goals_against")
      .eq("season_id", id);
    setTeamStats(tsData || []);

    setLoading(false);
  }

  if (loading) return (
    <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 14, color: "#888" }}>Loading…</div>
    </div>
  );

  if (error) return (
    <div style={S.page}>
      <div style={{ ...S.wrap, paddingTop: 24 }}>
        <button style={S.back} onClick={() => navigate(-1)}>← Back</button>
        <div style={S.err}>{error}</div>
      </div>
    </div>
  );

  const upcoming   = games.filter(g => !g.state?.trackingStarted);
  const inProgress = games.filter(g => g.state?.trackingStarted && !g.state?.gameOver);
  const completed  = games.filter(g => g.state?.gameOver);

  return (
    <div style={S.page}>
      {/* Sticky hero */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "#f5f5f5", borderBottom: "1px solid #e8e8e8" }}>
        <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px 20px 12px" }}>
          <button style={{ ...S.back, padding: "0 0 8px" }} onClick={() => navigate(`/orgs/${slug}`)}>← {org?.name}</button>

          <h1 style={{ ...S.h1, marginBottom: 2 }}>{season?.name}</h1>
          <p style={S.sub}>
            {season?.start_date && season?.end_date
              ? `${formatDate(season.start_date)} – ${formatDate(season.end_date)}`
              : org?.name}
          </p>
        </div>
      </div>

      <div style={S.wrap}>

        {/* Games */}
        {inProgress.length > 0 && (
          <>
            <div style={{ ...S.sectionTitle, color: "#2a7a3b" }}>● Live</div>
            {inProgress.map(g => <GameRow key={g.id} game={g} navigate={navigate} hasPressbox={hasPressbox} v2Scores={v2Scores} />)}
          </>
        )}

        {upcoming.length > 0 && (
          <>
            <div style={S.sectionTitle}>Schedule</div>
            {upcoming.map(g => <GameRow key={g.id} game={g} navigate={navigate} hasPressbox={hasPressbox} v2Scores={v2Scores} />)}
          </>
        )}

        {completed.length > 0 && (
          <>
            <div style={S.sectionTitle}>Results</div>
            {completed.map(g => <GameRow key={g.id} game={g} navigate={navigate} hasPressbox={hasPressbox} v2Scores={v2Scores} />)}
          </>
        )}

        {games.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#aaa", fontSize: 14 }}>
            No games yet for this season.
          </div>
        )}

        {/* Standings */}
        {teamStats.length > 0 && (
          <>
            <div style={S.sectionTitle}>Standings</div>
            <Standings teamStats={teamStats} />
          </>
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
