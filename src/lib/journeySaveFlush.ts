/**
 * Cross-file coordination for "flush any pending Dashboard journey save NOW"
 * plus a global tracker of every in-flight Supabase save so sign-out paths
 * can wait until all writes have actually reached the server before they
 * invalidate the JWT or wipe localStorage.
 *
 * Problem this solves:
 *   Dashboard.tsx batches journey writes behind an 800ms debounce so we don't
 *   hammer Supabase while the user is typing daily steps / calories / weight.
 *   That debounce is a `setTimeout` whose cleanup cancels the pending save
 *   when the Dashboard unmounts. That meant logging out, idle-timing out, or
 *   navigating away within the debounce window silently dropped the user's
 *   most recent changes (e.g. completing a week).
 *
 *   The v8 fix kicked off a save during unmount but did NOT wait for it.
 *   AuthContext.signOut() then ran supabase.auth.signOut() (which revokes the
 *   JWT) and wiped localStorage. On Android this consistently lost the race:
 *   the save HTTP request was still in flight when the token was revoked, so
 *   Supabase responded 401, the write never landed, and the local copy was
 *   wiped too. Result: every logout/login cycle nuked the user's data.
 *
 * How this module fixes it:
 *   1. Dashboard registers a flush callback (synchronous).
 *   2. Whenever saveJourney fires a Supabase write, the resulting Promise is
 *      added to {@link inFlightSaves}. The Promise removes itself from the
 *      set when it settles.
 *   3. signOut() / idle-timeout / Capacitor pause now call
 *      {@link flushPendingJourneySave} (to kick off any pending debounced
 *      save) and then `await waitForInFlightSaves()` (to make sure that
 *      save AND any earlier in-flight saves have actually finished) BEFORE
 *      revoking the token or clearing localStorage.
 *   4. If waitForInFlightSaves rejects or times out, the caller can preserve
 *      localStorage as a recovery backup instead of wiping it.
 */

type FlushFn = () => void;

const flushHandlers = new Set<FlushFn>();
const inFlightSaves = new Set<Promise<unknown>>();

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
 * Important: handlers themselves are synchronous (they kick off async
 * Supabase requests). To wait for those requests to actually land, also
 * `await waitForInFlightSaves()` after calling this.
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

/**
 * Register a Supabase save Promise so {@link waitForInFlightSaves} can wait
 * for it. The Promise removes itself from the tracker when it settles, so
 * callers don't need to clean up.
 */
export function trackJourneySave<T>(p: Promise<T>): Promise<T> {
  inFlightSaves.add(p);
  // Use .then/.catch instead of .finally so we don't swallow rejections from
  // callers that explicitly chose not to handle them.
  p.then(
    () => inFlightSaves.delete(p),
    () => inFlightSaves.delete(p),
  );
  return p;
}

/**
 * Wait for every currently in-flight save to settle. Resolves once they all
 * complete (either fulfilled or rejected). Rejects only if the timeout fires
 * first – in which case the caller should treat the data as not-yet-persisted
 * and preserve localStorage as a backup instead of wiping it.
 *
 * The default timeout is generous (8s) because we'd rather block sign-out by
 * a few seconds than silently lose user data on a slow network.
 */
export function waitForInFlightSaves(timeoutMs = 8000): Promise<void> {
  if (inFlightSaves.size === 0) return Promise.resolve();
  const all = Promise.allSettled([...inFlightSaves]).then(() => undefined);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return all;
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error(`[journeySaveFlush] timed out after ${timeoutMs}ms waiting for ${inFlightSaves.size} in-flight save(s)`));
    }, timeoutMs);
    all.then(
      () => {
        clearTimeout(t);
        resolve();
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** Test/debug helper – number of saves currently in flight. */
export function getInFlightJourneySaveCount(): number {
  return inFlightSaves.size;
}
