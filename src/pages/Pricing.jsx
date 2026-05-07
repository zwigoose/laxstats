import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useDocTitle } from "../hooks/useDocTitle";

const PLAN_TIERS = [
  {
    id: "pro",
    name: "Pro",
    price: "$49",
    period: "/ mo",
    tagline: "For teams getting started",
    cta: "Get started",
    color: "#1a6bab",
    bg: "#eef4fb",
  },
  {
    id: "max",
    name: "Max",
    price: "$149",
    period: "/ mo",
    tagline: "Unlimited rosters & seasons",
    cta: "Get started",
    color: "#2a7a3b",
    bg: "#eaf6ec",
    recommended: true,
  },
  {
    id: "giga",
    name: "Giga",
    price: "Custom",
    period: "",
    tagline: "Enterprise & large associations",
    cta: "Contact us",
    color: "#d4820a",
    bg: "#fff8ec",
  },
];

// null = not available (disabled)
const FEATURES = [
  { label: "Active seasons",    values: [1, 3, null],          format: n => n === null ? "∞" : String(n) },
  { label: "Active teams",      values: [3, null, null],        format: n => n === null ? "∞" : String(n) },
  { label: "Members",           values: [5, null, null],        format: n => n === null ? "∞" : String(n) },
  { label: "Games per season",  values: [20, null, null],       format: n => n === null ? "∞" : String(n) },
  { label: "Press Box",         values: [true, true, true],     format: null },
  { label: "Season stats",      values: [true, true, true],     format: null },
  { label: "Multi-scorekeeper", values: [false, true, true],    format: null },
];

function Check({ ok }) {
  if (ok === true)  return <span style={{ color: "#2a7a3b", fontSize: 18, lineHeight: 1 }}>✓</span>;
  if (ok === false) return <span style={{ color: "#ccc", fontSize: 18, lineHeight: 1 }}>—</span>;
  return null;
}

export default function Pricing() {
  useDocTitle("Plans & Pricing");
  const navigate = useNavigate();
  const { user } = useAuth();

  function handleCta(tier) {
    // Billing stub — no live Stripe yet
    alert(`Billing setup is coming soon. To get started on the ${tier.name} plan, email us at hello@laxstats.app.`);
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: "#f5f5f5", minHeight: "100%" }}>
      <div style={{ maxWidth: 740, margin: "0 auto", padding: "32px 20px 60px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", letterSpacing: "-0.02em", margin: "0 0 8px" }}>
            Simple, honest pricing
          </h1>
          <p style={{ fontSize: 15, color: "#666", margin: 0 }}>
            All plans include unlimited personal games. Org plans unlock league management features.
          </p>
        </div>

        {/* Plan cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 32 }}>
          {PLAN_TIERS.map(tier => (
            <div key={tier.id} style={{
              background: "#fff",
              border: tier.recommended ? `2px solid ${tier.color}` : "1px solid #e8e8e8",
              borderRadius: 16,
              padding: "24px 20px",
              position: "relative",
              boxShadow: tier.recommended ? `0 4px 20px ${tier.color}22` : "0 1px 6px rgba(0,0,0,0.05)",
            }}>
              {tier.recommended && (
                <div style={{
                  position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)",
                  fontSize: 10, fontWeight: 700, color: tier.color, background: tier.bg,
                  border: `1px solid ${tier.color}44`,
                  borderRadius: 20, padding: "2px 10px", letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap",
                }}>Most popular</div>
              )}

              <div style={{ fontSize: 11, fontWeight: 700, color: tier.color, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{tier.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 3, marginBottom: 4 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: "#111", letterSpacing: "-0.02em" }}>{tier.price}</span>
                {tier.period && <span style={{ fontSize: 13, color: "#aaa" }}>{tier.period}</span>}
              </div>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 20 }}>{tier.tagline}</div>

              <button
                onClick={() => handleCta(tier)}
                style={{
                  width: "100%", padding: "9px", fontSize: 13, fontWeight: 700,
                  background: tier.recommended ? tier.color : "#111",
                  color: "#fff", border: "none", borderRadius: 9, cursor: "pointer",
                }}
              >
                {tier.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Feature comparison table */}
        <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}>
          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr repeat(3, 80px)", borderBottom: "2px solid #f0f0f0" }}>
            <div style={{ padding: "14px 20px", fontSize: 11, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.07em" }}>Feature</div>
            {PLAN_TIERS.map(tier => (
              <div key={tier.id} style={{ padding: "14px 8px", textAlign: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: tier.color, textTransform: "uppercase", letterSpacing: "0.07em" }}>{tier.name}</span>
              </div>
            ))}
          </div>

          {FEATURES.map((feature, i) => (
            <div key={feature.label} style={{
              display: "grid", gridTemplateColumns: "1fr repeat(3, 80px)",
              borderBottom: i < FEATURES.length - 1 ? "1px solid #f5f5f5" : "none",
              background: i % 2 === 0 ? "#fff" : "#fafafa",
            }}>
              <div style={{ padding: "13px 20px", fontSize: 13, color: "#333" }}>{feature.label}</div>
              {feature.values.map((val, j) => (
                <div key={j} style={{ padding: "13px 8px", textAlign: "center", fontSize: 13, fontWeight: 600, color: "#111" }}>
                  {feature.format
                    ? feature.format(val)
                    : <Check ok={val} />
                  }
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Free tier note */}
        <div style={{ marginTop: 24, background: "#fff", border: "1px solid #e8e8e8", borderRadius: 12, padding: "16px 20px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 4 }}>Already have an account?</div>
          <div style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>
            Your account includes unlimited personal games for free. Org plans are billed per organization and unlock league management, stat aggregation, and the Press Box.
          </div>
          {user ? (
            <button onClick={() => navigate("/profile")}
              style={{ fontSize: 13, fontWeight: 600, color: "#1a6bab", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
              View your current plan →
            </button>
          ) : (
            <button onClick={() => navigate("/login?next=/pricing")}
              style={{ fontSize: 13, fontWeight: 600, color: "#1a6bab", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
              Sign up free →
            </button>
          )}
        </div>

        {/* Billing stub note */}
        <div style={{ marginTop: 16, textAlign: "center", fontSize: 12, color: "#bbb" }}>
          Billing setup in progress. Use the Get started button to express interest and we&apos;ll reach out.
        </div>
      </div>
    </div>
  );
}
