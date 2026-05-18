import { useEffect, useRef } from "react";
import { MaterialIcon } from "@/components/ui/material-icon";
import { BottomNav } from "@/components/BottomNav";
import { HamburgerMenu } from "@/components/HamburgerMenu";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { MOTIV_QUOTE_SESSION_KEY } from "@/lib/motivationalQuotes";
import { clearExplicitLoginThisDocument } from "@/lib/authSessionGate";
import { flushPendingJourneySave, waitForInFlightSaves } from "@/lib/journeySaveFlush";

interface AppLayoutProps {
  children: React.ReactNode;
}

/** How long the user can be inactive (foreground or backgrounded) before we
 *  force a sign-out. 5 minutes balances security with not interrupting
 *  legitimate "read-and-think" moments. */
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

/** sessionStorage flag read by the Login page (Index.tsx) to decide whether
 *  to surface the "you were signed out for inactivity" popup. We use
 *  sessionStorage (not localStorage) so the message clears on a manual
 *  sign-in without us having to remember to remove it everywhere. */
const IDLE_FLAG_KEY = "numiIdleSignOut";

export default function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const hasRedirectedRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (loading) return;
    if (session) {
      hasRedirectedRef.current = false;
      return;
    }
    const revalidate = async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (s) return;
      if (!hasRedirectedRef.current) {
        hasRedirectedRef.current = true;
        navigate("/", { replace: true });
      }
    };
    revalidate();
  }, [loading, session, navigate]);

  // Idle-timeout watcher.
  // Only mounts while the user is signed in. Listens for any pointer/keyboard
  // activity AND for the page becoming hidden (app minimised on Android).
  // Any of those events resets the 5-minute timer. When the timer fires we
  // sign the user out via Supabase, set the flag so the Login page shows the
  // toast, and let the existing redirect effect navigate to "/".
  useEffect(() => {
    if (!session) return;

    const resetTimer = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(async () => {
        // Set the flag BEFORE signing out so it's visible to Index.tsx the
        // moment AuthContext propagates the SIGNED_OUT event.
        try { sessionStorage.setItem(IDLE_FLAG_KEY, "1"); } catch { /* no-op */ }
        try { sessionStorage.removeItem(MOTIV_QUOTE_SESSION_KEY); } catch { /* no-op */ }
        try { clearExplicitLoginThisDocument(); } catch { /* no-op */ }
        // CRITICAL: persist any unsaved Dashboard changes BEFORE invalidating
        // the Supabase session. The user has been idle ≥5 min and is about to
        // be signed out — if they completed a week (or edited a field) within
        // the 800ms autosave debounce just before going idle, the save would
        // otherwise be cancelled when Dashboard unmounts after redirect.
        //
        // flushPendingJourneySave() kicks off any pending debounced save, then
        // waitForInFlightSaves() blocks until EVERY in-flight Supabase write
        // has actually landed. Only then do we call supabase.auth.signOut(),
        // which revokes the JWT server-side. Without the await, on Android
        // the in-flight write would race the token revocation and lose.
        try { flushPendingJourneySave(); } catch { /* no-op */ }
        try { await waitForInFlightSaves(); } catch (e) {
          console.error("[AppLayout idle] save did not finish in time:", e);
        }
        // Use supabase.auth.signOut() directly (not AuthContext.signOut())
        // to avoid wiping cached journey/dashboard data. The user is just
        // being timed out, not deliberately quitting — their data should be
        // ready to read again the moment they sign back in.
        try { await supabase.auth.signOut(); } catch { /* no-op */ }
      }, IDLE_TIMEOUT_MS);
    };

    const onActivity = () => resetTimer();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        // App minimised: snap the timer to fire after exactly IDLE_TIMEOUT_MS
        // measured from this moment. (resetTimer does that.)
        resetTimer();
      } else if (document.visibilityState === "visible") {
        // User came back: also reset, since they're clearly still active.
        resetTimer();
      }
    };

    // Activity events. `passive: true` keeps scroll-perf intact.
    const events: Array<keyof WindowEventMap> = [
      "mousedown", "touchstart", "keydown", "scroll", "wheel",
    ];
    events.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));
    document.addEventListener("visibilitychange", onVisibility);

    resetTimer();

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, onActivity));
      document.removeEventListener("visibilitychange", onVisibility);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [session]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Redirecting to sign in…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col w-full bg-background text-foreground">
      <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-xl px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <HamburgerMenu />
        </div>
        <h1
          className="text-2xl font-bold text-primary lowercase tracking-tight cursor-pointer"
          onClick={() => navigate("/dashboard")}
        >
          Numi
        </h1>
        <button className="p-2 text-on-surface-variant hover:text-primary transition-colors rounded-full hover:bg-surface-container-high">
          <MaterialIcon name="notifications" size="md" />
        </button>
      </header>

      <main className="flex-1 pt-20 pb-36 px-4 sm:px-6 overflow-x-hidden max-w-2xl mx-auto w-full" style={{ paddingBottom: "calc(9rem + env(safe-area-inset-bottom, 0))" }}>
        {children}
      </main>

      <BottomNav />
    </div>
  );
}
