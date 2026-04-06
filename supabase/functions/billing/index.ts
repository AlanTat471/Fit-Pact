import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "https://esm.sh/stripe@14.25.0?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
};

function env(name: string): string {
  return Deno.env.get(name) ?? "";
}

const STRIPE_SECRET_KEY = env("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = env("STRIPE_WEBHOOK_SECRET");
const STRIPE_PRICE_WEEKLY = env("STRIPE_PRICE_WEEKLY");
const STRIPE_PRICE_FORTNIGHTLY = env("STRIPE_PRICE_FORTNIGHTLY");
const APP_URL = env("APP_URL") || "http://localhost:5173";
const SUPABASE_URL = env("SUPABASE_URL");
const SUPABASE_ANON_KEY = env("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");

console.log("[billing] Boot — env check:", {
  hasStripeKey: !!STRIPE_SECRET_KEY,
  hasWebhookSecret: !!STRIPE_WEBHOOK_SECRET,
  hasPriceWeekly: !!STRIPE_PRICE_WEEKLY,
  hasPriceFortnightly: !!STRIPE_PRICE_FORTNIGHTLY,
  appUrl: APP_URL,
  hasSupabaseUrl: !!SUPABASE_URL,
  hasAnonKey: !!SUPABASE_ANON_KEY,
  hasServiceRole: !!SUPABASE_SERVICE_ROLE_KEY,
});

let stripe: Stripe | null = null;
try {
  if (STRIPE_SECRET_KEY) {
    stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
  } else {
    console.error("[billing] STRIPE_SECRET_KEY is empty — Stripe calls will fail");
  }
} catch (e) {
  console.error("[billing] Failed to initialise Stripe client:", e);
}

type PlanType = "weekly" | "fortnightly" | "free";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function priceId(plan: PlanType): string | null {
  if (plan === "weekly") return STRIPE_PRICE_WEEKLY || null;
  if (plan === "fortnightly") return STRIPE_PRICE_FORTNIGHTLY || null;
  return null;
}

function planFromPrice(pid: string | null | undefined): PlanType {
  if (!pid) return "free";
  if (pid === STRIPE_PRICE_WEEKLY) return "weekly";
  if (pid === STRIPE_PRICE_FORTNIGHTLY) return "fortnightly";
  return "free";
}

function isoOrNull(ts: number | null | undefined): string | null {
  return ts ? new Date(ts * 1000).toISOString() : null;
}

// ── Webhook helper ──────────────────────────────────────────────────────
async function upsertSub(
  svc: ReturnType<typeof createClient>,
  sub: Stripe.Subscription,
) {
  if (!stripe) return;
  const pricePid = sub.items.data[0]?.price?.id ?? null;
  const plan = planFromPrice(pricePid);
  const custId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

  let userId = sub.metadata?.supabase_user_id || null;
  if (!userId && custId) {
    const cust = await stripe.customers.retrieve(custId);
    if (!("deleted" in cust) && cust?.metadata?.supabase_user_id) {
      userId = cust.metadata.supabase_user_id;
    }
  }
  if (!userId) {
    console.warn("[billing] No supabase user for sub", sub.id);
    return;
  }

  const raw = sub.status;
  const mapped =
    raw === "active" || raw === "trialing" || raw === "past_due" || raw === "canceled"
      ? raw
      : "canceled";
  const dbStatus = mapped === "canceled" ? "cancelled" : mapped;
  const activePlan =
    dbStatus === "active" || dbStatus === "trialing" || dbStatus === "past_due"
      ? plan
      : "free";

  await svc.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: sub.id,
      stripe_customer_id: custId ?? null,
      stripe_price_id: pricePid,
      status: dbStatus,
      plan_type: activePlan,
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
      current_period_start: isoOrNull(sub.current_period_start),
      current_period_end: isoOrNull(sub.current_period_end),
      expires_at: isoOrNull(sub.current_period_end),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  await svc.from("user_preferences").upsert(
    { user_id: userId, key: "activePlan", value: activePlan },
    { onConflict: "user_id,key" },
  );
}

// ── Main handler ────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;
  console.log("[billing]", req.method, path);

  // ── Stripe Webhook ──────────────────────────────────────────────────
  if (req.method === "POST" && path.endsWith("/stripe-webhook")) {
    try {
      if (!stripe) return json({ error: "Stripe not configured" }, 500);
      const sig = req.headers.get("stripe-signature");
      if (!sig || !STRIPE_WEBHOOK_SECRET) {
        return json({ error: "Missing webhook signature or secret" }, 400);
      }
      const body = await req.text();
      const event = await stripe.webhooks.constructEventAsync(
        body,
        sig,
        STRIPE_WEBHOOK_SECRET,
      );
      const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      if (
        event.type === "checkout.session.completed" ||
        event.type === "customer.subscription.created" ||
        event.type === "customer.subscription.updated" ||
        event.type === "customer.subscription.deleted"
      ) {
        let subscription: Stripe.Subscription | null = null;
        if (event.type === "checkout.session.completed") {
          const sess = event.data.object as Stripe.Checkout.Session;
          if (sess.subscription && typeof sess.subscription === "string") {
            subscription = await stripe.subscriptions.retrieve(sess.subscription);
          }
        } else {
          subscription = event.data.object as Stripe.Subscription;
        }
        if (subscription) await upsertSub(svc, subscription);
      }
      return json({ received: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Webhook error";
      console.error("[billing] webhook error:", msg);
      return json({ error: msg }, 400);
    }
  }

  // ── Create Checkout Session (any other POST) ────────────────────────
  if (req.method === "POST") {
    try {
      // Step 1: Stripe client
      if (!stripe) {
        console.error("[billing] Stripe client not initialised");
        return json({ error: "Stripe is not configured on the server. Check STRIPE_SECRET_KEY." }, 500);
      }

      // Step 2: Auth
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        console.error("[billing] No Authorization header");
        return json({ error: "Missing Authorization header" }, 401);
      }
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.error("[billing] Missing SUPABASE_URL or SUPABASE_ANON_KEY");
        return json({ error: "Server misconfiguration (Supabase env)" }, 500);
      }

      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData.user) {
        console.error("[billing] getUser failed:", userErr?.message);
        return json({ error: `Authentication failed: ${userErr?.message || "no user"}` }, 401);
      }
      const userId = userData.user.id;
      console.log("[billing] Authenticated user:", userId);

      // Step 3: Parse body
      let body: { planType?: string; action?: string };
      try {
        body = await req.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }
      const planType = body.planType as PlanType | undefined;
      if (planType !== "weekly" && planType !== "fortnightly") {
        console.error("[billing] Invalid planType:", planType);
        return json({ error: `Invalid planType: ${planType}` }, 400);
      }
      console.log("[billing] planType:", planType);

      // Step 4: Price lookup
      const stripePriceId = priceId(planType);
      if (!stripePriceId) {
        console.error("[billing] No price ID for plan. STRIPE_PRICE_WEEKLY:", !!STRIPE_PRICE_WEEKLY, "STRIPE_PRICE_FORTNIGHTLY:", !!STRIPE_PRICE_FORTNIGHTLY);
        return json({
          error: `No Stripe price configured for "${planType}". Set STRIPE_PRICE_${planType.toUpperCase()} in Supabase secrets.`,
        }, 500);
      }
      console.log("[billing] Using price:", stripePriceId);

      // Step 5: Get or create Stripe customer
      const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: profile } = await svc
        .from("profiles")
        .select("email, first_name, last_name")
        .eq("id", userId)
        .maybeSingle();

      let customerId: string | null = null;
      const { data: existingSub } = await svc
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (existingSub?.stripe_customer_id) {
        customerId = existingSub.stripe_customer_id;
        console.log("[billing] Existing Stripe customer:", customerId);
      }

      if (!customerId) {
        console.log("[billing] Creating new Stripe customer…");
        const customer = await stripe.customers.create({
          email: profile?.email ?? userData.user.email ?? undefined,
          name:
            [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
            undefined,
          metadata: { supabase_user_id: userId },
        });
        customerId = customer.id;
        console.log("[billing] Created customer:", customerId);
      }

      // Step 6: Create Checkout Session
      console.log("[billing] Creating checkout session…");
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: stripePriceId, quantity: 1 }],
        success_url: `${APP_URL}/settings?tab=payments&checkout=success`,
        cancel_url: `${APP_URL}/settings?tab=payments&checkout=cancelled`,
        metadata: { supabase_user_id: userId, plan_type: planType },
        allow_promotion_codes: true,
      });

      console.log("[billing] Checkout session created:", session.id);
      return json({ url: session.url });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      console.error("[billing] checkout error:", msg, e);
      return json({ error: msg }, 500);
    }
  }

  return json({ error: "Not found" }, 404);
});
