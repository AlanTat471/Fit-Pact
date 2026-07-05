@echo off
echo ============================================================
echo   Numi v15 - Subscription plans, Macro education, UI locks
echo ============================================================
echo.

cd /d "%~dp0"

echo Adding changed files...

REM v15 changes:
REM   1. Subscription plans updated: Weekly/Fortnightly removed, Monthly ($8.99/mo)
REM      and Annual ($5.99/mo billed at $71.88/yr, saving 33%) added
REM   2. Macro Breakdown: added educational content (Protein, Fats, Carbs)
REM   3. Dashboard: Acclimation Calories field is now locked (read-only)
REM   4. TDEE Calculator: 'Personal Information' heading renamed to 'My Details'
REM   5. Billing Edge Function: env vars updated to STRIPE_PRICE_MONTHLY/ANNUAL
REM
git add src/pages/PaymentDetails.tsx
git add src/pages/Settings.tsx
git add src/pages/MacroBreakdown.tsx
git add src/pages/Dashboard.tsx
git add src/pages/Workouts.tsx
git add supabase/functions/billing/index.ts
git add git-push-update.bat

echo Committing...
git commit ^
  -m "v15: monthly/annual plans, macro education, locked acclimation calories, My Details heading" ^
  -m "Replace weekly/fortnightly plans with Monthly ($8.99/mo) and Annual ($5.99/mo at $71.88/yr, 33% saving). Add macro educational content (Protein/Fats/Carbs what/benefits/impact) to Macro Breakdown page. Lock Acclimation Calories on Dashboard to reflect TDEE page (read-only). Rename Personal Information to My Details in TDEE Calculator. Update billing Edge Function to use STRIPE_PRICE_MONTHLY and STRIPE_PRICE_ANNUAL secrets."

echo.
echo Pushing to origin...
git push

echo.
echo ============================================================
echo   Push complete!  v15
echo.
echo   NEXT STEPS AFTER PUSH:
echo.
echo   1. VERCEL: wait 2-3 mins for green deploy, then hard-refresh
echo      (Ctrl+Shift+R) on https://fit-pact.vercel.app
echo.
echo   2. STRIPE DASHBOARD - Create new products:
echo      a) Go to https://dashboard.stripe.com ^> Products ^> + Add product
echo      b) Create "Numi Monthly":
echo           Name: Numi Monthly
echo           Price: $8.99  Recurring: Monthly
echo           Copy the Price ID (starts with price_...)
echo      c) Create "Numi Annual":
echo           Name: Numi Annual
echo           Price: $71.88  Recurring: Yearly
echo           Copy the Price ID (starts with price_...)
echo.
echo   3. SUPABASE - Update Edge Function secrets:
echo      a) Go to https://supabase.com ^> Your Project ^> Edge Functions
echo      b) Click on "billing" function ^> Secrets tab
echo      c) ADD secret: STRIPE_PRICE_MONTHLY = [monthly price_ ID from step 2b]
echo      d) ADD secret: STRIPE_PRICE_ANNUAL  = [annual  price_ ID from step 2c]
echo      e) You can DELETE the old STRIPE_PRICE_WEEKLY and STRIPE_PRICE_FORTNIGHTLY
echo      f) Redeploy the billing function (Deploy button)
echo.
echo   4. ANDROID:
echo        npm run build
echo        npx cap sync android
echo      Android Studio ^> signed AAB ^> Play Internal testing (v15)
echo.
echo ============================================================
pause
