import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { C, F, SH } from "../styles/tokens";

// Single source of truth for the nav height — consumed by App's layout and
// exposed as the --nav-h CSS variable.
export const NAV_H = 44;

// Routes where the nav + its top padding should NOT appear (full-viewport experiences).
export const NO_NAV = /\/games\/[^/]+\/(score|pressbox|print)/;

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
    try { localStorage.setItem("pwa-dismissed", "1"); } catch { /* private mode — persistence unavailable */ }
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
        color: active ? C.gray900 : C.gray500,
        background: active ? C.gray75 : "none",
        border: "none", cursor: "pointer",
        padding: "5px 11px", borderRadius: 7,
        fontFamily: F.ui,
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
      background: C.white, borderBottom: `1px solid ${C.gray75}`,
      display: "flex", alignItems: "center", padding: "0 16px",
      gap: 2, zIndex: 200, fontFamily: F.ui,
    }}>
      {/* Logo / home */}
      <button
        onClick={() => navigate("/")}
        style={{
          fontSize: 15, fontWeight: 800, color: C.gray900, letterSpacing: "-0.03em",
          background: "none", border: "none", cursor: "pointer",
          padding: "5px 8px", borderRadius: 7, marginRight: 6,
          fontFamily: F.ui,
        }}
      >
        LaxStats
      </button>

      <div style={{ width: 1, height: 18, background: C.gray100, marginRight: 4 }} />

      <NavItem label="Home"    active={path === "/"}              onClick={() => navigate("/")} />
      {hasOrgs && (
        <NavItem label="Orgs"  active={path.startsWith("/orgs")} onClick={() => navigate("/orgs")} />
      )}
      <NavItem label="Pricing" active={path === "/pricing"}       onClick={() => navigate("/pricing")} />
      <NavItem label="Guide"   active={path === "/guide"}         onClick={() => navigate("/guide")} />
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
            fontSize: 12, fontWeight: 600, color: C.gray900,
            background: "none", border: `1px solid ${C.gray275}`,
            borderRadius: 7, padding: "4px 10px", cursor: "pointer",
            fontFamily: F.ui, marginRight: 6, flexShrink: 0,
            display: "flex", alignItems: "center", gap: 5,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
            <path d="M5.5 1v6M3 5l2.5 2.5L8 5" stroke={C.gray900} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M1 9.5h9" stroke={C.gray900} strokeWidth="1.4" strokeLinecap="round"/>
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
              fontSize: 12, fontWeight: 600, color: C.gray900,
              background: "none", border: `1px solid ${C.gray275}`,
              borderRadius: 7, padding: "4px 10px", cursor: "pointer",
              fontFamily: F.ui,
              display: "flex", alignItems: "center", gap: 5,
            }}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
              <path d="M5.5 1v6M3 5l2.5 2.5L8 5" stroke={C.gray900} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M1 9.5h9" stroke={C.gray900} strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            Install
          </button>
          {iosOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 10px)", right: 0,
              background: C.gray900, color: C.white, borderRadius: 10,
              padding: "12px 14px", width: 210, zIndex: 300,
              boxShadow: SH.pop,
              fontFamily: F.ui,
            }}>
              {/* Arrow */}
              <div style={{
                position: "absolute", top: -6, right: 14,
                width: 12, height: 12, background: C.gray900,
                transform: "rotate(45deg)", borderRadius: 2,
              }} />
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Install LaxStats</div>
              <div style={{ fontSize: 12, lineHeight: 1.55, color: C.gray300 }}>
                Tap the <strong style={{ color: C.white }}>Share</strong> button{" "}
                <span style={{ fontSize: 13 }}>⬆</span> in Safari, then select{" "}
                <strong style={{ color: C.white }}>"Add to Home Screen"</strong>.
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); dismiss(); setIosOpen(false); }}
                style={{
                  marginTop: 10, fontSize: 11, color: C.gray500,
                  background: "none", border: "none", cursor: "pointer",
                  padding: 0, fontFamily: F.ui,
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
            background: path === "/profile" ? C.gray900 : C.gray100,
            color: path === "/profile" ? C.white : C.gray650,
            border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: 700, fontFamily: F.ui,
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
            fontSize: 13, fontWeight: 600, color: C.gray900,
            background: "none", border: `1px solid ${C.gray200}`,
            borderRadius: 8, padding: "5px 12px", cursor: "pointer",
            fontFamily: F.ui,
          }}
        >
          Sign in
        </button>
      )}
    </div>
  );
}

export default AppNav;
