/**
 * One-time storage-key migration: fitpact* → numi*
 *
 * The app was previously branded "FitPact". A handful of localStorage and
 * sessionStorage keys still carry the old prefix. To rebrand to "Numi"
 * without wiping returning users' archived journey phases, week-completion
 * flags, or per-day reminder dismissals, we copy each old key to its new
 * name on first load, then delete the old key.
 *
 * Idempotent — safe to run on every app start.
 *
 * Static keys:
 *   fitpactArchivedPhases               → numiArchivedPhases
 *   fitpactPendingMaintenanceAfterWeek12 → numiPendingMaintenanceAfterWeek12
 *   fitpactSeenWelcomeThisSession       → numiSeenWelcomeThisSession (session)
 *   fitpactWelcomeBackShown             → numiWelcomeBackShown (session)
 *
 * Dynamic keys (per WL week + day):
 *   fitpactCalHigh-wl{N}-{day}          → numiCalHigh-wl{N}-{day}
 *   fitpactCalLow-wl{N}-{day}           → numiCalLow-wl{N}-{day}
 */

const STATIC_LOCAL_KEYS: Array<[string, string]> = [
  ["fitpactArchivedPhases", "numiArchivedPhases"],
  ["fitpactPendingMaintenanceAfterWeek12", "numiPendingMaintenanceAfterWeek12"],
];

const STATIC_SESSION_KEYS: Array<[string, string]> = [
  ["fitpactSeenWelcomeThisSession", "numiSeenWelcomeThisSession"],
  ["fitpactWelcomeBackShown", "numiWelcomeBackShown"],
];

const DYNAMIC_PREFIXES: Array<[string, string]> = [
  ["fitpactCalHigh-", "numiCalHigh-"],
  ["fitpactCalLow-", "numiCalLow-"],
];

function migrateStorage(
  store: Storage,
  staticPairs: Array<[string, string]>,
  includeDynamic: boolean,
) {
  // Static keys
  for (const [oldKey, newKey] of staticPairs) {
    try {
      const oldVal = store.getItem(oldKey);
      if (oldVal == null) continue;
      // Only copy if the new key isn't already populated (don't clobber newer data)
      if (store.getItem(newKey) == null) {
        store.setItem(newKey, oldVal);
      }
      store.removeItem(oldKey);
    } catch {
      // ignore quota / access errors per key
    }
  }

  if (!includeDynamic) return;

  // Dynamic keys — must enumerate
  try {
    const allKeys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k) allKeys.push(k);
    }
    for (const k of allKeys) {
      for (const [oldPrefix, newPrefix] of DYNAMIC_PREFIXES) {
        if (k.startsWith(oldPrefix)) {
          const newKey = newPrefix + k.slice(oldPrefix.length);
          try {
            const oldVal = store.getItem(k);
            if (oldVal != null && store.getItem(newKey) == null) {
              store.setItem(newKey, oldVal);
            }
            store.removeItem(k);
          } catch {
            // ignore
          }
          break;
        }
      }
    }
  } catch {
    // ignore enumeration errors
  }
}

/**
 * Run the rebrand migration once per session. Safe + idempotent.
 * Call this from `main.tsx` BEFORE React renders.
 */
export function runFitpactToNumiMigration(): void {
  if (typeof window === "undefined") return;
  try {
    migrateStorage(window.localStorage, STATIC_LOCAL_KEYS, true);
  } catch {
    /* no-op */
  }
  try {
    migrateStorage(window.sessionStorage, STATIC_SESSION_KEYS, false);
  } catch {
    /* no-op */
  }
}
