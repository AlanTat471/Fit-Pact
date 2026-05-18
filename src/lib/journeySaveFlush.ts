/**
 * Cross-file coordination for "flush any pending Dashboard journey save NOW".
 *
 * Problem this solves:
 *   Dashboard.tsx batches journey writes behind an 800ms debounce so we don't
 *   hammer Supabase while the user is typing daily steps / calories / weight.
 *   That debounce is a `setTimeout` whose cleanup cancels the pending save
 *   when the Dashboard unmounts. That meant logging out, idle-timing out, or
 *   navigating away within the debounce window silently dropped the user's
 *   most recent changes (e.g. completing a week) – the change never reached
 *   Supabase, and AuthContext.signOut() then wiped the local copy as well, so
 *   on the next login the user saw stale data on EVERY device.
 *
 * How this module fixes it:
 *   The Dashboard registers a synchronous flush callback when it mounts. Any
 *   code path that is about to invalidate the session (manual sign-out, idle
 *   timeout, tab close) calls {@link flushPendingJourneySave} BEFORE clearing
 *   storage or calling supabase.auth.signOut(). The flush cancels the pending
 *   debounce timer and immediately fires `saveJourney(latestPayload)` so the
 *   HTTP request leaves the browser while the JWT is still valid.
 *
 * The registry is a Set so multiple registrations are safe; in practice only
 * one Dashboard exists at a time but this keeps the API forgiving.
 */
type FlushFn = () => void;

const flushHandlers = new Set<FlushFn>();

/**
 * Register a flush handler. Returns an unregister function – callers must
 * invoke it on component unmount to avoid leaking stale handlers that close
 * over a torn-down React tree.
 */
export function registerJourneyFlush(fn: FlushFn): () => void {
  flushHandlers.add(fn);
  return () => {
    flushHandlers.delete(fn);
  };
}

/**
 * Fire every registered flush handler. Errors in any one handler are caught
 * and logged so a single broken handler can't block sign-out or block the
 * other handlers from running.
 *
 * Important: handlers are expected to be synchronous (they kick off async
 * Supabase requests but don't await them). This keeps the function safe to
 * call from places like `beforeunload` where async work would be dropped.
 */
export function flushPendingJourneySave(): void {
  for (const fn of flushHandlers) {
    try {
      fn();
    } catch (e) {
      console.error("[journeySaveFlush] flush handler threw:", e);
    }
  }
}
