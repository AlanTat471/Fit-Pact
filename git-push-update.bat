@echo off
echo ============================================================
echo   Numi v16.4 - Plan switching + double-charge protection
echo ============================================================
echo.

cd /d "%~dp0"

echo Adding changed files...

REM v16.4 changes:
REM   - Switch to Free: warning popup with paid-until date, real Stripe cancel at period end
REM   - Resume plan: paid -> free -> paid again without any new charge
REM   - Monthly <-> Annually switch on existing subscription, no charge today
REM   - Server guards: activate/checkout can never create a second subscription
REM   - Card updates always via Stripe setup flow (no charge)
REM   - Settings "Change Plan" now opens Payment Details (single source of truth)
REM   (also includes v16.2/v16.3: subscribe wording, restart popups, Starting
REM    Weight sync, Week 4 Subscribe popup, checkout verification)
REM
git add src/pages/Dashboard.tsx
git add src/pages/PaymentDetails.tsx
git add src/pages/Settings.tsx
git add src/lib/billingApi.ts
git add supabase/functions/billing/index.ts
git add BUGS-AND-DEFECTS.md
git add git-push-update.bat
git add build-and-android-sync.bat

echo Committing...
git commit ^
  -m "v16.4: real plan switching and cancellation via Stripe; block all double-charge paths" ^
  -m "Switch to Free now schedules a real Stripe cancellation with a paid-until warning popup. Resuming within the paid period and switching Monthly/Annually happen on the existing subscription with no new charge. Server-side guards stop activate/checkout from ever creating a second subscription. Settings Change Plan opens Payment Details."

echo.
echo Pushing to origin...
git push

echo.
echo ============================================================
echo   Push complete!  v16.4
echo.
echo   1. SUPABASE (REQUIRED): redeploy the billing function:
echo      Double-click deploy-supabase-functions.bat
echo.
echo   2. VERCEL: wait 2-3 mins, hard-refresh https://fit-pact.vercel.app
echo.
echo   3. STRIPE: no changes. Keep webhook for customer.subscription.*
echo      events so access locks when a cancelled period ends.
echo.
echo   4. TEST on web (Stripe TEST mode, card 4242 4242 4242 4242):
echo      - Subscribe Monthly -^> Switch to Free Plan -^> warning popup
echo        shows paid-until date -^> Yes -^> still have premium access
echo      - Stripe dashboard: subscription shows "Cancels on <date>"
echo      - Plan card button now says "Resume plan" -^> popup -^> continue
echo        -^> Stripe shows cancellation removed, NO new charge
echo      - While subscribed Monthly, click Annually -^> switch popup with
echo        dates -^> Yes -^> Stripe subscription price becomes annual,
echo        NO invoice today
echo      - Click own active plan button -^> never opens payment screen
echo      - Settings -^> Change Plan -^> opens Payment Details page
echo.
echo   5. ANDROID:
echo        Double-click build-and-android-sync.bat
echo      Android Studio ^> bump versionCode to 17, versionName 2.2
echo      Build signed AAB ^> Play Internal testing
echo ============================================================
pause
