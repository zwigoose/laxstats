import { useState, useEffect, useRef } from "react";
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
import Pricing from "./pages/Pricing";
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

// ── PWA install prompt ───────────────────────────────────────────────────────
function useInstallPrompt() {
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    navigator.standalone === true;

  const isIOS =
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem("pwa-dismissed") === "1"; } catch { return false; }
  });

  useEffect(() => {
    if (isStandalone) return;
    const onPrompt = (e) => { e.preventDefault(); setPrompt(e); };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [isStandalone]);

  const triggerInstall = async () => {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setPrompt(null);
  };

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem("pwa-dismissed", "1"); } catch {}
  };

  const canShow = !installed && !dismissed;
  return {
    showChrome: canShow && prompt !== null,
    showIOS:    canShow && isIOS && !prompt,
    triggerInstall,
    dismiss,
  };
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
  const { showChrome, showIOS, triggerInstall, dismiss } = useInstallPrompt();
  const [iosOpen, setIosOpen] = useState(false);
  const iosRef    = useRef(null);

  useEffect(() => {
    if (!iosOpen) return;
    const handler = (e) => {
      if (iosRef.current && !iosRef.current.contains(e.target)) setIosOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [iosOpen]);

  if (path === "/login" || NO_NAV.test(path)) return null;

  const hasOrgs = orgMemberships?.length > 0;
  const initials = user?.email ? user.email[0].toUpperCase() : null;

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

      <NavItem label="Home"    active={path === "/"}              onClick={() => navigate("/")} />
      {hasOrgs && (
        <NavItem label="Orgs"  active={path.startsWith("/orgs")} onClick={() => navigate("/orgs")} />
      )}
      <NavItem label="Pricing" active={path === "/pricing"}       onClick={() => navigate("/pricing")} />
      {isAdmin && (
        <NavItem label="Admin" active={path === "/admin"}         onClick={() => navigate("/admin")} />
      )}

      {/* Profile / sign in — pinned to right */}
      <div style={{ flex: 1 }} />

      {/* PWA install — Chrome/Android */}
      {showChrome && (
        <button
          onClick={triggerInstall}
          title="Install LaxStats app"
          style={{
            fontSize: 12, fontWeight: 600, color: "#111",
            background: "none", border: "1px solid #d0d0d0",
            borderRadius: 7, padding: "4px 10px", cursor: "pointer",
            fontFamily: "system-ui, sans-serif", marginRight: 6, flexShrink: 0,
            display: "flex", alignItems: "center", gap: 5,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
            <path d="M5.5 1v6M3 5l2.5 2.5L8 5" stroke="#111" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M1 9.5h9" stroke="#111" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          Install
        </button>
      )}

      {/* PWA install — iOS Safari (no beforeinstallprompt) */}
      {showIOS && (
        <div style={{ position: "relative", marginRight: 6, flexShrink: 0 }} ref={iosRef}>
          <button
            onClick={() => setIosOpen(v => !v)}
            title="Install LaxStats app"
            style={{
              fontSize: 12, fontWeight: 600, color: "#111",
              background: "none", border: "1px solid #d0d0d0",
              borderRadius: 7, padding: "4px 10px", cursor: "pointer",
              fontFamily: "system-ui, sans-serif",
              display: "flex", alignItems: "center", gap: 5,
            }}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
              <path d="M5.5 1v6M3 5l2.5 2.5L8 5" stroke="#111" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M1 9.5h9" stroke="#111" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            Install
          </button>
          {iosOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 10px)", right: 0,
              background: "#111", color: "#fff", borderRadius: 10,
              padding: "12px 14px", width: 210, zIndex: 300,
              boxShadow: "0 4px 20px rgba(0,0,0,0.22)",
              fontFamily: "system-ui, sans-serif",
            }}>
              {/* Arrow */}
              <div style={{
                position: "absolute", top: -6, right: 14,
                width: 12, height: 12, background: "#111",
                transform: "rotate(45deg)", borderRadius: 2,
              }} />
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Install LaxStats</div>
              <div style={{ fontSize: 12, lineHeight: 1.55, color: "#ccc" }}>
                Tap the <strong style={{ color: "#fff" }}>Share</strong> button{" "}
                <span style={{ fontSize: 13 }}>⬆</span> in Safari, then select{" "}
                <strong style={{ color: "#fff" }}>"Add to Home Screen"</strong>.
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); dismiss(); setIosOpen(false); }}
                style={{
                  marginTop: 10, fontSize: 11, color: "#888",
                  background: "none", border: "none", cursor: "pointer",
                  padding: 0, fontFamily: "system-ui, sans-serif",
                }}
              >
                Don't show again
              </button>
            </div>
          )}
        </div>
      )}

      {user ? (
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
      ) : (
        <button
          onClick={() => navigate("/login")}
          style={{
            fontSize: 13, fontWeight: 600, color: "#111",
            background: "none", border: "1px solid #e0e0e0",
            borderRadius: 8, padding: "5px 12px", cursor: "pointer",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          Sign in
        </button>
      )}
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
          <Route path="/pricing"                  element={<Pricing />} />
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
