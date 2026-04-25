import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const FAKE_DOMAIN = "@laxstats.app";

function toEmail(username) {
  const u = username.trim().toLowerCase();
  return u.includes("@") ? u : u + FAKE_DOMAIN;
}

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const email = toEmail(username);

    if (mode === "signin") {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) setError("Invalid username or password.");
      else navigate("/");
    } else {
      const { error: err } = await supabase.auth.signUp({ email, password });
      if (err) setError(err.message);
      else navigate("/");
    }

    setLoading(false);
  }

  const inputStyle = {
    width: "100%",
    padding: "11px 13px",
    fontSize: 15,
    border: "1px solid #ddd",
    borderRadius: 10,
    background: "#fff",
    boxSizing: "border-box",
    outline: "none",
    fontFamily: "system-ui, sans-serif",
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", minHeight: "100vh", background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src="/LaxStatsIcon.png" alt="LaxStats" style={{ width: 96, height: 96, objectFit: "contain", marginBottom: 8 }} />
          <div style={{ fontSize: 30, fontWeight: 800, color: import.meta.env.MODE === "staging" ? "#e53935" : "#111", letterSpacing: "-0.02em" }}>LaxStats</div>
          {import.meta.env.MODE === "staging" && (
            <div style={{ fontSize: 11, fontWeight: 700, color: "#e53935", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 4, opacity: 0.85 }}>v2.0.0 staging</div>
          )}
        </div>

        {/* Card */}
        <div style={{ background: "#fff", borderRadius: 18, padding: 28, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", border: "1px solid #ebebeb" }}>
          <h2 style={{ margin: "0 0 22px", fontSize: 19, fontWeight: 700, color: "#111" }}>
            {mode === "signin" ? "Sign in" : "Create account"}
          </h2>

          {error && (
            <div style={{ background: "#fff5f5", border: "1px solid #fdd", borderRadius: 9, padding: "10px 13px", color: "#c0392b", fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                Username
              </label>
              <input
                type="text"
                style={inputStyle}
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="username"
                required
                autoComplete="username"
                autoCapitalize="off"
                autoCorrect="off"
              />
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
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
                background: loading ? "#ccc" : "#111",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          {/* Toggle mode */}
          <div style={{ marginTop: 18, textAlign: "center", fontSize: 13, color: "#888" }}>
            {mode === "signin" ? (
              <>
                Need an account?{" "}
                <button onClick={() => { setMode("signup"); setError(null); }}
                  style={{ background: "none", border: "none", color: "#1a6bab", fontWeight: 600, cursor: "pointer", padding: 0, fontSize: 13 }}>
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button onClick={() => { setMode("signin"); setError(null); }}
                  style={{ background: "none", border: "none", color: "#1a6bab", fontWeight: 600, cursor: "pointer", padding: 0, fontSize: 13 }}>
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
