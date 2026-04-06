import { supabase } from "./supabaseClient";

const TRUSTED_DEVICE_KEY = "wlbd_trusted_device";

export async function isDeviceTrusted(userId: string, fingerprint: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("trusted_devices")
    .select("id")
    .eq("user_id", userId)
    .eq("device_fingerprint", fingerprint)
    .maybeSingle();

  if (error) return false;
  return !!data;
}

export async function addTrustedDevice(
  userId: string,
  fingerprint: string,
  label?: string
): Promise<void> {
  const { error } = await supabase.from("trusted_devices").upsert(
    {
      user_id: userId,
      device_fingerprint: fingerprint,
      device_label: label || "Unknown device",
      last_used_at: new Date().toISOString(),
    },
    { onConflict: "user_id,device_fingerprint" }
  );
  if (!error && typeof localStorage !== "undefined") {
    localStorage.setItem(TRUSTED_DEVICE_KEY, fingerprint);
  }
}

export function getStoredFingerprint(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(TRUSTED_DEVICE_KEY);
}

export function clearStoredFingerprint(): void {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(TRUSTED_DEVICE_KEY);
  }
}
