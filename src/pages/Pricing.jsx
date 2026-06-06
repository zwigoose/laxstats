import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import SeoMeta from "../hooks/useSeoMeta";
import { supabase } from "../lib/supabase";

// Features to show in the org comparison table, in display order.
const ORG_FEATURE_ORDER = [
  "org_active_seasons",
  "org_active_teams",
  "org_members",
  "org_games_per_season",
  "org_member_personal_games",
  "pressbox",
  "season_stats",
  "multi_scorekeeper",
];

const ORG_FEATURE_LABELS = {
  org_active_seasons:       "Active seasons",
  org_active_teams:         "Active teams",
  org_members:              "Members",
  org_games_per_season:     "Games per season",
  org_member_personal_games:"Bonus personal games / member",
  pressbox:                 "Press Box",
  season_stats:             "Season stats",
  multi_scorekeeper:        "Multi-scorekeeper",
};

// These features are on/off rather than numeric caps.
const BOOLEAN_FEATURES = new Set(["pressbox", "season_stats", "multi_scorekeeper"]);

function fmtLimit(val, isBool) {
  if (val === null || val === undefined) return "∞";
  if (isBool) return val > 0
    ? <span style={{ color: "#2a7a3b", fontSize: 17, lineHeight: 1 }}>✓</span>
    : <span style={{ color: "#ddd", fontSize: 17, lineHeight: 1 }}>—</span>;
  if (val === 0) return <span style={{ color: "#ddd", fontSize: 17, lineHeight: 1 }}>—</span>;
  return String(val);
}

const S = {
  sectionLabel: {
    fontSize: 11, fontWeight: 700, color: "#aaa",
    textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 14,
  },
  card: (accent, recommended) => ({
    background: "#fff",
    border: recommended ? `2px solid ${accent}` : "1px solid #e8e8e8",
    borderRadius: 16, padding: "22px 20px", position: "relative", flex: 1,
    boxShadow: recommended ? `0 4px 20px ${accent}22` : "0 1px 6px rgba(0,0,0,0.05)",
  }),
  badge: (color, bg) => ({
    position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)",
    fontSize: 10, fontWeight: 700, color, background: bg,
    border: `1px solid ${color}44`, borderRadius: 20, padding: "2px 10px",
    letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap",
  }),
  planName: (color) => ({
    fontSize: 11, fontWeight: 700, color,
    textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6,
  }),
  price: { fontSize: 26, fontWeight: 800, color: "#111", letterSpacing: "-0.02em" },
  period: { fontSize: 12, color: "#aaa", marginLeft: 2 },
  tagline: { fontSize: 12, color: "#888", marginBottom: 18, marginTop: 2 },
  btn: (bg) => ({
    width: "100%", padding: "9px", fontSize: 13, fontWeight: 700,
    background: bg, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", marginTop: 4,
  }),
};

export default function Pricing() {
  const navigate      = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, orgMemberships } = useAuth();

  const [orgFeatures,    setOrgFeatures]    = useState(null);
  const [personalLimits, setPersonalLimits] = useState(null);
  const [loadingPlan,    setLoadingPlan]    = useState(null); // plan key being checked out
  const [checkoutError,  setCheckoutError]  = useState(null);
  const [selectedOrgId,  setSelectedOrgId]  = useState(null);
  const [newOrgName,     setNewOrgName]     = useState("");

  const checkoutSuccess = searchParams.get("checkout") === "success";

  // Orgs where the current user is an admin — eligible for org plan purchase
  const adminOrgs       = orgMemberships.filter(m => m.role === "org_admin");
  const activeAdminOrgs = adminOrgs.filter(m => m.org?.plan_status !== "canceled");

  // Resolve which org to use for an org plan checkout:
  // 1. ?org=<slug> query param (coming from OrgDashboard upgrade/renew link)
  // 2. selectedOrgId state (multi-org picker)
  // 3. Only one active admin org — use it automatically
  const orgSlug    = searchParams.get("org");
  const orgFromUrl = orgSlug ? adminOrgs.find(m => m.org?.slug === orgSlug) : null;
  const resolvedOrgId =
    orgFromUrl?.org_id ??
    selectedOrgId ??
    (activeAdminOrgs.length === 1 ? activeAdminOrgs[0].org_id : null);

  useEffect(() => {
    Promise.all([
      supabase.from("plan_features").select("id, pro_limit, max_limit"),
      supabase.from("personal_plan_limits").select("plan, game_limit"),
    ]).then(([pfRes, plRes]) => {
      if (!pfRes.error) {
        const map = {};
        (pfRes.data || []).forEach(r => { map[r.id] = r; });
        setOrgFeatures(map);
      }
      if (!plRes.error) {
        const map = {};
        (plRes.data || []).forEach(r => { map[r.plan] = r.game_limit; });
        setPersonalLimits(map);
      }
    });
  }, []);

  // Auto-trigger checkout when returning from login with ?plan= in the URL.
  const autostartPlan = searchParams.get("plan");
  useEffect(() => {
    if (!user || !autostartPlan || loadingPlan) return;
    handleCheckout(autostartPlan, resolvedOrgId);
  }, [user, autostartPlan]);

  const isNewOrgFlow = user && activeAdminOrgs.length === 0;

  async function handleCheckout(planKey, orgId) {
    if (!user) {
      const next = encodeURIComponent(`/pricing?plan=${planKey}${orgSlug ? `&org=${orgSlug}` : ""}`);
      navigate(`/login?next=${next}`);
      return;
    }
    setLoadingPlan(planKey);
    setCheckoutError(null);
    try {
      const body = { plan_key: planKey };
      if (orgId)                  body.org_id   = orgId;
      else if (newOrgName.trim()) body.org_name  = newOrgName.trim();
      const { data, error } = await supabase.functions.invoke("create-checkout-session", { body });
      if (error) {
        let msg = error.message;
        try { const body = await error.context?.json(); msg = body?.error ?? msg; } catch {}
        throw new Error(msg);
      }
      if (!data?.url) throw new Error(data?.error ?? "Could not start checkout");
      window.location.href = data.url;
    } catch (err) {
      setCheckoutError(err.message);
      setLoadingPlan(null);
    }
  }

  const freeGames  = personalLimits?.free  ?? "—";
  const basicGames = personalLimits?.basic ?? "—";
  const plusGames  = personalLimits?.plus  ?? "—";

  const orgProBonus  = orgFeatures?.org_member_personal_games?.pro_limit  ?? null;
  const orgMaxBonus  = orgFeatures?.org_member_personal_games?.max_limit  ?? null;

  // Build a human-readable example for the cap explainer
  function capExample() {
    const b = typeof basicGames === "number" ? basicGames : null;
    const m = typeof orgMaxBonus === "number" ? orgMaxBonus : null;
    if (b !== null && m !== null) return `${b} + ${m} = ${b + m}`;
    return null;
  }
  const example = capExample();

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: "#f5f5f5", minHeight: "100%" }}>
      <SeoMeta
        title="Plans & Pricing"
        description="Free personal scoring, or run a full organization. Simple, transparent pricing for lacrosse stats software. No hidden fees."
        url="https://laxstats.com/pricing"
      />
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "36px 20px 60px" }}>

        {/* Checkout success banner */}
        {checkoutSuccess && (
          <div style={{ background: "#eaf6ec", border: "1px solid #b2dfb8", borderRadius: 10, padding: "12px 18px", marginBottom: 24, fontSize: 14, color: "#1a5c2a", fontWeight: 600 }}>
            Payment successful — your plan has been updated. It may take a moment to reflect.
          </div>
        )}

        {/* Checkout error banner */}
        {checkoutError && (
          <div style={{ background: "#fff0f0", border: "1px solid #fcc", borderRadius: 10, padding: "12px 18px", marginBottom: 24, fontSize: 13, color: "#c00" }}>
            {checkoutError}
          </div>
        )}

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", letterSpacing: "-0.02em", margin: "0 0 8px" }}>
            Simple, honest pricing
          </h1>
          <p style={{ fontSize: 15, color: "#666", margin: 0, lineHeight: 1.6 }}>
            Score on your own for free, or run a full organization.<br />No hidden fees.
          </p>
        </div>

        {/* ── Personal plans ─────────────────────────────────────── */}
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
              <div style={{ fontSize: 12, color: "#555", lineHeight: 1.65 }}>
                Up to <strong>{freeGames} personal games</strong><br />
                Full stats
              </div>
              {!user && (
                <button onClick={() => navigate("/login")} style={S.btn("#555")}>
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
              <div style={{ fontSize: 12, color: "#555", lineHeight: 1.65 }}>
                Up to <strong>{basicGames} personal games</strong><br />
                Full stats
              </div>
              <button
                onClick={() => handleCheckout("basic")}
                disabled={loadingPlan === "basic"}
                style={S.btn("#1a6bab")}
              >
                {loadingPlan === "basic" ? "Redirecting…" : "Get Basic"}
              </button>
            </div>

            {/* Plus */}
            <div style={S.card("#2a7a3b", true)}>
              <div style={S.badge("#2a7a3b", "#eaf6ec")}>Best value</div>
              <div style={S.planName("#2a7a3b")}>Plus</div>
              <div style={{ display: "flex", alignItems: "baseline" }}>
                <span style={S.price}>$10</span>
                <span style={S.period}>/ mo</span>
              </div>
              <div style={S.tagline}>For power users & coaches</div>
              <div style={{ fontSize: 12, color: "#555", lineHeight: 1.65 }}>
                Up to <strong>{plusGames} personal games</strong><br />
                Full stats
              </div>
              <button
                onClick={() => handleCheckout("plus")}
                disabled={loadingPlan === "plus"}
                style={S.btn("#2a7a3b")}
              >
                {loadingPlan === "plus" ? "Redirecting…" : "Get Plus"}
              </button>
            </div>
          </div>

          {/* Personal game cap explainer */}
          <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 12, padding: "14px 18px", fontSize: 13, color: "#555", lineHeight: 1.7 }}>
            <span style={{ fontWeight: 700, color: "#111" }}>How the personal game cap works: </span>
            Personal games are private scorebook entries you create outside of any organization. Your cap is <strong>cumulative</strong> — it combines your personal plan allowance with a bonus from your org&apos;s plan.
            {example && (
              <> For example, a Basic subscriber in a Max org can have up to <strong>{example}</strong> personal games.</>
            )}
            {" "}Org games never count against your personal cap.
          </div>
        </div>

        {/* ── Org plans ──────────────────────────────────────────── */}
        <div style={{ marginBottom: 32 }}>
          <div style={S.sectionLabel}>Organizations — manage your team or league</div>

          {/* New org name — shown when user has no orgs yet */}
          {isNewOrgFlow && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 13, color: "#555", fontWeight: 600, marginBottom: 6 }}>
                Organization name
              </label>
              <input
                value={newOrgName}
                onChange={e => setNewOrgName(e.target.value)}
                placeholder="School/Organization Name"
                style={{ width: "100%", fontSize: 14, padding: "9px 12px", border: "1px solid #e0e0e0", borderRadius: 9, background: "#fff", boxSizing: "border-box", fontFamily: "system-ui, sans-serif" }}
              />
              <div style={{ fontSize: 12, color: "#aaa", marginTop: 5 }}>We&apos;ll create your organization when your subscription activates.</div>
            </div>
          )}

          {/* Org selector — shown only when the user is admin of 2+ active orgs */}
          {user && activeAdminOrgs.length > 1 && (
            <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
              <label style={{ fontSize: 13, color: "#555", fontWeight: 600 }}>Purchasing for:</label>
              <select
                value={selectedOrgId ?? ""}
                onChange={e => setSelectedOrgId(e.target.value || null)}
                style={{ fontSize: 13, padding: "5px 10px", borderRadius: 7, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}
              >
                <option value="">— select an org —</option>
                {activeAdminOrgs.map(m => (
                  <option key={m.org_id} value={m.org_id}>{m.org?.name ?? m.org_id}</option>
                ))}
              </select>
            </div>
          )}

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
                {fmtLimit(orgFeatures?.org_active_seasons?.pro_limit)} active season{orgFeatures?.org_active_seasons?.pro_limit !== 1 ? "s" : ""}<br />
                {fmtLimit(orgFeatures?.org_active_teams?.pro_limit)} teams · {fmtLimit(orgFeatures?.org_members?.pro_limit)} members<br />
                {fmtLimit(orgFeatures?.org_games_per_season?.pro_limit)} games / season<br />
                +{fmtLimit(orgProBonus)} personal games per member<br />
                Press Box · Season stats
              </div>
              {user && activeAdminOrgs.length > 1 && !resolvedOrgId ? (
                <p style={{ fontSize: 12, color: "#aaa", marginTop: 8, textAlign: "center" }}>Select an org above to continue</p>
              ) : (
                <button
                  onClick={() => handleCheckout("pro", resolvedOrgId)}
                  disabled={loadingPlan === "pro" || (user && activeAdminOrgs.length > 0 && !resolvedOrgId) || (isNewOrgFlow && !newOrgName.trim())}
                  style={S.btn("#111")}
                >
                  {loadingPlan === "pro" ? "Redirecting…" : "Get Pro"}
                </button>
              )}
            </div>

            {/* Max */}
            <div style={S.card("#2a7a3b", true)}>
              <div style={S.badge("#2a7a3b", "#eaf6ec")}>Most popular</div>
              <div style={S.planName("#2a7a3b")}>Max</div>
              <div style={{ display: "flex", alignItems: "baseline" }}>
                <span style={S.price}>$20</span>
                <span style={S.period}>/ mo</span>
              </div>
              <div style={S.tagline}>For leagues and multi-team programs</div>
              <div style={{ fontSize: 12, color: "#555", lineHeight: 1.7 }}>
                {fmtLimit(orgFeatures?.org_active_seasons?.max_limit)} active seasons<br />
                {fmtLimit(orgFeatures?.org_active_teams?.max_limit)} teams · {fmtLimit(orgFeatures?.org_members?.max_limit)} members<br />
                {fmtLimit(orgFeatures?.org_games_per_season?.max_limit)} games / season<br />
                +{fmtLimit(orgMaxBonus)} personal games per member<br />
                Press Box · Season stats · Multi-scorer
              </div>
              {user && activeAdminOrgs.length > 1 && !resolvedOrgId ? (
                <p style={{ fontSize: 12, color: "#aaa", marginTop: 8, textAlign: "center" }}>Select an org above to continue</p>
              ) : (
                <button
                  onClick={() => handleCheckout("max", resolvedOrgId)}
                  disabled={loadingPlan === "max" || (user && activeAdminOrgs.length > 0 && !resolvedOrgId) || (isNewOrgFlow && !newOrgName.trim())}
                  style={S.btn("#2a7a3b")}
                >
                  {loadingPlan === "max" ? "Redirecting…" : "Get Max"}
                </button>
              )}
            </div>
          </div>

          {/* Org feature comparison table */}
          <div style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px", borderBottom: "2px solid #f0f0f0" }}>
              <div style={{ padding: "13px 20px", fontSize: 11, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.07em" }}>Feature</div>
              <div style={{ padding: "13px 8px", textAlign: "center", fontSize: 11, fontWeight: 700, color: "#1a6bab", textTransform: "uppercase", letterSpacing: "0.07em" }}>Pro</div>
              <div style={{ padding: "13px 8px", textAlign: "center", fontSize: 11, fontWeight: 700, color: "#2a7a3b", textTransform: "uppercase", letterSpacing: "0.07em" }}>Max</div>
            </div>
            {ORG_FEATURE_ORDER.filter(id => orgFeatures?.[id] !== undefined || orgFeatures === null).map((id, i, arr) => {
              const feature = orgFeatures?.[id];
              const isBool  = BOOLEAN_FEATURES.has(id);
              return (
                <div key={id} style={{
                  display: "grid", gridTemplateColumns: "1fr 100px 100px",
                  borderBottom: i < arr.length - 1 ? "1px solid #f5f5f5" : "none",
                  background: i % 2 === 0 ? "#fff" : "#fafafa",
                }}>
                  <div style={{ padding: "12px 20px", fontSize: 13, color: "#333" }}>{ORG_FEATURE_LABELS[id] ?? id}</div>
                  <div style={{ padding: "12px 8px", textAlign: "center", fontSize: 13, fontWeight: 600, color: "#111" }}>
                    {feature ? fmtLimit(feature.pro_limit, isBool) : "—"}
                  </div>
                  <div style={{ padding: "12px 8px", textAlign: "center", fontSize: 13, fontWeight: 600, color: "#111" }}>
                    {feature ? fmtLimit(feature.max_limit, isBool) : "—"}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: "#bbb", textAlign: "center" }}>
            Org plans are billed per organization.
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
                : "Create an account and score your first games at no cost."}
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
          Questions? Email us at hello@laxstats.app
        </div>

      </div>
    </div>
  );
}
