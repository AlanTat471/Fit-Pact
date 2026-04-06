import { supabase } from "./supabaseClient";

/** Check if email is already registered (auth.users) */
export async function checkEmailExists(email: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("check_email_exists", {
    p_email: email.trim(),
  });
  if (error) {
    console.error("[Supabase] checkEmailExists error:", error);
    return false;
  }
  return data === true;
}

/** Check if mobile is already registered (profiles) */
export async function checkMobileExists(mobile: string): Promise<boolean> {
  if (!mobile || !mobile.trim()) return false;
  const { data, error } = await supabase.rpc("check_mobile_exists", {
    p_mobile: mobile.trim(),
  });
  if (error) {
    console.error("[Supabase] checkMobileExists error:", error);
    return false;
  }
  return data === true;
}
