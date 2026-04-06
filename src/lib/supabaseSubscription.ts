import { supabase } from "./supabaseClient";

export interface SubscriptionRow {
  id: string;
  user_id: string;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  stripe_price_id: string | null;
  status: "free" | "active" | "cancelled" | "past_due" | "trialing";
  plan_type: "free" | "weekly" | "fortnightly";
  cancel_at_period_end: boolean;
  current_period_start: string | null;
  current_period_end: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function getSubscription(
  userId: string
): Promise<SubscriptionRow | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[Supabase] getSubscription error:", error);
    return null;
  }
  return data as SubscriptionRow | null;
}

export async function upsertSubscription(
  userId: string,
  payload: Partial<Omit<SubscriptionRow, "id" | "user_id" | "created_at">>
): Promise<SubscriptionRow | null> {
  const row = {
    ...payload,
    user_id: userId,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("subscriptions")
    .upsert(row, { onConflict: "user_id" })
    .select()
    .single();

  if (error) {
    console.error("[Supabase] upsertSubscription error:", error);
    return null;
  }
  return data as SubscriptionRow;
}
