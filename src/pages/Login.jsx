import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import SeoMeta from "../hooks/useSeoMeta";
import { C, F, SH } from "../styles/tokens";

const IS_STAGING = (import.meta.env ?? {}).VITE_IS_STAGING === "true";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const nextUrl  = new URLSearchParams(location.search).get("next") || "/";
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === "signin") {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (err) setError("Invalid email or password.");
      else navigate(nextUrl, { replace: true });
    } else {
      const { error: err } = await supabase.auth.signUp({ email: email.trim(), password });
      if (err) setError(err.message);
      else setConfirmed(true);
    }

    setLoading(false);
  }

  const inputStyle = {
    width: "100%",
    padding: "11px 13px",
    fontSize: 15,
    border: `1px solid ${C.gray250}`,
    borderRadius: 10,
    background: C.white,
    boxSizing: "border-box",
    outline: "none",
    fontFamily: F.ui,
  };

  return (
    <div style={{ fontFamily: F.ui, minHeight: "100vh", background: C.gray50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <SeoMeta
        title={mode === "signup" ? "Create Account" : "Sign In"}
        description="Sign in to your LaxStats account to score lacrosse games, manage your roster, and share live stats."
        url="https://laxstats.com/login"
      />
      <div style={{ width: "100%", maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src="/LaxStatsIcon.png" alt="LaxStats" style={{ width: 96, height: 96, objectFit: "contain", marginBottom: 8 }} />
          <div style={{ fontSize: 30, fontWeight: 800, color: IS_STAGING ? C.red500 : C.gray900, letterSpacing: "-0.02em" }}>LaxStats</div>
          {IS_STAGING && (
            <div style={{ fontSize: 11, fontWeight: 700, color: C.red500, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 4, opacity: 0.85 }}>v2.0.0 staging</div>
          )}
        </div>

        {/* Card */}
        <div style={{ background: C.white, borderRadius: 18, padding: 28, boxShadow: SH.float, border: `1px solid ${C.gray90}` }}>
          {confirmed ? (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📬</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: C.gray900, marginBottom: 8 }}>Check your email</div>
              <div style={{ fontSize: 14, color: C.gray600, lineHeight: 1.6 }}>
                We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
              </div>
            </div>
          ) : (
            <>
              <h2 style={{ margin: "0 0 22px", fontSize: 19, fontWeight: 700, color: C.gray900 }}>
                {mode === "signin" ? "Sign in" : "Create account"}
              </h2>

              {error && (
                <div style={{ background: C.red50, border: `1px solid ${C.red100}`, borderRadius: 9, padding: "10px 13px", color: C.red600, fontSize: 13, marginBottom: 16 }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.gray500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                    Email
                  </label>
                  <input
                    type="email"
                    style={inputStyle}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    autoCapitalize="off"
                    autoCorrect="off"
                  />
                </div>

                <div style={{ marginBottom: 22 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.gray500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                    Password
                  </label>
                  <input
                    type="password"
                    style={inputStyle}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={mode === "signup" ? "At least 6 characters" : ""}
                    required
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: "12px",
                    fontSize: 15,
                    fontWeight: 700,
                    background: loading ? C.gray300 : C.gray900,
                    color: C.white,
                    border: "none",
                    borderRadius: 10,
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? "…" : mode === "signin" ? "Sign in" : "Create account"}
                </button>
              </form>

              {/* Toggle mode */}
              <div style={{ marginTop: 18, textAlign: "center", fontSize: 13, color: C.gray500 }}>
                {mode === "signin" ? (
                  <>
                    Need an account?{" "}
                    <button onClick={() => { setMode("signup"); setError(null); }}
                      style={{ background: "none", border: "none", color: C.blue600, fontWeight: 600, cursor: "pointer", padding: 0, fontSize: 13 }}>
                      Sign up
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <button onClick={() => { setMode("signin"); setError(null); }}
                      style={{ background: "none", border: "none", color: C.blue600, fontWeight: 600, cursor: "pointer", padding: 0, fontSize: 13 }}>
                      Sign in
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
