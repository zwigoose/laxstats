import { useState } from "react";
import { useDocTitle } from "../../hooks/useDocTitle";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import AllGamesTab from "./AllGamesTab";
import UsersTab from "./UsersTab";
import RostersAdminTab from "./RostersAdminTab";
import OrgsTab from "./OrgsTab";
import PlanLimitsTab from "./PlanLimitsTab";
import { C, F } from "../../styles/tokens";

export default function Admin() {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAuth();
  const [tab, setTab] = useState("games");
  useDocTitle("Admin");

  if (loading) return null;
  if (!isAdmin) {
    navigate("/");
    return null;
  }

  return (
    <div style={{ fontFamily: F.ui, minHeight: "100%", background: C.gray50 }}>
      <div style={{ position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ background: C.gray900, padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={() => navigate("/")} style={{ background: "none", border: "none", color: C.whiteA50, fontSize: 13, fontWeight: 500, cursor: "pointer", padding: 0, fontFamily: F.ui }}>
            ← Games
          </button>
          <span style={{ fontSize: 17, fontWeight: 700, color: C.white, flex: 1 }}>Admin</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.orange600, background: C.orangeA20, borderRadius: 6, padding: "3px 8px", letterSpacing: "0.08em", textTransform: "uppercase" }}>Admin</span>
        </div>
        <div style={{ background: C.white }}>
          <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 16px" }}>
            <div style={{ display: "flex", gap: 4, padding: "12px 0 0", marginBottom: 0, borderBottom: `1px solid ${C.gray100}` }}>
              {[["games", "All Games"], ["users", "Users"], ["rosters", "Rosters"], ["orgs", "Orgs"], ["plans", "Plans"]].map(([id, label]) => (
                <button key={id} onClick={() => setTab(id)} style={{
                  padding: "8px 18px", fontSize: 14, fontWeight: tab === id ? 700 : 500,
                  border: "none", background: "transparent", cursor: "pointer",
                  color: tab === id ? C.gray900 : C.gray400,
                  borderBottom: tab === id ? `2px solid ${C.gray900}` : "2px solid transparent",
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
        {tab === "plans"     && <PlanLimitsTab />}
      </div>
    </div>
  );
}
