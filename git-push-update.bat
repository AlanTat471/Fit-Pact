@echo off
echo ================================================
echo   Numi v9 - data loss on logout/login finally fixed
echo ================================================
echo.

cd /d "%~dp0"

echo Adding changed files...

REM v9 hardens the v8 flush so it actually waits for Supabase to confirm
REM the write before we revoke the JWT and clear localStorage. v8 was
REM fire-and-forget, so on Android the save consistently raced and lost
REM against the token revocation -> 401 -> data gone on both ends.

REM journeySaveFlush: now tracks every in-flight saveJourney Promise so
REM signOut / idle-timeout / Capacitor pause can `await waitForInFlightSaves()`
REM before tearing the session down.
git add src/lib/journeySaveFlush.ts

REM NEW: capacitorLifecycle wires Capacitor App pause / appStateChange so
REM backgrounding the Android app (Home button, app switcher, OS reclaim)
REM flushes pending saves. beforeunload / pagehide are unreliable inside
REM the Android WebView; this plugin gives us the events we actually need.
git add src/lib/capacitorLifecycle.ts
git add src/main.tsx

REM UserDataContext.saveJourney: wraps the Supabase upsert in trackJourneySave
REM and re-throws on error so callers that DO await (signOut) can detect a
REM failed save and preserve localStorage as recovery backup.
REM Also strengthens migrateFromLocalStorage so a cloud journey that has
REM completed_weeks but empty weekly_data is correctly recognised as having
REM progress (so we don't overwrite it with stale localStorage on next login).
git add src/contexts/UserDataContext.tsx

REM AuthContext.signOut: now awaits waitForInFlightSaves() between
REM flushPendingJourneySave() and supabase.auth.signOut(). If the save
REM failed or timed out, localStorage is preserved so the next login's
REM migrateFromLocalStorage can recover the data.
git add src/contexts/AuthContext.tsx

REM AppLayout idle-timeout: same await-saves-first treatment as signOut.
git add src/layouts/AppLayout.tsx

REM Dashboard.flushJourneySave: no longer gated on a pending debounce – it
REM now always saves the latest payload when asked. Fixes the "user typed a
REM value, debounce fired and finished, user immediately logs out" case
REM where v8 would early-return and not save anything.
git add src/pages/Dashboard.tsx

REM Dependency: @capacitor/app (for the lifecycle listeners above).
git add package.json
git add package-lock.json

REM Android: versionCode 8 -> 9, versionName 1.4 -> 1.5. Required by Play
REM Console for any new AAB upload; bump in lockstep with this commit.
git add android/app/build.gradle

git add git-push-update.bat

echo Committing...
git commit ^
  -m "v9: actually wait for Supabase save before signing out / wiping localStorage" ^
  -m "v8 attempted to flush pending Dashboard saves on logout / idle / unmount but did NOT await them. On Android this consistently lost the race: supabase.auth.signOut() revoked the JWT before the still-in-flight save HTTP request landed, Supabase responded 401, and AuthContext then wiped localStorage. Result: every logout/login cycle nuked the user's completed weeks." ^
  -m "v9 introduces a global in-flight save tracker in journeySaveFlush.ts. Every saveJourney call adds its Promise to the set; signOut / idle-timeout / Capacitor pause call flushPendingJourneySave() to kick off any pending debounce, then await waitForInFlightSaves() before revoking the JWT. If the save fails or times out, localStorage is preserved so the next login can re-migrate. flushJourneySave is no longer gated on a pending debounce so explicit logout always saves." ^
  -m "Also adds @capacitor/app + src/lib/capacitorLifecycle.ts: subscribes to pause / appStateChange so backgrounding the Android app flushes saves too. beforeunload and pagehide are unreliable inside Android WebView; this closes that gap. Web build is unaffected because Capacitor.isNativePlatform() is false there."

echo.
echo Pushing to origin...
git push

echo.
echo ================================================
echo   Push complete!
echo.
echo   THIS RELEASE REQUIRES `npm install` BEFORE BUILDING because
echo   @capacitor/app was added to package.json.
echo.
echo   Next steps (do in this order):
echo     1. Vercel (web): auto-deploys from main branch.
echo        Vercel runs `npm install` itself so this Just Works.
echo        - confirm the build went green in the Vercel dashboard
echo        - hard-refresh https://yourapp.com (Ctrl+Shift+R)
echo     2. Android (Capacitor + Play Store): rebuild the AAB.
echo        From this folder, in order:
echo          npm install                       (picks up @capacitor/app)
echo          npm run build                     (rebuilds dist/)
echo          npx cap sync android              (copies dist/ + new plugin into android/)
echo        Then either:
echo          cd android ^&^& gradlew bundleRelease   (CLI)
echo        OR open android/ in Android Studio:
echo          Build -^> Generate Signed Bundle / APK -^> Android App Bundle
echo        Upload android/app/release/app-release.aab to:
echo          Play Console -^> Testing -^> Internal testing
echo          -^> Create new release -^> Upload AAB
echo          -^> Save -^> Review release -^> Start rollout to Internal testing
echo        versionCode is already bumped to 9 in android/app/build.gradle.
echo     3. iOS: no iOS target in this project, no action.
echo ================================================
pause
