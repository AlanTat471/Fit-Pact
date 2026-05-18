@echo off
echo ================================================
echo   Numi v10 - hard cap on saveJourney + diagnostics
echo ================================================
echo.

cd /d "%~dp0"

echo Adding changed files...

REM v10 fixes a render-speed infinite save loop where Supabase was being
REM hammered with thousands of identical PATCH /journeys requests every
REM second after sign-in.
REM
REM v9 ALREADY:
REM   - Tracked in-flight saves via journeySaveFlush so logout/idle wait
REM     for the network round-trip before clearing localStorage.
REM   - Made flushJourneySave stable (zero useCallback deps) via refs.
REM   - Added a JSON-equality dedupe inside Dashboard's autosave path.
REM
REM ...but the user still saw 5,000+ identical PATCHes accumulate post-
REM sign-in. The dedupe was clearly being bypassed by SOMETHING (a future
REM caller we hadn't found yet, or a render path that produced subtly
REM different JSON for logically identical content).
REM
REM v10 fix:
REM   1. Move the dedupe DOWN to UserDataContext.saveJourney itself, the
REM      single chokepoint every caller goes through. No matter how often
REM      anyone calls saveJourney with the same content for the same
REM      journey id within 1.5s, only ONE PATCH actually fires.
REM   2. Use stableStringify (sorted keys at every level) for the hash so
REM      the comparison is genuinely content-based, not order-sensitive.
REM      A render that builds the payload in a different property order
REM      cannot defeat the dedupe.
REM   3. Track save attempts in a module-scope counter exposed on
REM      window.__numiSaveStats so the next time a loop appears we can
REM      see {attempted, fired, throttled, failed} live in DevTools.
REM   4. Console.warn on the 1st throttled save and every 100th after
REM      that, so a runaway caller is visible in DevTools immediately.
REM
REM Files touched in v10:
git add src/contexts/UserDataContext.tsx
git add src/pages/Dashboard.tsx

REM versionCode 9 -> 10, versionName 1.5 -> 1.6. Required by Play Console.
git add android/app/build.gradle

git add git-push-update.bat

echo Committing...
git commit ^
  -m "v10: hard cap saveJourney() to prevent runaway PATCH loop" ^
  -m "v9 saw 5k+ identical PATCH /journeys requests accumulate per sign-in despite component-level dedupe. v10 moves the dedupe into UserDataContext.saveJourney itself (single chokepoint) and uses stableStringify so property-order differences cannot bypass it. Min interval 1500ms between identical saves for the same journey id." ^
  -m "Also exposes window.__numiSaveStats {attempted, fired, throttled, failed} and logs a console.warn on the 1st throttled call and every 100th after, so any future runaway caller is visible in DevTools without a redeploy."

echo.
echo Pushing to origin...
git push

echo.
echo ================================================
echo   Push complete!
echo.
echo   This release does NOT add any new dependencies.
echo.
echo   Next steps (do in this order):
echo     1. Vercel (web): auto-deploys from main branch.
echo        - confirm the build went green in the Vercel dashboard
echo        - hard-refresh https://yourapp.com (Ctrl+Shift+R)
echo        - open DevTools -^> Network tab, filter `journeys`
echo          You should see at most a handful of PATCHes per minute
echo          (NOT a continuous stream).
echo        - in DevTools -^> Console, type:  window.__numiSaveStats
echo          and press Enter. You'll see {attempted, fired, throttled,
echo          failed}. If `throttled` is climbing fast that's the cap
echo          doing its job - tell me the numbers and we'll trace the
echo          underlying caller.
echo     2. Android (Capacitor + Play Store): rebuild the AAB.
echo          npm run build
echo          npx cap sync android
echo        Then in Android Studio:
echo          Build -^> Generate Signed Bundle / APK -^> Android App Bundle
echo        Upload android/app/release/app-release.aab to:
echo          Play Console -^> Testing -^> Internal testing
echo          -^> Create new release -^> Upload AAB
echo          -^> Save -^> Review release -^> Start rollout to Internal testing
echo        versionCode is already 10, versionName 1.6.
echo        Install v10 on the phone via Play Store (clear Play Store cache
echo        first if it doesn't appear within a few minutes).
echo     3. iOS: no iOS target, nothing to do.
echo ================================================
pause
