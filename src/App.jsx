import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import GameList from "./pages/GameList";
import Scorekeeper from "./pages/Scorekeeper";
import ViewGame from "./pages/ViewGame";
import Pressbox from "./pages/Pressbox";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import CreateOrg from "./pages/CreateOrg";
import OrgDashboard from "./pages/OrgDashboard";
import SeasonView from "./pages/SeasonView";
import TeamManager from "./pages/TeamManager";
import CreateGame from "./pages/CreateGame";
import Orgs from "./pages/Orgs";
import Profile from "./pages/Profile";
import { version } from "../package.json";

// Single source of truth for layout heights — consumed here and via CSS variables.
const FOOTER_H = 36;
const NAV_H    = 44;

// Routes where the nav + its top padding should NOT appear (full-viewport experiences).
const NO_NAV = /\/games\/[^/]+\/(score|pressbox)/;

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return children;
}

// ── Global nav bar ───────────────────────────────────────────────────────────
function NavItem({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 13, fontWeight: active ? 600 : 400,
        color: active ? "#111" : "#888",
        background: active ? "#f0f0f0" : "none",
        border: "none", cursor: "pointer",
        padding: "5px 11px", borderRadius: 7,
        fontFamily: "system-ui, sans-serif",
        transition: "background 0.1s, color 0.1s",
      }}
    >
      {label}
    </button>
  );
}

function AppNav() {
  const { user, isAdmin, orgMemberships } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const path      = location.pathname;

  if (!user || path === "/login" || NO_NAV.test(path)) return null;

  const hasOrgs = orgMemberships?.length > 0;
  const initials = user.email ? user.email[0].toUpperCase() : "?";

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, height: NAV_H,
      background: "#fff", borderBottom: "1px solid #f0f0f0",
      display: "flex", alignItems: "center", padding: "0 16px",
      gap: 2, zIndex: 200, fontFamily: "system-ui, sans-serif",
    }}>
      {/* Logo / home */}
      <button
        onClick={() => navigate("/")}
        style={{
          fontSize: 15, fontWeight: 800, color: "#111", letterSpacing: "-0.03em",
          background: "none", border: "none", cursor: "pointer",
          padding: "5px 8px", borderRadius: 7, marginRight: 6,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        LaxStats
      </button>

      <div style={{ width: 1, height: 18, background: "#e8e8e8", marginRight: 4 }} />

      <NavItem label="Home"  active={path === "/"}            onClick={() => navigate("/")} />
      {hasOrgs && (
        <NavItem label="Orgs"  active={path.startsWith("/orgs")} onClick={() => navigate("/orgs")} />
      )}
      {isAdmin && (
        <NavItem label="Admin" active={path === "/admin"}        onClick={() => navigate("/admin")} />
      )}

      {/* Profile avatar — pinned to right */}
      <div style={{ flex: 1 }} />
      <button
        onClick={() => navigate("/profile")}
        title="Profile"
        style={{
          width: 30, height: 30, borderRadius: "50%",
          background: path === "/profile" ? "#111" : "#e8e8e8",
          color: path === "/profile" ? "#fff" : "#555",
          border: "none", cursor: "pointer",
          fontSize: 12, fontWeight: 700, fontFamily: "system-ui, sans-serif",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {initials}
      </button>
    </div>
  );
}

// ── Routes ───────────────────────────────────────────────────────────────────
function AppRoutes() {
  const location = useLocation();
  const path     = location.pathname;
  const showNav  = path !== "/login" && !NO_NAV.test(path);

  return (
    <>
      <AppNav />
      <div style={{ position: "fixed", top: showNav ? NAV_H : 0, bottom: FOOTER_H, left: 0, right: 0, overflowY: "auto" }}>
        <Routes>
          <Route path="/login"                    element={<Login />} />
          <Route path="/"                         element={<GameList />} />
          <Route path="/games/new"                element={<PrivateRoute><CreateGame /></PrivateRoute>} />
          <Route path="/games/:id/score"          element={<Scorekeeper />} />
          <Route path="/games/:id/view"           element={<ViewGame />} />
          <Route path="/games/:id/pressbox"       element={<Pressbox />} />
          <Route path="/orgs"                     element={<PrivateRoute><Orgs /></PrivateRoute>} />
          <Route path="/orgs/new"                 element={<PrivateRoute><CreateOrg /></PrivateRoute>} />
          <Route path="/orgs/:slug"               element={<OrgDashboard />} />
          <Route path="/orgs/:slug/seasons/:id"   element={<SeasonView />} />
          <Route path="/orgs/:slug/teams"         element={<PrivateRoute><TeamManager /></PrivateRoute>} />
          <Route path="/admin"                    element={<PrivateRoute><Admin /></PrivateRoute>} />
          <Route path="/profile"                  element={<PrivateRoute><Profile /></PrivateRoute>} />
        </Routes>
      </div>
    </>
  );
}

// ── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <style>{`:root { --footer-h: ${FOOTER_H}px; --nav-h: ${NAV_H}px; }`}</style>
        <AppRoutes />
        <footer style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          height: FOOTER_H,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, color: "#bbb",
          fontFamily: "system-ui, sans-serif",
          background: "#fff", borderTop: "1px solid #f0f0f0",
          zIndex: 100,
        }}>
          &copy; {new Date().getFullYear()} LaxStats &middot; v{version}
        </footer>
      </AuthProvider>
    </BrowserRouter>
  );
}
