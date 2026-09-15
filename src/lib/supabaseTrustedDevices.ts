import { supabase } from "./supabaseClient";
import { getLegacyDeviceFingerprint } from "./deviceFingerprint";

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

async function hasTrustedFingerprintInDb(
  userId: string,
  fingerprint: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("trusted_devices")
    .select("id")
    .eq("user_id", userId)
    .eq("device_fingerprint", fingerprint)
    .maybeSingle();

  if (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn("[trusted_devices] lookup failed:", error.message);
    }
    return false;
  }
  return !!data;
}

export async function isDeviceTrusted(userId: string, fingerprint: string): Promise<boolean> {
  const legacyFingerprint = getLegacyDeviceFingerprint();
  const localStored = getLocalTrust(userId);
  const localMatch =
    localStored === fingerprint ||
    (legacyFingerprint !== fingerprint && localStored === legacyFingerprint);

  if (await hasTrustedFingerprintInDb(userId, fingerprint)) {
    setLocalTrust(userId, fingerprint);
    return true;
  }

  // v12 ships a new fingerprint formula. If this install was trusted under v1,
  // recognize the legacy row and migrate to the v2 fingerprint — no OTP email.
  if (
    legacyFingerprint !== fingerprint &&
    (await hasTrustedFingerprintInDb(userId, legacyFingerprint))
  ) {
    await addTrustedDevice(userId, fingerprint, "Migrated from legacy fingerprint");
    return true;
  }

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
