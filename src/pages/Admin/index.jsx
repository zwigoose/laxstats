import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import AllGamesTab from "./AllGamesTab";
import UsersTab from "./UsersTab";
import RostersAdminTab from "./RostersAdminTab";
import OrgsTab from "./OrgsTab";
import MigrationTab from "./MigrationTab";

export default function Admin() {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAuth();
  const [tab, setTab] = useState("games");

  if (loading) return null;
  if (!isAdmin) {
    navigate("/");
    return null;
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", minHeight: "100%", background: "#f5f5f5" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ background: "#111", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={() => navigate("/")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 500, cursor: "pointer", padding: 0, fontFamily: "system-ui, sans-serif" }}>
            ← Games
          </button>
          <span style={{ fontSize: 17, fontWeight: 700, color: "#fff", flex: 1 }}>Admin</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#d4820a", background: "rgba(212,130,10,0.2)", borderRadius: 6, padding: "3px 8px", letterSpacing: "0.08em", textTransform: "uppercase" }}>Admin</span>
        </div>
        <div style={{ background: "#fff" }}>
          <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 16px" }}>
            <div style={{ display: "flex", gap: 4, padding: "12px 0 0", marginBottom: 0, borderBottom: "1px solid #e8e8e8" }}>
              {[["games", "All Games"], ["users", "Users"], ["rosters", "Rosters"], ["orgs", "Orgs"], ["migration", "Migration"]].map(([id, label]) => (
                <button key={id} onClick={() => setTab(id)} style={{
                  padding: "8px 18px", fontSize: 14, fontWeight: tab === id ? 700 : 500,
                  border: "none", background: "transparent", cursor: "pointer",
                  color: tab === id ? "#111" : "#aaa",
                  borderBottom: tab === id ? "2px solid #111" : "2px solid transparent",
                  marginBottom: -1,
                }}>{label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "16px 16px 32px" }}>
        {tab === "games"     && <AllGamesTab />}
        {tab === "users"     && <UsersTab />}
        {tab === "rosters"   && <RostersAdminTab />}
        {tab === "orgs"      && <OrgsTab />}
        {tab === "migration" && <MigrationTab />}
      </div>
    </div>
  );
}
