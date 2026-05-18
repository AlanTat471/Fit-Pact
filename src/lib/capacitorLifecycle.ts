/**
 * Android lifecycle bridge: persist pending Dashboard saves whenever the
 * Capacitor WebView is paused, backgrounded, or its app state changes.
 *
 * Why this exists:
 *   The browser `beforeunload` and `pagehide` events that work fine on desktop
 *   and (mostly) on iOS are notoriously unreliable inside the Android WebView.
 *   When the user presses the Home button, switches apps, or the OS reclaims
 *   memory, those events frequently never fire. That meant our v8 fix — which
 *   relied on those events to flush in-memory dashboard state — was a no-op
 *   on Android in exactly the cases users hit most often.
 *
 * What this does:
 *   When running inside a Capacitor app, we subscribe to:
 *     • `pause`            – fires when the app is being backgrounded.
 *     • `appStateChange`   – fires with isActive=false on background, true on
 *                            resume; we react to both so a user who quickly
 *                            tabs away+back still gets a save.
 *   Each event triggers flushPendingJourneySave() so any pending Dashboard
 *   debounce gets sent to Supabase immediately. We don't await the result —
 *   the Android lifecycle gives us only a brief window before the WebView is
 *   frozen, and Supabase's request will leave the device using the still-valid
 *   JWT.
 *
 *   On the web (Vercel) this module is a no-op because Capacitor.isNativePlatform()
 *   returns false, so we still rely on beforeunload/pagehide there.
 */
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { flushPendingJourneySave } from "./journeySaveFlush";

let initialised = false;

export async function installCapacitorLifecycleHooks(): Promise<void> {
  if (initialised) return;
  if (!Capacitor.isNativePlatform()) return; // Web / Vercel: nothing to do.
  initialised = true;

  try {
    await App.addListener("pause", () => {
      try {
        flushPendingJourneySave();
      } catch (e) {
        console.error("[capacitorLifecycle] flush on pause threw:", e);
      }
    });

    await App.addListener("appStateChange", ({ isActive }) => {
      // Fire on transitions to inactive. Resuming doesn't need a flush; it's
      // a good moment to do nothing and let the user keep working.
      if (!isActive) {
        try {
          flushPendingJourneySave();
        } catch (e) {
          console.error("[capacitorLifecycle] flush on appStateChange threw:", e);
        }
      }
    });
  } catch (e) {
    // If the @capacitor/app plugin isn't actually registered on this build
    // (e.g. forgot npx cap sync android), don't crash the app – just log it.
    console.error("[capacitorLifecycle] failed to register Capacitor App listeners:", e);
  }
}
