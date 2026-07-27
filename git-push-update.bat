@echo off
echo ============================================================
echo   Numi v16.3 - Subscribe popup wording + payment verification
echo ============================================================
echo.

cd /d "%~dp0"

echo Adding changed files...

REM v16.2 + v16.3 changes:
REM   - Annually description + "Subscribe - Charged after Week 4" buttons
REM   - Restart flow: Welcome -> journey start date -> Acclimation info popup
REM   - Starting Weight mirrors TDEE Current Body Weight until Acclimation completes
REM   - Weight loss end date tooltip: excludes Maintenance Phase
REM   - Week 4 popup: new "New You, New Me!" wording + Subscribe button + charge warning
REM   - SECURITY: checkout unlock now verified with Stripe server-side (verify action)
REM   - SECURITY: declined saved-card charge no longer unlocks phases
REM
git add src/pages/Dashboard.tsx
git add src/pages/PaymentDetails.tsx
git add src/lib/billingApi.ts
git add supabase/functions/billing/index.ts
git add BUGS-AND-DEFECTS.md
git add git-push-update.bat
git add build-and-android-sync.bat

echo Committing...
git commit ^
  -m "v16.3: Week 4 Subscribe popup wording; verify Stripe payment before unlocking phases" ^
  -m "Reword the Acclimation-complete popup with a Subscribe button and charge warning. Harden the paywall: the checkout success redirect is now verified with Stripe via a new server-side verify action, and saved-card activation fails closed on declined charges. Also includes v16.2 subscribe button wording, restart popup order, Starting Weight sync, and end-date tooltip."

echo.
echo Pushing to origin...
git push

echo.
echo ============================================================
echo   Push complete!  v16.3
echo.
echo   1. SUPABASE (REQUIRED): redeploy the billing function or
echo      checkout verification will fail:
echo      Double-click deploy-supabase-functions.bat
echo.
echo   2. VERCEL: wait 2-3 mins, hard-refresh https://fit-pact.vercel.app
echo.
echo   3. STRIPE: no dashboard changes needed
echo.
echo   4. TEST on web (use Stripe TEST mode):
echo      - Payment Details: buttons say "Subscribe - Charged after Week 4"
echo      - Week 4 complete popup: new wording + Subscribe / No. buttons
echo      - Subscribe -^> pay on Stripe -^> phases unlock with toast
echo      - Subscribe -^> click Back on Stripe page -^> phases stay LOCKED
echo      - Type /dashboard?checkout=success^&unlocked=1 manually -^> stays LOCKED
echo      - Test declined card 4000 0000 0000 0002 -^> stays LOCKED
echo      - Clear All Data flow: Welcome -^> date popup -^> Acclimation info
echo      - TDEE weight change reflects in Dashboard Starting Weight
echo.
echo   5. ANDROID:
echo        Double-click build-and-android-sync.bat
echo      Android Studio ^> bump versionCode to 17, versionName 2.2
echo      Build signed AAB ^> Play Internal testing
echo ============================================================
pause
