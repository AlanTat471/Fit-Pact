/**
 * Generate a simple device fingerprint for "trusted device" detection.
 * Used to determine if OTP is required on sign-in (new device = not trusted).
 */
export function getDeviceFingerprint(): string {
  // Intentionally omit screen size / window size — they change with monitor, zoom, or
  // window resize and were causing the same PC to be treated as a "new device" every login.
  const parts = [
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
