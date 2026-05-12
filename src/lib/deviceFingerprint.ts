/**
 * Generate a stable-enough device fingerprint for "trusted device" detection.
 * We include a per-install random id so mobile/desktop OS or WebView updates
 * that tweak userAgent alone do not flip the device to "new" every sign-in.
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
  const parts = [
    getOrCreateInstallId(),
    navigator.userAgent,
    navigator.language,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 0,
  ];
  const str = parts.join("|");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `wlbd_${Math.abs(hash).toString(36)}`;
}
