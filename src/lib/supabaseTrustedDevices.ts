import { supabase } from "./supabaseClient";

/** Legacy single key — no longer written; per-user keys preferred. */
const TRUSTED_DEVICE_KEY_LEGACY = "wlbd_trusted_device";

function trustStorageKey(userId: string): string {
  return `wlbd_trust_${userId}`;
}

/** Remember this browser install as verified for this user (offline fallback if Supabase read fails). */
function setLocalTrust(userId: string, fingerprint: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(trustStorageKey(userId), fingerprint);
    localStorage.removeItem(TRUSTED_DEVICE_KEY_LEGACY);
  } catch {
    /* quota / private mode */
  }
}

function getLocalTrust(userId: string): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(trustStorageKey(userId));
  } catch {
    return null;
  }
}

export async function isDeviceTrusted(userId: string, fingerprint: string): Promise<boolean> {
  const localMatch = getLocalTrust(userId) === fingerprint;

  const { data, error } = await supabase
    .from("trusted_devices")
    .select("id")
    .eq("user_id", userId)
    .eq("device_fingerprint", fingerprint)
    .maybeSingle();

  if (!error && data) {
    setLocalTrust(userId, fingerprint);
    return true;
  }

  if (error) {
    if (import.meta.env.DEV) {
      // Common causes: RLS mis-config on `trusted_devices`, table missing, or network.
      // eslint-disable-next-line no-console
      console.warn("[trusted_devices] isDeviceTrusted failed — using local cache if any:", error.message);
    }
    return localMatch;
  }

  // No row in DB — still trust local match (e.g. DB insert failed earlier but device was verified).
  return localMatch;
}

export async function addTrustedDevice(
  userId: string,
  fingerprint: string,
  label?: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("trusted_devices").upsert(
    {
      user_id: userId,
      device_fingerprint: fingerprint,
      device_label: label || "Unknown device",
      last_used_at: new Date().toISOString(),
    },
    { onConflict: "user_id,device_fingerprint" }
  );

  if (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn("[trusted_devices] addTrustedDevice:", error.message);
    }
    setLocalTrust(userId, fingerprint);
    return { error: new Error(error.message) };
  }

  setLocalTrust(userId, fingerprint);
  return { error: null };
}

export function getStoredFingerprint(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(TRUSTED_DEVICE_KEY_LEGACY);
}

export function clearStoredFingerprint(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(TRUSTED_DEVICE_KEY_LEGACY);
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith("wlbd_trust_")) localStorage.removeItem(k);
    });
  } catch {
    /* no-op */
  }
}
