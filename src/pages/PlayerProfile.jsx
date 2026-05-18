import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useDocTitle } from "../hooks/useDocTitle";

const S = {
  page:   { fontFamily: "system-ui, sans-serif", minHeight: "100%", background: "#f5f5f5" },
  wrap:   { maxWidth: 600, margin: "0 auto", padding: "0 20px 32px" },
  back:   { fontSize: 13, color: "#888", background: "none", border: "none", cursor: "pointer", padding: "16px 0 20px", display: "block" },
  h1:     { fontSize: 24, fontWeight: 800, color: "#111", margin: "0 0 4px", letterSpacing: "-0.02em" },
  sub:    { fontSize: 13, color: "#888", margin: "0 0 28px" },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", margin: "24px 0 10px" },
  card:   { background: "#fff", border: "1px solid #e8e8e8", borderRadius: 14, overflow: "hidden", marginBottom: 10, boxShadow: "0 1px 6px rgba(0,0,0,0.05)" },
  statGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px", background: "#f0f0f0" },
  statBox: { background: "#fff", padding: "16px", textAlign: "center" },
  statVal: { fontSize: 20, fontWeight: 700, color: "#111", display: "block" },
  statLbl: { fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 4 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "10px 12px", borderBottom: "2px solid #f0f0f0", color: "#888", fontWeight: 700, textTransform: "uppercase", fontSize: 10, letterSpacing: "0.05em" },
  td: { padding: "12px", borderBottom: "1px solid #f5f5f5", color: "#111" },
  num: { fontVariantNumeric: "tabular-nums", fontWeight: 600 }
};

function StatBox({ label, value }) {
  return (
    <div style={S.statBox}>
      <span style={S.statVal}>{value}</span>
      <span style={S.statLbl}>{label}</span>
    </div>
  );
}

export default function PlayerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [player, setPlayer] = useState(null);
  const [careerStats, setCareerStats] = useState(null);
  const [seasonStats, setSeasonStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useDocTitle(player ? `${player.name} · Player Profile` : "Player Profile");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: pData } = await supabase.from("players").select("id, name").eq("id", id).single();
      setPlayer(pData);

      const { data: cData } = await supabase.from("v_career_player_stats").select("*").eq("player_id", id).single();
      setCareerStats(cData);

      const { data: sData } = await supabase
        .from("v_season_player_stats")
        .select(`
          *,
          seasons:season_id(name)
        `)
        .eq("player_id", id);
      
      // Sort seasons by name descending (assuming names like "2024", "2023 Spring" etc)
      const sorted = (sData || []).sort((a, b) => (b.seasons?.name || "").localeCompare(a.seasons?.name || ""));
      setSeasonStats(sorted);
      
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ fontSize: 14, color: "#888" }}>Loading…</div></div>;
  if (!player) return <div style={S.page}><div style={S.wrap}><button style={S.back} onClick={() => navigate(-1)}>← Back</button><div style={{ textAlign: "center", padding: 40, color: "#888" }}>Player not found.</div></div></div>;

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <button style={S.back} onClick={() => navigate(-1)}>← Back</button>
        <h1 style={S.h1}>{player.name}</h1>
        <p style={S.sub}>Career Player Profile</p>

        <div style={S.sectionTitle}>Career Totals</div>
        <div style={S.card}>
          <div style={S.statGrid}>
            <StatBox label="Games" value={careerStats?.games_played || 0} />
            <StatBox label="Goals" value={careerStats?.goals || 0} />
            <StatBox label="Assists" value={careerStats?.assists || 0} />
            <StatBox label="Points" value={careerStats?.points || 0} />
            <StatBox label="SOG" value={careerStats?.sog || 0} />
            <StatBox label="Ground Balls" value={careerStats?.ground_balls || 0} />
          </div>
        </div>

        <div style={S.sectionTitle}>Season Progression</div>
        <div style={{ ...S.card, overflowX: "auto" }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Season</th>
                <th style={{ ...S.th, textAlign: "center" }}>G</th>
                <th style={{ ...S.th, textAlign: "center" }}>A</th>
                <th style={{ ...S.th, textAlign: "center" }}>Pts</th>
                <th style={{ ...S.th, textAlign: "center" }}>GB</th>
                <th style={{ ...S.th, textAlign: "center" }}>SOG</th>
              </tr>
            </thead>
            <tbody>
              {seasonStats.map(s => (
                <tr key={s.season_id}>
                  <td style={S.td}><strong>{s.seasons?.name || "Unknown"}</strong></td>
                  <td style={{ ...S.td, ...S.num, textAlign: "center" }}>{s.goals}</td>
                  <td style={{ ...S.td, ...S.num, textAlign: "center" }}>{s.assists}</td>
                  <td style={{ ...S.td, ...S.num, textAlign: "center" }}>{s.points}</td>
                  <td style={{ ...S.td, ...S.num, textAlign: "center" }}>{s.ground_balls}</td>
                  <td style={{ ...S.td, ...S.num, textAlign: "center" }}>{s.sog}</td>
                </tr>
              ))}
              {seasonStats.length === 0 && (
                <tr><td colSpan="6" style={{ ...S.td, textAlign: "center", color: "#aaa", padding: 24 }}>No season data available.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
