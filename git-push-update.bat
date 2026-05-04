@echo off
echo ========================================
echo   Numi - Dashboard fixes + no-changes
echo   popup + branding + input override fix
echo ========================================
echo.

cd /d "%~dp0"

echo Adding changed files...

:: Numi rebrand: storage migration utility + main mount-point
git add src/lib/storageMigration.ts
git add src/main.tsx

:: Build config: Terser obfuscation
git add vite.config.ts
git add package.json

:: Pages: input-override fix + UI polish + new popup + branding
git add src/pages/Index.tsx
git add src/components/LoginForm.tsx
git add src/pages/Profile.tsx
git add src/pages/Workouts.tsx
git add src/pages/Dashboard.tsx
git add src/pages/PaymentDetails.tsx
git add src/pages/CommunityHelp.tsx

:: Contexts: storage key rename + comment update
git add src/contexts/UserDataContext.tsx
git add src/contexts/AuthContext.tsx

:: Cursor rule + launch doc rebrand
git add .cursor/rules/fitpact-workflow.mdc
git add WEB_ANDROID_IOS_LAUNCH_AND_STITCH_WORKFLOW.md

:: This batch file itself
git add git-push-update.bat

echo.
echo Committing...
git commit -m "Dashboard: fix input flickering, add no-changes popup, fix branding

- Fix the input flickering / override bug on the Dashboard: the saveJourney()
  Supabase round-trip was updating the 'journey' context object which triggered
  the Dashboard's main load useEffect, calling setWeeklyData / setAcclimationData
  / setMaintenancePhase etc. and overwriting whatever the user was currently
  typing. Fixed by adding a journeyHydratedForUserRef guard: once the journey
  has been hydrated from Supabase for the current user, subsequent load-effect
  runs (caused by saves) return early and leave in-progress input untouched.
  The guard resets when user?.id changes so login/logout/account-switch always
  starts fresh.

- Add 'no changes to Steps or Calories — keep it up!' popup: after completing
  a weight-loss week, if the algorithm detects the user is losing enough weight
  and neither steps nor calories need adjusting, a friendly encouragement popup
  now appears (mirroring the existing steps-increased / calories-reduced popup).
  The popup is suppressed on Week 12 completion (the Week 12 summary dialog
  takes over at that point).

- Fix 'Fit Impact' branding in the Thank You dialog — changed to 'Numi'.

Previous session changes (carried forward):
- Rename fitpact* localStorage / sessionStorage keys to numi* with idempotent
  one-time migration (storageMigration.ts, called from main.tsx before mount).
- Fix input-override on Profile and TDEE pages (per-field local-edit refs).
- Index: remove Fit.jpg, centre LoginForm card.
- LoginForm: show/hide password eye toggle.
- Community & Help: same-line 'Coming soon' badges (lowercase s) on all three cards.
- TDEE (Workouts): description under 'Ideal Body Fat Range'; paragraph moved
  under heading + renamed to 'Suggested Weight Loss Goal'.
- PaymentDetails: equal-height buttons; reduced highlighted font sizes."

echo.
echo Pushing to origin...
git push

echo.
echo ========================================
echo   Push complete!
echo ========================================
pause
