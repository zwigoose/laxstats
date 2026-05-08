import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useDocTitle } from "../hooks/useDocTitle";

function Check({ ok }) {
  if (ok === true)  return <span style={{ color: "#2a7a3b", fontSize: 17, lineHeight: 1 }}>✓</span>;
  if (ok === false) return <span style={{ color: "#ddd", fontSize: 17, lineHeight: 1 }}>—</span>;
  return null;
}

const S = {
  sectionLabel: {
    fontSize: 11, fontWeight: 700, color: "#aaa",
    textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 14,
  },
  card: (accent, recommended) => ({
    background: "#fff",
    border: recommended ? `2px solid ${accent}` : "1px solid #e8e8e8",
    borderRadius: 16,
    padding: "22px 20px",
    position: "relative",
    boxShadow: recommended ? `0 4px 20px ${accent}22` : "0 1px 6px rgba(0,0,0,0.05)",
    flex: 1,
  }),
  planName: (color) => ({ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }),
  price: { fontSize: 26, fontWeight: 800, color: "#111", letterSpacing: "-0.02em" },
  period: { fontSize: 12, color: "#aaa", marginLeft: 2 },
  tagline: { fontSize: 12, color: "#888", marginBottom: 18, marginTop: 2 },
  btn: (color, recommended) => ({
    width: "100%", padding: "9px", fontSize: 13, fontWeight: 700,
    background: recommended ? color : "#111",
    color: "#fff", border: "none", borderRadius: 9, cursor: "pointer",
    marginTop: 4,
  }),
};

export default function Pricing() {
  useDocTitle("Plans & Pricing");
  const navigate = useNavigate();
  const { user } = useAuth();

  function handleCta(planName) {
    alert(`Billing setup is coming soon. To get on the ${planName} plan, email us at hello@laxstats.app.`);
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: "#f5f5f5", minHeight: "100%" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "36px 20px 60px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", letterSpacing: "-0.02em", margin: "0 0 8px" }}>
            Simple, honest pricing
          </h1>
          <p style={{ fontSize: 15, color: "#666", margin: 0, lineHeight: 1.6 }}>
            Score on your own for free, or run a full organization.<br />
            No hidden fees.
          </p>
        </div>

        {/* ── Personal plans ───────────────────────────────────── */}
        <div style={{ marginBottom: 44 }}>
          <div style={S.sectionLabel}>Personal — score on your own</div>

          <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            {/* Free */}
            <div style={S.card("#888", false)}>
              <div style={S.planName("#888")}>Free</div>
              <div style={{ display: "flex", alignItems: "baseline" }}>
                <span style={S.price}>$0</span>
                <span style={S.period}>/ mo</span>
              </div>
              <div style={S.tagline}>Included with every account</div>
              <div style={{ fontSize: 12, color: "#555", lineHeight: 1.6 }}>
                Up to <strong>3 personal games</strong><br />
                Score, review stats, share Pressbox
              </div>
              {!user && (
                <button onClick={() => navigate("/login")} style={S.btn("#555", false)}>
                  Sign up free
                </button>
              )}
            </div>

            {/* Basic */}
            <div style={S.card("#1a6bab", false)}>
              <div style={S.planName("#1a6bab")}>Basic</div>
              <div style={{ display: "flex", alignItems: "baseline" }}>
                <span style={S.price}>$5</span>
                <span style={S.period}>/ mo</span>
              </div>
              <div style={S.tagline}>For regular scorers</div>
              <div style={{ fontSize: 12, color: "#555", lineHeight: 1.6 }}>
                Up to <strong>10 personal games</strong><br />
                Score, review stats, share Pressbox
              </div>
              <button onClick={() => handleCta("Basic")} style={S.btn("#1a6bab", false)}>
                Get Basic
              </button>
            </div>

            {/* Plus */}
            <div style={S.card("#2a7a3b", true)}>
              <div style={{ position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)",
                fontSize: 10, fontWeight: 700, color: "#2a7a3b", background: "#eaf6ec",
                border: "1px solid #2a7a3b44", borderRadius: 20, padding: "2px 10px",
                letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                Best value
              </div>
              <div style={S.planName("#2a7a3b")}>Plus</div>
              <div style={{ display: "flex", alignItems: "baseline" }}>
                <span style={S.price}>$10</span>
                <span style={S.period}>/ mo</span>
              </div>
              <div style={S.tagline}>For power users & coaches</div>
              <div style={{ fontSize: 12, color: "#555", lineHeight: 1.6 }}>
                Up to <strong>20 personal games</strong><br />
                Score, review stats, share Pressbox
              </div>
              <button onClick={() => handleCta("Plus")} style={S.btn("#2a7a3b", true)}>
                Get Plus
              </button>
            </div>
          </div>

          {/* Personal game cap explainer */}
          <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 12, padding: "14px 18px", fontSize: 13, color: "#555", lineHeight: 1.65 }}>
            <span style={{ fontWeight: 700, color: "#111" }}>How the personal game cap works: </span>
            Personal games are private scorebook entries you create outside of any organization — great for scrimmages, pickup games, or solo stat-keeping. Your plan determines how many you can have at one time. If you join an org, org games don't count against your personal cap, and your org's plan may raise your personal limit automatically.
          </div>
        </div>

        {/* ── Org plans ────────────────────────────────────────── */}
        <div style={{ marginBottom: 32 }}>
          <div style={S.sectionLabel}>Organizations — manage your team or league</div>

          <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            {/* Pro */}
            <div style={S.card("#1a6bab", false)}>
              <div style={S.planName("#1a6bab")}>Pro</div>
              <div style={{ display: "flex", alignItems: "baseline" }}>
                <span style={S.price}>$10</span>
                <span style={S.period}>/ mo</span>
              </div>
              <div style={S.tagline}>For a single team or small club</div>
              <div style={{ fontSize: 12, color: "#555", lineHeight: 1.7 }}>
                2 active seasons<br />
                4 teams<br />
                5 members<br />
                20 games per season<br />
                Press Box · Season stats · Multi-scorer
              </div>
              <button onClick={() => handleCta("Pro")} style={S.btn("#111", false)}>
                Get Pro
              </button>
            </div>

            {/* Max */}
            <div style={S.card("#2a7a3b", true)}>
              <div style={{ position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)",
                fontSize: 10, fontWeight: 700, color: "#2a7a3b", background: "#eaf6ec",
                border: "1px solid #2a7a3b44", borderRadius: 20, padding: "2px 10px",
                letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                Most popular
              </div>
              <div style={S.planName("#2a7a3b")}>Max</div>
              <div style={{ display: "flex", alignItems: "baseline" }}>
                <span style={S.price}>$20</span>
                <span style={S.period}>/ mo</span>
              </div>
              <div style={S.tagline}>For leagues and multi-team programs</div>
              <div style={{ fontSize: 12, color: "#555", lineHeight: 1.7 }}>
                Unlimited active seasons<br />
                Unlimited teams<br />
                Unlimited members<br />
                Unlimited games<br />
                Press Box · Season stats · Multi-scorer
              </div>
              <button onClick={() => handleCta("Max")} style={S.btn("#2a7a3b", true)}>
                Get Max
              </button>
            </div>
          </div>

          {/* Org feature comparison table */}
          <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px", borderBottom: "2px solid #f0f0f0" }}>
              <div style={{ padding: "13px 20px", fontSize: 11, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.07em" }}>Feature</div>
              <div style={{ padding: "13px 8px", textAlign: "center", fontSize: 11, fontWeight: 700, color: "#1a6bab", textTransform: "uppercase", letterSpacing: "0.07em" }}>Pro</div>
              <div style={{ padding: "13px 8px", textAlign: "center", fontSize: 11, fontWeight: 700, color: "#2a7a3b", textTransform: "uppercase", letterSpacing: "0.07em" }}>Max</div>
            </div>
            {[
              { label: "Active seasons",    pro: "2",   max: "∞" },
              { label: "Active teams",      pro: "4",   max: "∞" },
              { label: "Members",           pro: "5",   max: "∞" },
              { label: "Games per season",  pro: "20",  max: "∞" },
              { label: "Press Box",         pro: true,  max: true },
              { label: "Season stats",      pro: true,  max: true },
              { label: "Multi-scorekeeper", pro: true,  max: true },
            ].map((row, i, arr) => (
              <div key={row.label} style={{
                display: "grid", gridTemplateColumns: "1fr 100px 100px",
                borderBottom: i < arr.length - 1 ? "1px solid #f5f5f5" : "none",
                background: i % 2 === 0 ? "#fff" : "#fafafa",
              }}>
                <div style={{ padding: "12px 20px", fontSize: 13, color: "#333" }}>{row.label}</div>
                <div style={{ padding: "12px 8px", textAlign: "center", fontSize: 13, fontWeight: 600, color: "#111" }}>
                  {typeof row.pro === "boolean" ? <Check ok={row.pro} /> : row.pro}
                </div>
                <div style={{ padding: "12px 8px", textAlign: "center", fontSize: 13, fontWeight: 600, color: "#111" }}>
                  {typeof row.max === "boolean" ? <Check ok={row.max} /> : row.max}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: "#bbb", textAlign: "center" }}>
            Org plans are billed per organization. One org admin can manage the subscription.
          </div>
        </div>

        {/* Footer CTA */}
        <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 12, padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 3 }}>
              {user ? "Manage your plan" : "Start for free"}
            </div>
            <div style={{ fontSize: 13, color: "#666" }}>
              {user
                ? "View your current personal plan and org memberships."
                : "Create an account and score your first 3 games at no cost."}
            </div>
          </div>
          {user ? (
            <button onClick={() => navigate("/profile")}
              style={{ fontSize: 13, fontWeight: 600, color: "#1a6bab", background: "none", border: "1px solid #c0d8f0", borderRadius: 8, padding: "7px 14px", cursor: "pointer", whiteSpace: "nowrap" }}>
              View profile →
            </button>
          ) : (
            <button onClick={() => navigate("/login")}
              style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: "#111", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", whiteSpace: "nowrap" }}>
              Sign up free →
            </button>
          )}
        </div>

        <div style={{ marginTop: 16, textAlign: "center", fontSize: 12, color: "#ccc" }}>
          Billing coming soon — email hello@laxstats.app to get started.
        </div>

      </div>
    </div>
  );
}
