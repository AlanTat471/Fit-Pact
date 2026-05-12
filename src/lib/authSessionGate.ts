/**
 * Supabase persists the JWT in localStorage, which survives app/browser restarts.
 * We only allow that session to be used in this document/tab after an explicit
 * successful sign-in or registration in the same session — stored in sessionStorage
 * so a new visit (new app launch / new tab) requires signing in again.
 */
export const NUMI_LOGIN_OK_THIS_DOCUMENT_KEY = "numiLoginOkThisDocument";

export function markExplicitLoginThisDocument(): void {
  try {
    sessionStorage.setItem(NUMI_LOGIN_OK_THIS_DOCUMENT_KEY, "1");
  } catch {
    /* private mode */
  }
}

export function clearExplicitLoginThisDocument(): void {
  try {
    sessionStorage.removeItem(NUMI_LOGIN_OK_THIS_DOCUMENT_KEY);
  } catch {
    /* no-op */
  }
}
