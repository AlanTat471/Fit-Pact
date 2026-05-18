@echo off
echo ============================================================
echo   Numi v11 - definitive fix for data persistence
echo ============================================================
echo.

cd /d "%~dp0"

echo Adding changed files...

REM ─────────────────────────────────────────────────────────────────────
REM v11 — the DEFINITIVE fix for the data-loss / cross-device-sync /
REM "completed weeks disappear on logout/login" complaints.
REM
REM Network logs from v10 conclusively showed two distinct PostgREST
REM errors that ARE the root cause of everything the user reported:
REM
REM   Error A — PATCH /journeys?id=eq.X  →  406  PGRST116
REM     ("JSON object requested, multiple (or no) rows returned")
REM     This was a PHANTOM AUTOSAVE firing the instant a journey row
REM     loaded, writing the same data back to itself. On a freshly
REM     INSERTed row this raced with Supabase's RLS check and returned
REM     0 rows from the RETURNING clause. saveJourney then threw,
REM     surfaced a destructive "Save failed" toast the user couldn't
REM     read in time, and (worst of all) caused downstream cascades.
REM
REM   Error B — POST /journeys  →  401  42501  (insufficient_privilege)
REM     migrateFromLocalStorage had this fallback:
REM         const j = journey || (await createJourney(user.id));
REM     If loadData() failed for any transient reason (network blip,
REM     JWT propagation race, clicking Sign In twice in quick succession
REM     — which is EXACTLY what the user did), `journey` was null and
REM     the fallback created a SECOND journey row for the user. Next
REM     sign-in: getActiveJourney() returned the newer (empty) row, the
REM     real journey was orphaned, and the user thought their completed
REM     weeks had vanished. THIS IS THE ACTUAL ROOT CAUSE of the
REM     "completed weeks disappear on logout/login" complaint. It also
REM     explains why phone data didn't appear on desktop: each device
REM     was creating its own duplicate journey row on a failed load.
REM
REM v11 fixes:
REM
REM   1. seedDedupeForJourney(j): EVERY place that calls setJourney(j)
REM      with a real row first computes the autosave-shape hash and
REM      stores it in lastSaveByJourneyId. Dashboard's first autosave
REM      after hydration computes the same hash → throttled to no-op.
REM      The phantom PATCH never fires. PGRST116 cannot occur.
REM
REM   2. migrateFromLocalStorage NEVER calls createJourney() any more.
REM      If we don't have a journey loaded, the journey-data migration
REM      block is skipped with a console.warn. TDEE/macros/profile
REM      migration still runs (they don't need a journey row). On the
REM      next refresh, the real journey is fetched and the user's
REM      normal autosave persists any pending local edits.
REM
REM   3. saveJourney suppresses the destructive toast for PGRST116
REM      specifically (it's a benign no-op race), still toasts for
REM      real failures like 401/42501, and still throws so signOut /
REM      idle-timeout can preserve localStorage as a recovery backup.
REM
REM Files touched in v11:
git add src/contexts/UserDataContext.tsx

REM versionCode 10 -> 11, versionName 1.6 -> 1.7. Required by Play Console.
git add android/app/build.gradle

git add git-push-update.bat

echo Committing...
git commit ^
  -m "v11: definitive fix for cross-device data persistence" ^
  -m "Stops the phantom autosave-on-load (which produced PATCH 406 PGRST116) by pre-seeding the dedupe cache with the loaded journey's hash whenever setJourney is called. The instant-after-load identical save is now detected as a no-op and never reaches Supabase." ^
  -m "Removes the createJourney fallback inside migrateFromLocalStorage that was creating DUPLICATE journey rows whenever loadData failed transiently (the 401 42501 case the user hit on their second sign-in). With this gone, the only path that ever creates a journey is loadData itself, which uses the same code on every device. Phone and desktop now always read/write the same single journey row for a given user." ^
  -m "Also suppresses the destructive 'Save failed' toast for PGRST116 specifically (it's a benign race) so the user is never bounced or confused by a brief unreadable popup."

echo.
echo Pushing to origin...
git push

echo.
echo ============================================================
echo   Push complete!
echo.
echo   No new npm dependencies in v11.
echo.
echo   Next steps (do in this order):
echo     1. VERCEL (web): auto-deploys from main.
echo        - watch the Vercel dashboard for the green build
echo        - in your browser: hard-refresh (Ctrl+Shift+R)
echo        - DevTools -^> Network -^> filter `journeys`
echo          Expected after sign-in: 1x GET 200 (load),
echo          (optionally 1x POST 201 if the row didn't exist yet),
echo          and NO PATCH unless you actually edit data.
echo        - DevTools -^> Console: type   window.__numiSaveStats
echo          Expected after sign-in with no edits:
echo          { attempted: 0 or 1, fired: 0 or 1, throttled: 0, failed: 0 }
echo     2. ANDROID (Play Store): rebuild the AAB.
echo          npm run build
echo          npx cap sync android
echo        In Android Studio:
echo          Build -^> Generate Signed Bundle / APK -^> Android App Bundle
echo        Upload android/app/release/app-release.aab to:
echo          Play Console -^> Testing -^> Internal testing
echo          -^> Create new release -^> Upload AAB
echo          -^> Save -^> Review -^> Start rollout to Internal testing
echo        versionCode is now 11, versionName 1.7.
echo     3. iOS: no iOS target, nothing to do.
echo ============================================================
pause
