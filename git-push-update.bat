@echo off
echo ================================================
echo   Numi - fix Dashboard data loss + mobile tooltips
echo ================================================
echo.

cd /d "%~dp0"

echo Adding changed files...

REM New module: cross-component coordinator that lets AuthContext / AppLayout
REM trigger a "save my pending Dashboard data NOW" flush before they tear the
REM session down or wipe localStorage. Without this the 800ms debounced save
REM was silently cancelled on Dashboard unmount, losing the user's latest
REM completed Weight Loss week on both phone and desktop.
git add src/lib/journeySaveFlush.ts

REM Dashboard: keep latest payload in a ref, expose a synchronous flush,
REM register it with the new coordinator, flush on unmount / beforeunload /
REM pagehide / any blur inside the dashboard root. Removes the cleanup-
REM clearTimeout that was the original data-loss bug.
git add src/pages/Dashboard.tsx

REM AuthContext: call flushPendingJourneySave() in signOut() BEFORE clearing
REM localStorage so a "Yes, Log Out" click can no longer drop unsaved changes.
git add src/contexts/AuthContext.tsx

REM AppLayout: call flushPendingJourneySave() in the 5-minute idle handler
REM BEFORE supabase.auth.signOut() so an idle-timeout can no longer drop
REM unsaved changes either.
git add src/layouts/AppLayout.tsx

REM Tooltip wrapper: detect (hover:hover) at runtime and render Radix Popover
REM (tap-to-open, tap-outside-to-close) on touch-only phones/tablets, while
REM keeping Radix Tooltip (hover) for desktop. Same API, so every existing
REM `<Tooltip>...</Tooltip>` usage (Dashboard, TDEE, Profile, Macros,
REM Achievements, RegisterForm) picks up the fix without code changes.
git add src/components/ui/tooltip.tsx

git add git-push-update.bat

echo Committing...
git commit ^
  -m "Fix Dashboard data loss on logout/idle/navigation + tooltips not working on mobile" ^
  -m "Data persistence: Dashboard's 800ms debounced save was cancelled when the component unmounted (logout, idle timeout, BottomNav, tab close), and AuthContext then wiped localStorage. Result: completed weeks and in-progress daily entries vanished on both phone and desktop. Now the Dashboard exposes a synchronous flushJourneySave() that is fired on unmount, beforeunload, pagehide, any blur inside the dashboard, AND from AuthContext.signOut() / AppLayout idle-timeout BEFORE the session is invalidated or storage cleared. Latest payload is kept in a ref so the flush always uses fresh values." ^
  -m "Tooltips on touch: Radix Tooltip is hover-only by design and does not respond to taps on phones/tablets. The shared <Tooltip> wrapper now picks Radix Popover on (hover: none) devices and Radix Tooltip on hover-capable devices, keeping the same API so all (?) help icons across Dashboard, TDEE, Profile, Macros, Achievements and Register pick up the fix automatically."

echo.
echo Pushing to origin...
git push

echo.
echo ================================================
echo   Push complete!
echo.
echo   Next steps (do in this order):
echo     1. Vercel (web): auto-deploys from main branch
echo        - confirm the build went green in the Vercel dashboard
echo        - hard-refresh https://yourapp.com (Ctrl+Shift+R)
echo     2. Android (Capacitor + Play Store): rebuild the AAB
echo        - npm install (only if package-lock changed)
echo        - npm run build
echo        - npx cap sync android
echo        - cd android ^&^& gradlew bundleRelease  (or use Android Studio)
echo        - upload the new AAB to Play Console -^> Internal testing
echo        - bump versionCode in android/app/build.gradle if Play asks
echo     3. iOS: no iOS target in this project right now, no action.
echo ================================================
pause
