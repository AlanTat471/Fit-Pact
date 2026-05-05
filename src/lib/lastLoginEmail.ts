/** Last successful sign-in email — pre-fills the login field (not a secret). */
const KEY = "numiLastEmail";

/** Leftover from an older build with biometric opt-in; safe to remove. */
const LEGACY_BIOMETRIC_FLAG = "numiBiometricEnabled";

export function getLastEmail(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export function setLastEmail(email: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, email.trim());
  } catch {
    /* private mode / quota */
  }
}

/** One-time cleanup when the login screen loads after removing biometrics. */
export function clearLegacyBiometricKeys(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LEGACY_BIOMETRIC_FLAG);
  } catch {
    /* no-op */
  }
}
