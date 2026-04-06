import { supabase } from "./supabaseClient";

export async function getCustomMacros(userId: string): Promise<Record<string, number> | null> {
  const { data, error } = await supabase
    .from("custom_macros")
    .select("macros_json")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[Supabase] getCustomMacros error:", error);
    return null;
  }
  return (data?.macros_json as Record<string, number>) || null;
}

export async function upsertCustomMacros(
  userId: string,
  macros: Record<string, number>
): Promise<boolean> {
  const { error } = await supabase.from("custom_macros").upsert(
    {
      user_id: userId,
      macros_json: macros,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) {
    console.error("[Supabase] upsertCustomMacros error:", error);
    return false;
  }
  return true;
}
