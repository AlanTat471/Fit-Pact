@echo off
echo ========================================
echo   Numi - Internal test feedback round 1
echo   payments, goals, decimals, safe-area,
echo   responsive headers, support form
echo ========================================
echo.

cd /d "%~dp0"

echo Adding changed files...

:: Numi rebrand: storage migration utility + main mount-point (existing)
git add src/lib/storageMigration.ts
git add src/main.tsx

:: Build config: Terser obfuscation (existing)
git add vite.config.ts
git add package.json

:: Pages
git add src/pages/Index.tsx
git add src/components/LoginForm.tsx
git add src/pages/Profile.tsx
git add src/pages/Workouts.tsx
git add src/pages/Dashboard.tsx
git add src/pages/PaymentDetails.tsx
git add src/pages/CommunityHelp.tsx

:: Layout / global styles / nav (safe-area + responsive headers)
git add src/index.css
git add src/components/BottomNav.tsx
git add src/layouts/AppLayout.tsx

:: Capacitor config (package name change + edge-to-edge note)
git add capacitor.config.ts

:: Contexts: storage key rename + comment update (existing)
git add src/contexts/UserDataContext.tsx
git add src/contexts/AuthContext.tsx

:: Cursor rule + launch doc rebrand (existing)
git add .cursor/rules/fitpact-workflow.mdc
git add WEB_ANDROID_IOS_LAUNCH_AND_STITCH_WORKFLOW.md

:: Supabase migration SQL for the new support inbox
git add supabase-support-messages.sql

:: Android native files (changed by capacitor sync)
git add android/app/build.gradle

:: This batch file itself
git add git-push-update.bat

echo.
echo Committing...
git commit -m "Internal test feedback round 1: payments, goals, decimals, safe-area, responsive headers, support form

- PaymentDetails: removed the hard-coded fake 'Paid via xxxx 123x' card
  hint. The card row now shows a single 'Add payment method' link until
  the user enters details, then switches to 'Default - **** 1234' with a
  small edit pen icon. Added a 'Remove card' option inside the update
  dialog. Stored locally as last4 + cardholder name only (never the full
  PAN/CVC) under numiSavedCardLast4 / numiSavedCardName.

- Profile goals: target field now pairs a numeric value with a unit
  selector (Quantity / Distance / Weight / Time). The unit list follows
  the user's profile measurement system (metric -> km/m/cm/kg/g,
  imperial -> mi/ft/in/lbs/oz). Existing goals without a unit continue
  to render exactly as before. Goal type extended with optional
  targetUnit string.

- Decimals everywhere: weight stat cards, weight-change badge, and
  completed-week summary lines all format to exactly 2 decimal places
  (e.g. +0.95 kg). Removed the legacy formatKgFullPrecision helper that
  printed 16 decimal places of float noise.

- Auto-fit text: added .auto-fit-text utility (clamp + container-query
  font sizing) and applied it to all stat values on Profile and
  Dashboard plus the completed-week summary so long values shrink to
  stay on one line instead of wrapping.

- Profile photo upload icon: moved from bottom-left to bottom-right of
  the avatar and reduced size (h-6 w-6 + xs icon). PRO badge moved to
  top-right to avoid overlap.

- Android safe-area / edge-to-edge: BottomNav now uses
  env(safe-area-inset-bottom) padding so the system gesture/3-button
  navigation no longer overlaps the app's tab bar. Main content padding
  also respects the inset. viewport-fit=cover was already set on the
  meta tag.

- Responsive section headers: Acclimation Phase, Weight Loss Phase
  (inner + outer container), and Maintenance Phase headers now stack
  the title and action buttons vertically on phones (<640px) and keep
  them inline on tablets+. Buttons grow to fill the row on phones
  (flex-1) so they don't look squashed.

- Contact Support: replaced mailto with an insert into the new
  public.support_messages Supabase table (see
  supabase-support-messages.sql). Submit shows an inline spinner; on
  success the dialog closes and a soft confirmation popup with a
  rotating tick auto-dismisses after 3 seconds (or on any tap)."

echo.
echo Pushing to origin...
git push

echo.
echo ========================================
echo   Push complete!
echo   Reminders:
echo   1. Run supabase-support-messages.sql in Supabase SQL Editor
echo      (one-time, before testers send support messages)
echo   2. Re-run: npm run build, npx cap sync android, then rebuild
echo      the AAB in Android Studio and upload to Play Console.
echo ========================================
pause
