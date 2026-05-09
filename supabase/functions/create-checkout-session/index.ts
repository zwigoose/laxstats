import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno&no-check=true";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const PERSONAL_PLANS = new Set(["basic", "plus"]);
const ORG_PLANS      = new Set(["pro", "max"]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
    const anonKey        = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeKey      = Deno.env.get("STRIPE_SECRET_KEY")!;
    const siteUrl        = Deno.env.get("SITE_URL") ?? "https://laxstats.app";

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    // ── Auth ────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Not authenticated" }, 401);

    // ── Input ───────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const { plan_key, org_id: bodyOrgId, org_name } = body as { plan_key: string; org_id?: string; org_name?: string };

    if (!plan_key || (!PERSONAL_PLANS.has(plan_key) && !ORG_PLANS.has(plan_key))) {
      return json({ error: "Invalid plan_key" }, 400);
    }

    const priceId = Deno.env.get(`STRIPE_PRICE_${plan_key.toUpperCase()}`);
    if (!priceId) return json({ error: `Price not configured for plan: ${plan_key}` }, 500);

    const admin     = createClient(supabaseUrl, serviceRoleKey);
    const isOrgPlan = ORG_PLANS.has(plan_key);

    // ── Resolve or create Stripe customer ───────────────────────────
    let stripeCustomerId: string | null = null;
    let org_id = bodyOrgId;

    if (isOrgPlan) {
      if (!org_id && org_name?.trim()) {
        // New user — create the org and add them as org_admin
        const slug = org_name.trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 48)
          + "-" + Math.random().toString(36).slice(2, 6);

        const { data: newOrg, error: orgErr } = await admin
          .from("organizations")
          .insert({ name: org_name.trim(), slug, plan: plan_key, plan_status: "active", color: "#1a6bab" })
          .select("id")
          .single();

        if (orgErr || !newOrg) return json({ error: orgErr?.message ?? "Failed to create org" }, 500);

        await admin.from("org_members").insert({ org_id: newOrg.id, user_id: user.id, role: "org_admin" });
        org_id = newOrg.id;
      }

      if (!org_id) return json({ error: "org_id or org_name required for org plans" }, 400);

      // Verify caller is org_admin (skip for newly created org — they definitely are)
      if (org_id !== bodyOrgId) {
        // freshly created, no need to re-verify
      } else {
        const { data: membership } = await admin
          .from("org_members")
          .select("role")
          .eq("org_id", org_id)
          .eq("user_id", user.id)
          .single();

        if (membership?.role !== "org_admin") {
          return json({ error: "Only org admins can purchase org plans" }, 403);
        }
      }

      const { data: org } = await admin
        .from("organizations")
        .select("stripe_customer_id, name")
        .eq("id", org_id)
        .single();

      stripeCustomerId = org?.stripe_customer_id ?? null;

      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: org?.name ?? undefined,
          metadata: { org_id },
        });
        stripeCustomerId = customer.id;
        await admin
          .from("organizations")
          .update({ stripe_customer_id: stripeCustomerId })
          .eq("id", org_id);
      }
    } else {
      const { data: profile } = await admin
        .from("profiles")
        .select("stripe_customer_id, display_name")
        .eq("id", user.id)
        .single();

      stripeCustomerId = profile?.stripe_customer_id ?? null;

      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: profile?.display_name ?? undefined,
          metadata: { user_id: user.id },
        });
        stripeCustomerId = customer.id;
        await admin
          .from("profiles")
          .update({ stripe_customer_id: stripeCustomerId })
          .eq("id", user.id);
      }
    }

    // ── Create Checkout session ─────────────────────────────────────
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/pricing?checkout=success`,
      cancel_url:  `${siteUrl}/pricing`,
      subscription_data: {
        metadata: {
          plan_key,
          user_id: user.id,
          ...(org_id ? { org_id } : {}),
        },
      },
    });

    return json({ url: session.url });
  } catch (err) {
    console.error("[create-checkout-session]", err);
    return json({ error: (err as Error).message }, 500);
  }
});
