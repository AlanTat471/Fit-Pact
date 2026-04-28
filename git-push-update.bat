@echo off
echo ========================================
echo   Numi - Rebrand + Input Override Fix
echo   + UI polish (login, payments, goals)
echo ========================================
echo.

cd /d "%~dp0"

echo Adding changed files...

:: Numi rebrand: storage migration utility + main mount-point
git add src/lib/storageMigration.ts
git add src/main.tsx

:: Pages: input-override fix + UI polish
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
git commit -m "Numi rebrand + fix input-override race + login/payment/community polish

- Rename fitpact* localStorage and sessionStorage keys to numi* with idempotent
  one-time migration in src/lib/storageMigration.ts (called from main.tsx
  before React mounts) so existing users keep their archived phases / weekly
  reminder dismissals / welcome state intact.
- Fix the input-override bug on Profile (description, my-why, goals, day-goals,
  photo) and TDEE (gender/age/height/weight/activity-level): each keystroke
  used to call refreshProfile() which re-fetched from Supabase mid-typing and
  wiped the input. Removed the refresh-on-save calls and added per-field
  'user has edited locally' refs so the profile->state sync that fires on
  token-refresh / session-resume no longer clobbers in-progress edits.
- Index page: removed left-side Fit.jpg image, centred LoginForm card.
- LoginForm: added show/hide-password eye toggle to the password field.
- Community & Help: 'Coming Soon' badges now stay on the same line as the
  card title and use 'Coming soon' (lowercase 's') consistently across FAQ,
  Articles, and Your Community.
- TDEE page (Workouts): added a short description under 'Ideal Body Fat
  Range', moved the explanatory paragraph from below the input to under the
  heading on 'Suggested Weight Goal', and renamed the heading to 'Suggested
  Weight Loss Goal'.
- PaymentDetails: equal-height (52px) Active / Subscribe buttons across all
  three plan cards with the 'Active' label vertically centred; reduced
  highlighted text and heading sizes inside each plan card while keeping the
  heading > body hierarchy.
- Doc / rule rebrand: '.cursor/rules/fitpact-workflow.mdc' content now reads
  'Numi Workflow Rules' (file path kept to avoid breaking rule discovery);
  WEB_ANDROID_IOS_LAUNCH_AND_STITCH_WORKFLOW.md retitled to Numi."

echo.
echo Pushing to origin...
git push

echo.
echo ========================================
echo   Push complete!
echo ========================================
pause
