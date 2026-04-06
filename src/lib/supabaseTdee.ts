import { supabase } from "./supabaseClient";

export interface TdeeRow {
  id: string;
  user_id: string;
  current_bmi: string | null;
  body_fat_percentage: string | null;
  classification: string | null;
  current_weight: string | null;
  weight_to_lose: string | null;
  height: string | null;
  starting_calorie_intake: string | null;
  suggested_weight_goal: string | null;
  values_json: Record<string, unknown> | null;
}

export async function getLatestTdee(userId: string): Promise<TdeeRow | null> {
  const { data, error } = await supabase
    .from("tdee_values")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[Supabase] getLatestTdee error:", error);
    return null;
  }
  return data as TdeeRow | null;
}

export async function upsertTdee(
  userId: string,
  payload: Partial<Omit<TdeeRow, "id" | "user_id">>
): Promise<TdeeRow | null> {
  const { data: existing } = await supabase
    .from("tdee_values")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const row = { ...payload, user_id: userId, updated_at: new Date().toISOString() };

  if (existing) {
    const { data, error } = await supabase
      .from("tdee_values")
      .update(row)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) {
      console.error("[Supabase] upsertTdee update error:", error);
      return null;
    }
    return data as TdeeRow;
  }

  const { data, error } = await supabase.from("tdee_values").insert(row).select().single();
  if (error) {
    console.error("[Supabase] upsertTdee insert error:", error);
    return null;
  }
  return data as TdeeRow;
}
