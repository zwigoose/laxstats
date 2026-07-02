import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
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
import PrintGame from "./pages/PrintGame";
import Orgs from "./pages/Orgs";
import Profile from "./pages/Profile";
import Pricing from "./pages/Pricing";
import Guide from "./pages/Guide";
import { version } from "../package.json";
import { C, F } from "./styles/tokens";
import AppNav, { NAV_H, NO_NAV } from "./components/AppNav";

// Single source of truth for the footer height — the nav height lives in AppNav.
const FOOTER_H = 36;

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

// ── Routes ───────────────────────────────────────────────────────────────────
function AppRoutes() {
  const location = useLocation();
  const path     = location.pathname;
  const showNav  = path !== "/login" && !NO_NAV.test(path);

  return (
    <>
      <AppNav />
      <div className="app-scroll-container" style={{ position: "fixed", top: showNav ? NAV_H : 0, bottom: FOOTER_H, left: 0, right: 0, overflowY: "auto" }}>
        <Routes>
          <Route path="/login"                    element={<Login />} />
          <Route path="/"                         element={<GameList />} />
          <Route path="/games/new"                element={<PrivateRoute><CreateGame /></PrivateRoute>} />
          <Route path="/games/:id/score"          element={<Scorekeeper />} />
          <Route path="/games/:id/view"           element={<ViewGame />} />
          <Route path="/games/:id/pressbox"       element={<Pressbox />} />
          <Route path="/games/:id/print"         element={<PrintGame />} />
          <Route path="/orgs"                     element={<PrivateRoute><Orgs /></PrivateRoute>} />
          <Route path="/orgs/new"                 element={<PrivateRoute><CreateOrg /></PrivateRoute>} />
          <Route path="/orgs/:slug"               element={<OrgDashboard />} />
          <Route path="/orgs/:slug/seasons/:id"   element={<SeasonView />} />
          <Route path="/orgs/:slug/teams"         element={<PrivateRoute><TeamManager /></PrivateRoute>} />
          <Route path="/admin"                    element={<PrivateRoute><Admin /></PrivateRoute>} />
          <Route path="/profile"                  element={<PrivateRoute><Profile /></PrivateRoute>} />
          <Route path="/pricing"                  element={<Pricing />} />
          <Route path="/guide"                    element={<Guide />} />
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
          fontSize: 11, color: C.gray350,
          fontFamily: F.ui,
          background: C.white, borderTop: `1px solid ${C.gray75}`,
          zIndex: 100,
        }}>
          &copy; {new Date().getFullYear()} LaxStats &middot; v{version}
        </footer>
      </AuthProvider>
    </BrowserRouter>
  );
}
