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

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const { plan_key, user_id, org_id: metaOrgId, org_name } = sub.metadata ?? {};
        if (!plan_key) break;

        const dbStatus = normalizeStatus(sub.status);

        if (ORG_PLANS.has(plan_key)) {
          let resolvedOrgId = metaOrgId;

          if (!resolvedOrgId && org_name && user_id) {
            // New org purchase — create org now that payment succeeded
            const slug = org_name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "")
              .slice(0, 48)
              + "-" + Math.random().toString(36).slice(2, 6);

            const { data: newOrg, error: orgErr } = await admin
              .from("organizations")
              .insert({
                name:              org_name,
                slug,
                plan:              plan_key,
                plan_status:       dbStatus,
                stripe_sub_id:     sub.id,
                stripe_customer_id: typeof sub.customer === "string" ? sub.customer : null,
                color:             "#1a6bab",
              })
              .select("id")
              .single();

            if (orgErr || !newOrg) {
              console.error("[stripe-webhook] failed to create org:", orgErr);
              break;
            }

            await admin.from("org_members").insert({
              org_id: newOrg.id,
              user_id,
              role: "org_admin",
            });

            // Stamp org_id onto subscription metadata for future webhook events
            await stripe.subscriptions.update(sub.id, {
              metadata: { ...sub.metadata, org_id: newOrg.id },
            });

            resolvedOrgId = newOrg.id;
          }

          if (resolvedOrgId) {
            // For existing-org upgrades (subscription.updated), sync plan/status
            if (metaOrgId) {
              await admin.from("organizations").update({
                plan:              plan_key,
                plan_status:       dbStatus,
                stripe_sub_id:     sub.id,
              }).eq("id", resolvedOrgId);
            }
          }
        } else if (user_id && PERSONAL_PLANS.has(plan_key)) {
          await admin.from("profiles").update({
            personal_plan:        plan_key,
            personal_plan_status: dbStatus,
            stripe_sub_id:        sub.id,
          }).eq("id", user_id);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const { plan_key, user_id, org_id } = sub.metadata ?? {};

        if (org_id && ORG_PLANS.has(plan_key)) {
          await admin.from("organizations").update({
            plan_status:  "canceled",
            stripe_sub_id: null,
          }).eq("id", org_id);
        } else if (user_id) {
          await admin.from("profiles").update({
            personal_plan:        "free",
            personal_plan_status: "active",
            stripe_sub_id:        null,
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
