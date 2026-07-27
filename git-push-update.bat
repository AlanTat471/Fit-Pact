@echo off
echo ============================================================
echo   Numi v16.1 - Annual pricing, recurring cancellation, PC migration
echo ============================================================
echo.

cd /d "%~dp0"

echo Adding changed files...

REM v16.1 changes:
REM   - Annual price displays $71.88/year ($5.99/month equivalent)
REM   - Best Value badge displays rounded 33% discount
REM   - Stripe cancellation is scheduled at end of current paid period
REM   - New PC migration guide refreshed with exact GitHub/OneDrive/Android steps
REM
git add src/pages/Dashboard.tsx
git add src/pages/PaymentDetails.tsx
git add src/pages/MacroBreakdown.tsx
git add src/pages/Settings.tsx
git add src/pages/Profile.tsx
git add src/pages/Achievements.tsx
git add src/components/BottomNav.tsx
git add src/components/AppSidebar.tsx
git add src/lib/billingApi.ts
git add src/lib/supabaseSubscription.ts
git add supabase/functions/billing/index.ts
git add supabase/functions/delete-account/index.ts
git add BUGS-AND-DEFECTS.md
git add NEW_PC_MIGRATION_GUIDE.md
git add deploy-supabase-functions.bat
git add verify-new-pc-setup.bat
git add git-push-update.bat

echo Committing...
git commit ^
  -m "v16.1: correct annual pricing and connect Stripe cancellation" ^
  -m "Show the annual charge as $71.88/year with its $5.99 monthly equivalent and 33% discount. Schedule Stripe cancellation at period end so recurring renewals stop correctly. Refresh the new-PC migration and Android testing guide."

echo.
echo Pushing to origin...
git push

echo.
echo ============================================================
echo   Push complete!  v16.1
echo.
echo   1. VERCEL: wait 2-3 mins, hard-refresh https://fit-pact.vercel.app
echo.
echo   2. SUPABASE — redeploy billing (required for real cancellation):
echo      Double-click deploy-supabase-functions.bat
echo.
echo   3. STRIPE — confirm Annual recurring price is $71.88 per year
echo      Monthly remains $8.99 per month
echo.
echo   4. TEST on web:
echo      - Acclimation captions (no Locked word, no red cursor)
echo      - Payment Details buttons fit in box
echo      - Annually button shows $71.88/year and 33%% discount
echo      - Cancel Subscription schedules cancellation at period end
echo      - Complete Week 4: Let's Go / No popups
echo      - Weight Loss locked until subscribe
echo      - Settings ^> Delete Account flow
echo      - Achievements shows Coming Soon
echo.
echo   5. ANDROID:
echo        npm run build
echo        npx cap sync android
echo      Android Studio ^> bump versionCode to 16, versionName 2.1
echo      Build signed AAB ^> Play Internal testing
echo ============================================================
pause
