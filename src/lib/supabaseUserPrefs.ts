import { supabase } from "./supabaseClient";

export async function getUserPref(userId: string, key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("user_preferences")
    .select("value")
    .eq("user_id", userId)
    .eq("key", key)
    .maybeSingle();

  if (error) {
    console.error("[Supabase] getUserPref error:", error);
    return null;
  }
  return data?.value ?? null;
}

export async function setUserPref(userId: string, key: string, value: string): Promise<boolean> {
  const { error } = await supabase.from("user_preferences").upsert(
    { user_id: userId, key, value },
    { onConflict: "user_id,key" }
  );
  if (error) {
    console.error("[Supabase] setUserPref error:", error);
    return false;
  }
  return true;
}
