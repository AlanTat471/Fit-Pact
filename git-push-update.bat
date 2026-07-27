@echo off
echo ============================================================
echo   Numi v16.5 - Change/cancel plan anytime (pre Week 4 fix)
echo ============================================================
echo.

cd /d "%~dp0"

echo Adding changed files...

REM v16.5 changes:
REM   - Free Plan button becomes "Cancel selected plan" when Monthly/Annual is pending
REM   - Selected plan highlights; switch Monthly/Annually anytime before charge
REM   - Settings Cancel enabled for pending selection; shows selected plan clearly
REM   - Still no charge until Week 4 Subscribe (or paid-period switch rules from v16.4)
REM
git add src/pages/Dashboard.tsx
git add src/pages/PaymentDetails.tsx
git add src/pages/Settings.tsx
git add src/lib/billingApi.ts
git add supabase/functions/billing/index.ts
git add BUGS-AND-DEFECTS.md
git add git-push-update.bat
git add build-and-android-sync.bat
git add deploy-supabase-functions.bat

echo Committing...
git commit ^
  -m "v16.5: allow change and cancel of selected plan anytime before Week 4 charge" ^
  -m "Free Plan no longer stays locked as Active when a paid plan is only selected. Users can switch Monthly/Annually or cancel the selection with no charge. Settings Cancel Selected Plan is enabled for pending selections. Paid-period switch/cancel behaviour from v16.4 is unchanged."

echo.
echo Pushing to origin...
git push

echo.
echo ============================================================
echo   Push complete!  v16.5
echo.
echo   1. VERCEL: wait 2-3 mins, hard-refresh https://fit-pact.vercel.app
echo      (Ctrl+Shift+R)
echo.
echo   2. SUPABASE: if you have not yet redeployed for v16.4, do it now:
echo      Double-click deploy-supabase-functions.bat
echo      (v16.5 itself is frontend-only; billing redeploy still needed
echo       for switch/resume/webhook JWT fix from v16.4)
echo.
echo   3. STRIPE: finish webhook fix if not done:
echo      - Signing secret whsec_ into STRIPE_WEBHOOK_SECRET in Supabase
echo      - Resend a failed delivery or subscribe once to confirm Succeeded
echo.
echo   4. TEST on web:
echo      - Save card + select Monthly -^> card shows Selected, Free shows
echo        "Cancel selected plan"
echo      - Switch to Annually -^> selection updates, no Stripe checkout
echo      - Cancel selected plan -^> confirm -^> nothing charged after Week 4
echo      - Settings Billing: Cancel Selected Plan is enabled
echo      - After real payment: Switch Free / Monthly / Annual still works
echo        with paid-until popups
echo.
echo   5. ANDROID:
echo        Double-click build-and-android-sync.bat
echo      Android Studio ^> bump versionCode to 18, versionName 2.3
echo      Build signed AAB ^> Play Internal testing
echo ============================================================
pause
