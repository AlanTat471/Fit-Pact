import { supabase } from "./supabaseClient";
import { getSubscription } from "./supabaseSubscription";
import { getUserPref } from "./supabaseUserPrefs";

export type BillingAction = "setup" | "checkout" | "activate";
export type PaidPlanType = "monthly" | "annual";

export async function callBillingApi(
  planType: PaidPlanType | undefined,
  action: BillingAction,
): Promise<{ url?: string; success?: boolean; error?: string; needsPaymentSetup?: boolean }> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    throw new Error("Could not verify your session. Please sign in again.");
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase configuration.");
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/billing`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionData.session.access_token}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ planType, action }),
  });

  const text = await res.text();
  let payload: { url?: string; success?: boolean; error?: string; needsPaymentSetup?: boolean } = {};
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`Server returned non-JSON (${res.status})`);
  }

  if (!res.ok) {
    return { error: payload.error || `Server error ${res.status}`, needsPaymentSetup: payload.needsPaymentSetup };
  }
  return payload;
}

export async function deleteUserAccount(): Promise<void> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    throw new Error("Could not verify your session. Please sign in again.");
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const res = await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionData.session.access_token}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({}),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.error || "Could not delete account.");
  }
}

export interface PremiumAccessState {
  premiumUnlocked: boolean;
  hasEverSubscribed: boolean;
  pendingPlan: string | null;
  paymentMethodSaved: boolean;
  activePlan: string;
}

export async function loadPremiumAccessState(userId: string): Promise<PremiumAccessState> {
  const [sub, unlockedPref, everPref, pendingPref, paymentPref, planPref] = await Promise.all([
    getSubscription(userId),
    getUserPref(userId, "weightLossPhaseUnlocked"),
    getUserPref(userId, "hasEverSubscribed"),
    getUserPref(userId, "pendingPlan"),
    getUserPref(userId, "paymentMethodSaved"),
    getUserPref(userId, "activePlan"),
  ]);

  const subActive =
    sub?.status === "active" ||
    sub?.status === "trialing" ||
    sub?.status === "past_due";

  const premiumUnlocked =
    unlockedPref === "true" ||
    subActive ||
    localStorage.getItem("weightLossPhaseUnlocked") === "true";

  const hasEverSubscribed =
    everPref === "true" ||
    subActive ||
    localStorage.getItem("hasEverSubscribed") === "true";

  return {
    premiumUnlocked,
    hasEverSubscribed,
    pendingPlan: pendingPref || localStorage.getItem("pendingPlan"),
    paymentMethodSaved: paymentPref === "true" || localStorage.getItem("paymentMethodSaved") === "true",
    activePlan: planPref || localStorage.getItem("activePlan") || "free",
  };
}
