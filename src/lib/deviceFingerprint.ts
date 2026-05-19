/**
 * Generate a stable device fingerprint for "trusted device" detection.
 *
 * History:
 *   • v1: the hash mixed in navigator.userAgent, navigator.language, timezone
 *     and hardwareConcurrency on top of a localStorage UUID. Intent was extra
 *     resilience, but the result was the opposite — every Chrome / Edge /
 *     Safari / Android WebView auto-update rewrites userAgent, which flipped
 *     the hash, which evicted the device from the Supabase `trusted_devices`
 *     table on the next sign-in, which forced an OTP every ~4 weeks.
 *
 *   • v2 (this code): the fingerprint depends ONLY on the per-install random
 *     UUID stored in localStorage. That UUID is generated once when the user
 *     first lands on the site / installs the app, and stays put until the
 *     browser's localStorage is explicitly cleared (or the Android app's
 *     data is wiped). userAgent updates, language switches, and timezone
 *     changes no longer invalidate trust.
 *
 *   • Migration: existing trusted_devices rows still contain v1 hashes. The
 *     first time a previously-verified user signs in after this change ships,
 *     their fingerprint will not match — they will OTP-verify once. After
 *     that one re-verification, trust is permanent for the life of that
 *     browser profile / app install.
 */
const INSTALL_ID_KEY = "wlbd_install_id";

function getOrCreateInstallId(): string {
  if (typeof localStorage === "undefined") return "noid";
  try {
    let id = localStorage.getItem(INSTALL_ID_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem(INSTALL_ID_KEY, id);
    }
    return id;
  } catch {
    return "noid";
  }
}

export function getDeviceFingerprint(): string {
  // The install ID is already a unique random UUID per browser profile / app
  // install. Hashing it through djb2 (matching the v1 helper) just gives us
  // a compact base36 string with the same `wlbd_` prefix that the rest of
  // the codebase already expects.
  const str = getOrCreateInstallId();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `wlbd_${Math.abs(hash).toString(36)}`;
}
