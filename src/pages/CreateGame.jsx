import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

const PRESET_COLORS = ["#1a6bab","#b84e1a","#2a7a3b","#8b1a8b","#c0392b","#d4820a","#1a7a7a","#555","#1a2e8b","#8b3a1a"];
const GAME_TYPES = [
  { id: "regular",    label: "Regular Season" },
  { id: "playoff",    label: "Playoff" },
  { id: "tournament", label: "Tournament" },
  { id: "scrimmage",  label: "Scrimmage" },
];

const S = {
  page:    { fontFamily: "system-ui, sans-serif", minHeight: "100vh", background: "#f5f5f5" },
  wrap:    { maxWidth: 480, margin: "0 auto", padding: "32px 20px" },
  back:    { fontSize: 13, color: "#888", background: "none", border: "none", cursor: "pointer", padding: "0 0 28px", display: "block" },
  h1:      { fontSize: 24, fontWeight: 800, color: "#111", margin: "0 0 24px", letterSpacing: "-0.02em" },
  label:   { display: "block", fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, marginTop: 18 },
  input:   { width: "100%", padding: "10px 12px", fontSize: 14, border: "1px solid #e0e0e0", borderRadius: 10, background: "#fff", boxSizing: "border-box", fontFamily: "system-ui, sans-serif" },
  select:  { width: "100%", padding: "10px 12px", fontSize: 14, border: "1px solid #e0e0e0", borderRadius: 10, background: "#fff", boxSizing: "border-box", fontFamily: "system-ui, sans-serif", appearance: "none" },
  btn:     { width: "100%", padding: "13px", fontSize: 15, fontWeight: 700, background: "#111", color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", marginTop: 24 },
  btnGray: { width: "100%", padding: "13px", fontSize: 15, fontWeight: 700, background: "#f0f0f0", color: "#555", border: "none", borderRadius: 12, cursor: "pointer", marginTop: 12 },
  bigChoice: {
    width: "100%", padding: "20px 16px", textAlign: "left",
    background: "#fff", border: "1px solid #e0e0e0", borderRadius: 14,
    cursor: "pointer", marginBottom: 12, boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
  },
  err: { background: "#fff5f5", border: "1px solid #fdd", borderRadius: 10, padding: "10px 14px", color: "#c0392b", fontSize: 13, marginBottom: 16 },
};

export default function CreateGame() {
  const navigate = useNavigate();
  const { user, orgMemberships } = useAuth();

  // step: "choice" | "org-org" | "org-season" | "org-teams" | "org-details" | "creating"
  const [step, setStep]         = useState(orgMemberships.length > 0 ? "choice" : "creating-personal");
  const [error, setError]       = useState(null);

  // Org wizard state
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [seasons, setSeasons]         = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [newSeasonName, setNewSeasonName]   = useState("");
  const [teams, setTeams]               = useState([]);
  const [homeTeamId, setHomeTeamId]     = useState("");
  const [awayTeamId, setAwayTeamId]     = useState("");
  const [newHomeName, setNewHomeName]   = useState("");
  const [newHomeColor, setNewHomeColor] = useState(PRESET_COLORS[0]);
  const [newAwayName, setNewAwayName]   = useState("");
  const [newAwayColor, setNewAwayColor] = useState(PRESET_COLORS[1]);
  const [gameDate, setGameDate]         = useState(new Date().toISOString().slice(0, 10));
  const [gameType, setGameType]         = useState("regular");

  // Auto-create personal game on mount if no org memberships
  useEffect(() => {
    if (step === "creating-personal") createPersonalGame();
  }, []);

  async function createPersonalGame() {
    const name = `Game — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    const { data, error: err } = await supabase
      .from("games")
      .insert({ name, state: null, user_id: user.id, schema_ver: 2 })
      .select("id").single();
    if (err) { setError(err.message); setStep("choice"); return; }
    navigate(`/games/${data.id}/score`);
  }

  async function handlePersonalChoice() {
    setStep("creating-personal");
    await createPersonalGame();
  }

  // ── Org wizard ──────────────────────────────────────────────────────────────

  async function selectOrg(membership) {
    setSelectedOrg(membership);
    setError(null);
    const { data } = await supabase
      .from("seasons")
      .select("id, name, start_date, end_date")
      .eq("org_id", membership.org_id)
      .order("start_date", { ascending: false });
    setSeasons(data || []);
    setStep("org-season");
  }

  async function handleSeasonNext() {
    setError(null);
    let season = selectedSeason;

    if (!season && newSeasonName.trim()) {
      const { data, error: err } = await supabase
        .from("seasons")
        .insert({ org_id: selectedOrg.org_id, name: newSeasonName.trim() })
        .select("id, name").single();
      if (err) { setError(err.message); return; }
      season = data;
      setSelectedSeason(data);
    }

    if (!season) { setError("Select or create a season."); return; }

    const { data } = await supabase
      .from("teams")
      .select("id, name, color")
      .eq("org_id", selectedOrg.org_id)
      .order("name");
    setTeams(data || []);
    setStep("org-teams");
  }

  async function handleTeamsNext() {
    setError(null);
    let homeId = homeTeamId;
    let awayId = awayTeamId;

    if (!homeId && newHomeName.trim()) {
      const { data, error: err } = await supabase
        .from("teams")
        .insert({ org_id: selectedOrg.org_id, name: newHomeName.trim(), color: newHomeColor })
        .select("id").single();
      if (err) { setError(err.message); return; }
      homeId = data.id;
    }
    if (!awayId && newAwayName.trim()) {
      const { data, error: err } = await supabase
        .from("teams")
        .insert({ org_id: selectedOrg.org_id, name: newAwayName.trim(), color: newAwayColor })
        .select("id").single();
      if (err) { setError(err.message); return; }
      awayId = data.id;
    }

    if (!homeId || !awayId) { setError("Select or create both teams."); return; }
    setHomeTeamId(homeId);
    setAwayTeamId(awayId);
    setStep("org-details");
  }

  async function handleCreateOrgGame() {
    setError(null);
    const homeTeam = teams.find(t => t.id === homeTeamId);
    const awayTeam = teams.find(t => t.id === awayTeamId);
    const name = homeTeam && awayTeam ? `${homeTeam.name} vs ${awayTeam.name}` : "Game";

    const { data, error: err } = await supabase
      .from("games")
      .insert({
        name,
        state: null,
        user_id: user.id,
        org_id: selectedOrg.org_id,
        season_id: selectedSeason?.id ?? null,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        game_type: gameType,
        game_date: gameDate || null,
        schema_ver: 2,
      })
      .select("id").single();

    if (err) { setError(err.message); return; }
    navigate(`/games/${data.id}/score`);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (step === "creating-personal") {
    return (
      <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 14, color: "#888" }}>Creating game…</div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <button style={S.back} onClick={() => navigate("/")}>← Back</button>

        {error && <div style={S.err}>{error}</div>}

        {/* ── Step: choice ── */}
        {step === "choice" && (
          <>
            <h1 style={S.h1}>New Game</h1>
            <button style={S.bigChoice} onClick={handlePersonalChoice}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#111", marginBottom: 4 }}>Personal game</div>
              <div style={{ fontSize: 13, color: "#888" }}>Just for you — no org or season required</div>
            </button>
            {orgMemberships.map(m => (
              <button key={m.org_id} style={S.bigChoice} onClick={() => selectOrg(m)}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#111", marginBottom: 4 }}>
                  {m.org?.name ?? "Org game"}
                </div>
                <div style={{ fontSize: 13, color: "#888" }}>
                  {m.role === "org_admin" ? "Admin" : m.role.charAt(0).toUpperCase() + m.role.slice(1)} · /orgs/{m.org?.slug}
                </div>
              </button>
            ))}
          </>
        )}

        {/* ── Step: pick / create season ── */}
        {step === "org-season" && (
          <>
            <h1 style={S.h1}>Season</h1>
            {seasons.length > 0 && (
              <>
                <span style={S.label}>Select an existing season</span>
                {seasons.map(s => (
                  <button key={s.id}
                    onClick={() => { setSelectedSeason(s); setNewSeasonName(""); }}
                    style={{
                      ...S.bigChoice,
                      border: selectedSeason?.id === s.id ? "2px solid #111" : "1px solid #e0e0e0",
                      padding: "14px 16px",
                    }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#111" }}>{s.name}</div>
                  </button>
                ))}
                <div style={{ textAlign: "center", color: "#bbb", fontSize: 13, margin: "8px 0" }}>or</div>
              </>
            )}
            <span style={{ ...S.label, marginTop: 0 }}>Create a new season</span>
            <input style={S.input} value={newSeasonName}
              onChange={e => { setNewSeasonName(e.target.value); setSelectedSeason(null); }}
              placeholder="Spring 2026" />
            <button style={{ ...S.btn, opacity: (!selectedSeason && !newSeasonName.trim()) ? 0.4 : 1 }}
              disabled={!selectedSeason && !newSeasonName.trim()}
              onClick={handleSeasonNext}>Next →</button>
            <button style={S.btnGray} onClick={() => setStep("choice")}>← Back</button>
          </>
        )}

        {/* ── Step: pick / create teams ── */}
        {step === "org-teams" && (
          <>
            <h1 style={S.h1}>Teams</h1>

            <span style={S.label}>Home team</span>
            {teams.length > 0 && (
              <select style={S.select} value={homeTeamId} onChange={e => setHomeTeamId(e.target.value)}>
                <option value="">— Select —</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                <option value="">— New team below —</option>
              </select>
            )}
            {!homeTeamId && (
              <>
                <input style={{ ...S.input, marginTop: 8 }} value={newHomeName}
                  onChange={e => setNewHomeName(e.target.value)} placeholder="Home team name" />
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  {PRESET_COLORS.map(c => (
                    <div key={c} onClick={() => setNewHomeColor(c)}
                      style={{ width: 24, height: 24, borderRadius: "50%", background: c, cursor: "pointer",
                        border: newHomeColor === c ? "3px solid #111" : "2px solid transparent",
                        boxSizing: "border-box", boxShadow: newHomeColor === c ? "none" : "0 0 0 1px #ddd" }} />
                  ))}
                </div>
              </>
            )}

            <span style={S.label}>Away team</span>
            {teams.length > 0 && (
              <select style={S.select} value={awayTeamId} onChange={e => setAwayTeamId(e.target.value)}>
                <option value="">— Select —</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                <option value="">— New team below —</option>
              </select>
            )}
            {!awayTeamId && (
              <>
                <input style={{ ...S.input, marginTop: 8 }} value={newAwayName}
                  onChange={e => setNewAwayName(e.target.value)} placeholder="Away team name" />
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  {PRESET_COLORS.map(c => (
                    <div key={c} onClick={() => setNewAwayColor(c)}
                      style={{ width: 24, height: 24, borderRadius: "50%", background: c, cursor: "pointer",
                        border: newAwayColor === c ? "3px solid #111" : "2px solid transparent",
                        boxSizing: "border-box", boxShadow: newAwayColor === c ? "none" : "0 0 0 1px #ddd" }} />
                  ))}
                </div>
              </>
            )}

            <button style={{ ...S.btn, opacity: ((!homeTeamId && !newHomeName.trim()) || (!awayTeamId && !newAwayName.trim())) ? 0.4 : 1 }}
              disabled={(!homeTeamId && !newHomeName.trim()) || (!awayTeamId && !newAwayName.trim())}
              onClick={handleTeamsNext}>Next →</button>
            <button style={S.btnGray} onClick={() => setStep("org-season")}>← Back</button>
          </>
        )}

        {/* ── Step: date + game type ── */}
        {step === "org-details" && (
          <>
            <h1 style={S.h1}>Game Details</h1>

            <span style={S.label}>Date</span>
            <input type="date" style={S.input} value={gameDate} onChange={e => setGameDate(e.target.value)} />

            <span style={S.label}>Game type</span>
            <select style={S.select} value={gameType} onChange={e => setGameType(e.target.value)}>
              {GAME_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>

            <button style={S.btn} onClick={handleCreateOrgGame}>Create Game →</button>
            <button style={S.btnGray} onClick={() => setStep("org-teams")}>← Back</button>
          </>
        )}
      </div>
    </div>
  );
}
