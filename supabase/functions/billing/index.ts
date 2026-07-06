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
const STRIPE_PRICE_MONTHLY = env("STRIPE_PRICE_MONTHLY");
const STRIPE_PRICE_ANNUAL = env("STRIPE_PRICE_ANNUAL");
const APP_URL = env("APP_URL") || "http://localhost:5173";
const SUPABASE_URL = env("SUPABASE_URL");
const SUPABASE_ANON_KEY = env("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");

let stripe: Stripe | null = null;
try {
  if (STRIPE_SECRET_KEY) {
    stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
  }
} catch (e) {
  console.error("[billing] Failed to initialise Stripe client:", e);
}

type PlanType = "monthly" | "annual" | "free";
type BillingAction = "setup" | "checkout" | "activate";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function priceId(plan: PlanType): string | null {
  if (plan === "monthly") return STRIPE_PRICE_MONTHLY || null;
  if (plan === "annual") return STRIPE_PRICE_ANNUAL || null;
  return null;
}

function planFromPrice(pid: string | null | undefined): PlanType {
  if (!pid) return "free";
  if (pid === STRIPE_PRICE_MONTHLY) return "monthly";
  if (pid === STRIPE_PRICE_ANNUAL) return "annual";
  return "free";
}

function isoOrNull(ts: number | null | undefined): string | null {
  return ts ? new Date(ts * 1000).toISOString() : null;
}

async function setUserPref(
  svc: ReturnType<typeof createClient>,
  userId: string,
  key: string,
  value: string,
) {
  await svc.from("user_preferences").upsert(
    { user_id: userId, key, value },
    { onConflict: "user_id,key" },
  );
}

async function unlockPremium(
  svc: ReturnType<typeof createClient>,
  userId: string,
  plan: PlanType,
) {
  await setUserPref(svc, userId, "weightLossPhaseUnlocked", "true");
  await setUserPref(svc, userId, "hasEverSubscribed", "true");
  if (plan !== "free") {
    await setUserPref(svc, userId, "activePlan", plan);
  }
}

async function getOrCreateCustomer(
  svc: ReturnType<typeof createClient>,
  userId: string,
  email?: string | null,
  name?: string,
): Promise<string> {
  if (!stripe) throw new Error("Stripe not configured");

  const { data: existingSub } = await svc
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingSub?.stripe_customer_id) {
    return existingSub.stripe_customer_id;
  }

  const customer = await stripe.customers.create({
    email: email ?? undefined,
    name: name || undefined,
    metadata: { supabase_user_id: userId },
  });

  await svc.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customer.id,
      status: "free",
      plan_type: "free",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  return customer.id;
}

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

  if (activePlan !== "free") {
    await unlockPremium(svc, userId, activePlan);
  } else {
    await setUserPref(svc, userId, "activePlan", "free");
  }
}

async function handleSetupCompleted(
  svc: ReturnType<typeof createClient>,
  sess: Stripe.Checkout.Session,
) {
  const userId = sess.metadata?.supabase_user_id;
  if (!userId || !stripe) return;

  const planType = (sess.metadata?.plan_type as PlanType) || "monthly";
  const custId =
    typeof sess.customer === "string" ? sess.customer : sess.customer?.id;

  if (custId && sess.setup_intent && typeof sess.setup_intent === "string") {
    try {
      const si = await stripe.setupIntents.retrieve(sess.setup_intent);
      if (si.payment_method) {
        await stripe.customers.update(custId, {
          invoice_settings: {
            default_payment_method: si.payment_method as string,
          },
        });
      }
    } catch (e) {
      console.warn("[billing] Could not set default payment method:", e);
    }
  }

  if (custId) {
    await svc.from("subscriptions").upsert(
      {
        user_id: userId,
        stripe_customer_id: custId,
        status: "free",
        plan_type: "free",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  }

  await setUserPref(svc, userId, "pendingPlan", planType);
  await setUserPref(svc, userId, "paymentMethodSaved", "true");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;

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

      if (event.type === "checkout.session.completed") {
        const sess = event.data.object as Stripe.Checkout.Session;
        if (sess.mode === "setup") {
          await handleSetupCompleted(svc, sess);
        } else if (sess.subscription && typeof sess.subscription === "string") {
          const subscription = await stripe.subscriptions.retrieve(sess.subscription);
          await upsertSub(svc, subscription);
        }
      } else if (
        event.type === "customer.subscription.created" ||
        event.type === "customer.subscription.updated" ||
        event.type === "customer.subscription.deleted"
      ) {
        const subscription = event.data.object as Stripe.Subscription;
        await upsertSub(svc, subscription);
      }
      return json({ received: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Webhook error";
      console.error("[billing] webhook error:", msg);
      return json({ error: msg }, 400);
    }
  }

  if (req.method === "POST") {
    try {
      if (!stripe) {
        return json({ error: "Stripe is not configured on the server." }, 500);
      }

      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return json({ error: "Missing Authorization header" }, 401);
      }

      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData.user) {
        return json({ error: "Authentication failed" }, 401);
      }
      const userId = userData.user.id;

      let body: { planType?: string; action?: string };
      try {
        body = await req.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }

      const action = (body.action || "setup") as BillingAction;
      const planType = body.planType as PlanType | undefined;

      const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: profile } = await svc
        .from("profiles")
        .select("email, first_name, last_name")
        .eq("id", userId)
        .maybeSingle();

      const customerName =
        [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
        undefined;

      const customerId = await getOrCreateCustomer(
        svc,
        userId,
        profile?.email ?? userData.user.email,
        customerName,
      );

      // ── Activate subscription (Week 4 Let's Go — charge saved card) ──
      if (action === "activate") {
        const { data: pendingPref } = await svc
          .from("user_preferences")
          .select("value")
          .eq("user_id", userId)
          .eq("key", "pendingPlan")
          .maybeSingle();

        const plan = (pendingPref?.value as PlanType) || planType;
        if (plan !== "monthly" && plan !== "annual") {
          return json({ error: "No plan selected. Please choose a plan in Payment Details first." }, 400);
        }

        const stripePriceId = priceId(plan);
        if (!stripePriceId) {
          return json({ error: `No Stripe price configured for "${plan}".` }, 500);
        }

        const customer = await stripe.customers.retrieve(customerId);
        if ("deleted" in customer && customer.deleted) {
          return json({ error: "Stripe customer not found." }, 400);
        }

        const defaultPm =
          typeof customer.invoice_settings?.default_payment_method === "string"
            ? customer.invoice_settings.default_payment_method
            : null;

        let paymentMethodId = defaultPm;
        if (!paymentMethodId) {
          const pms = await stripe.paymentMethods.list({
            customer: customerId,
            type: "card",
            limit: 1,
          });
          paymentMethodId = pms.data[0]?.id ?? null;
        }

        if (!paymentMethodId) {
          return json({
            error: "No payment method on file. Please add your card in Payment Details first.",
            needsPaymentSetup: true,
          }, 400);
        }

        const subscription = await stripe.subscriptions.create({
          customer: customerId,
          items: [{ price: stripePriceId }],
          default_payment_method: paymentMethodId,
          metadata: { supabase_user_id: userId, plan_type: plan },
        });

        await upsertSub(svc, subscription);
        return json({ success: true, planType: plan });
      }

      if (planType !== "monthly" && planType !== "annual") {
        return json({ error: `Invalid planType: ${planType}` }, 400);
      }

      const stripePriceId = priceId(planType);
      if (!stripePriceId && action === "checkout") {
        return json({ error: `No Stripe price configured for "${planType}".` }, 500);
      }

      // ── Immediate subscription checkout (from Week 4 redirect) ──
      if (action === "checkout") {
        await setUserPref(svc, userId, "pendingPlan", planType);
        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          customer: customerId,
          line_items: [{ price: stripePriceId!, quantity: 1 }],
          success_url: `${APP_URL}/dashboard?checkout=success&unlocked=1`,
          cancel_url: `${APP_URL}/payment-details?from=acclimationComplete&checkout=cancelled`,
          metadata: { supabase_user_id: userId, plan_type: planType },
          allow_promotion_codes: true,
        });
        return json({ url: session.url });
      }

      // ── Setup mode — save card + plan, charge later on Week 4 ──
      await setUserPref(svc, userId, "pendingPlan", planType);
      const session = await stripe.checkout.sessions.create({
        mode: "setup",
        customer: customerId,
        payment_method_types: ["card"],
        success_url: `${APP_URL}/payment-details?setup=success&plan=${planType}`,
        cancel_url: `${APP_URL}/payment-details?setup=cancelled`,
        metadata: { supabase_user_id: userId, plan_type: planType },
      });
      return json({ url: session.url });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      console.error("[billing] error:", msg, e);
      return json({ error: msg }, 500);
    }
  }

  return json({ error: "Not found" }, 404);
});
