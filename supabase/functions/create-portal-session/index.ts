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

    const body    = await req.json().catch(() => ({}));
    const { org_id } = body as { org_id?: string };

    const admin = createClient(supabaseUrl, serviceRoleKey);
    let stripeCustomerId: string | null = null;

    if (org_id) {
      // Org plan portal — caller must be org_admin
      const { data: membership } = await admin
        .from("org_members")
        .select("role")
        .eq("org_id", org_id)
        .eq("user_id", user.id)
        .single();

      if (membership?.role !== "org_admin") {
        return json({ error: "Only org admins can manage the org subscription" }, 403);
      }

      const { data: org } = await admin
        .from("organizations")
        .select("stripe_customer_id")
        .eq("id", org_id)
        .single();

      stripeCustomerId = org?.stripe_customer_id ?? null;
    } else {
      // Personal plan portal
      const { data: profile } = await admin
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", user.id)
        .single();

      stripeCustomerId = profile?.stripe_customer_id ?? null;
    }

    if (!stripeCustomerId) {
      return json({ error: "No active subscription found" }, 404);
    }

    const session = await stripe.billingPortal.sessions.create({
      customer:   stripeCustomerId,
      return_url: `${siteUrl}/profile`,
    });

    return json({ url: session.url });
  } catch (err) {
    console.error("[create-portal-session]", err);
    return json({ error: (err as Error).message }, 500);
  }
});
