import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno&no-check=true";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const PERSONAL_PLANS = new Set(["basic", "plus"]);
const ORG_PLANS      = new Set(["pro", "max"]);

const VALID_STATUSES = new Set(["active", "trialing", "past_due", "canceled"]);

function normalizeStatus(status: string): string {
  return VALID_STATUSES.has(status) ? status : "active";
}

async function createOrgFromSub(
  admin: ReturnType<typeof createClient>,
  stripe: Stripe,
  sub: Stripe.Subscription,
) {
  const { plan_key, user_id, org_name } = sub.metadata ?? {};
  if (!plan_key || !user_id || !org_name) {
    console.error("[stripe-webhook] createOrgFromSub: missing metadata", sub.metadata);
    return;
  }

  // Guard: don't create a duplicate if already linked
  if (sub.metadata?.org_id) {
    console.log("[stripe-webhook] org_id already in metadata, skipping org creation");
    return;
  }

  const slug = org_name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)
    + "-" + Math.random().toString(36).slice(2, 6);

  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;

  const { data: newOrg, error: orgErr } = await admin
    .from("organizations")
    .insert({
      name:                 org_name,
      slug,
      plan:                 plan_key,
      plan_status:          "active",
      stripe_sub_id:        sub.id,
      stripe_customer_id:   typeof sub.customer === "string" ? sub.customer : null,
      color:                "#1a6bab",
      cancel_at_period_end: false,
      current_period_end:   periodEnd,
    })
    .select("id")
    .single();

  if (orgErr || !newOrg) {
    console.error("[stripe-webhook] failed to create org:", orgErr);
    return;
  }

  await admin.from("org_members").insert({ org_id: newOrg.id, user_id, role: "org_admin" });

  // Stamp org_id onto subscription metadata so future events can find the org
  await stripe.subscriptions.update(sub.id, {
    metadata: { ...sub.metadata, org_id: newOrg.id },
  });

  console.log("[stripe-webhook] org created:", newOrg.id);
}

serve(async (req) => {
  const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const stripeKey      = Deno.env.get("STRIPE_SECRET_KEY")!;
  const webhookSecret  = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
  const admin  = createClient(supabaseUrl, serviceRoleKey);

  const sig  = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig!, webhookSecret);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed:", err);
    return json({ error: "Invalid signature" }, 400);
  }

  console.log("[stripe-webhook] received:", event.type);

  try {
    switch (event.type) {

      // ── Checkout completed — primary trigger for new purchases ──────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription" || !session.subscription) break;

        const sub = await stripe.subscriptions.retrieve(
          session.subscription as string
        );
        const { plan_key, user_id, org_id, org_name } = sub.metadata ?? {};
        if (!plan_key) break;

        const periodEnd = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null;

        if (ORG_PLANS.has(plan_key)) {
          if (!org_id && org_name) {
            // New org purchase — create the org now
            await createOrgFromSub(admin, stripe, sub);
          } else if (org_id) {
            // Existing org upgrade through Checkout
            await admin.from("organizations").update({
              plan:                 plan_key,
              plan_status:          normalizeStatus(sub.status),
              stripe_sub_id:        sub.id,
              cancel_at_period_end: false,
              current_period_end:   periodEnd,
            }).eq("id", org_id);
          }
        } else if (user_id && PERSONAL_PLANS.has(plan_key)) {
          await admin.from("profiles").update({
            personal_plan:        plan_key,
            personal_plan_status: normalizeStatus(sub.status),
            stripe_sub_id:        sub.id,
            cancel_at_period_end: false,
            current_period_end:   periodEnd,
          }).eq("id", user_id);
        }
        break;
      }

      // ── Subscription updated — renewals, plan changes, cancel scheduling ────
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const { plan_key, user_id, org_id } = sub.metadata ?? {};
        if (!plan_key) break;

        const dbStatus          = normalizeStatus(sub.status);
        const cancelAtPeriodEnd = sub.cancel_at_period_end ?? false;
        const periodEnd         = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null;

        if (org_id && ORG_PLANS.has(plan_key)) {
          await admin.from("organizations").update({
            plan:                 plan_key,
            plan_status:          dbStatus,
            stripe_sub_id:        sub.id,
            cancel_at_period_end: cancelAtPeriodEnd,
            current_period_end:   periodEnd,
          }).eq("id", org_id);
        } else if (user_id && PERSONAL_PLANS.has(plan_key)) {
          await admin.from("profiles").update({
            personal_plan:        plan_key,
            personal_plan_status: dbStatus,
            stripe_sub_id:        sub.id,
            cancel_at_period_end: cancelAtPeriodEnd,
            current_period_end:   periodEnd,
          }).eq("id", user_id);
        }
        break;
      }

      // ── Subscription deleted — period ended after cancellation ──────────────
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const { plan_key, user_id, org_id } = sub.metadata ?? {};

        if (org_id && ORG_PLANS.has(plan_key)) {
          await admin.from("organizations").update({
            plan_status:          "canceled",
            stripe_sub_id:        null,
            cancel_at_period_end: false,
            current_period_end:   null,
          }).eq("id", org_id);
        } else if (user_id) {
          await admin.from("profiles").update({
            personal_plan:        "free",
            personal_plan_status: "active",
            stripe_sub_id:        null,
            cancel_at_period_end: false,
            current_period_end:   null,
          }).eq("id", user_id);
        }
        break;
      }

      default:
        break;
    }

    return json({ received: true });
  } catch (err) {
    console.error("[stripe-webhook] handler error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});
