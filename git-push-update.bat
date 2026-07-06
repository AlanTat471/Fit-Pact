@echo off
echo ============================================================
echo   Numi v16 - Paywall, UI fixes, Settings, Achievements
echo ============================================================
echo.

cd /d "%~dp0"

echo Adding changed files...

REM v16 changes:
REM   - Acclimation caption/cursor fixes; Recommended Steps caption
REM   - Payment Details button text fit; Annually + Best Value badge move
REM   - 4-week free Acclimation; charge on Week 4 Let's Go
REM   - Weight Loss + Maintenance locked until subscribe
REM   - Returning subscribers skip re-charge prompt
REM   - Macro education reworded (shorter)
REM   - Achievements Coming Soon; Settings privacy/notifications phased
REM   - Delete Account edge function + confirmation flow
REM   - Billing: setup checkout, activate subscription actions
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
git add git-push-update.bat

echo Committing...
git commit ^
  -m "v16: acclimation paywall, deferred billing, UI fixes, delete account" ^
  -m "Lock Weight Loss and Maintenance until subscription. Save plan+card via Stripe setup during Acclimation; charge on Week 4 Let's Go. Returning subscribers get no re-charge prompt. Fix Payment button text clipping. Phase out Achievements, Privacy Controls, Notifications. Add delete-account Edge Function."

echo.
echo Pushing to origin...
git push

echo.
echo ============================================================
echo   Push complete!  v16
echo.
echo   1. VERCEL: wait 2-3 mins, hard-refresh https://fit-pact.vercel.app
echo.
echo   2. SUPABASE — deploy BOTH Edge Functions:
echo      a) Dashboard ^> Edge Functions ^> billing ^> Deploy
echo      b) Dashboard ^> Edge Functions ^> delete-account ^> Deploy
echo         (If delete-account is new: Deploy new function from folder)
echo.
echo   3. STRIPE — no new products needed (same Monthly/Annual prices)
echo      Ensure webhook still points to billing/stripe-webhook
echo.
echo   4. TEST on web:
echo      - Acclimation captions (no Locked word, no red cursor)
echo      - Payment Details buttons fit in box
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
