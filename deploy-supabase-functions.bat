@echo off
echo ============================================================
echo   Numi - Deploy Supabase Edge Functions (billing + delete-account)
echo ============================================================
echo.
echo Your Supabase project ref (from dashboard URL):
echo   qavbkmmspbtrqqeiczrd
echo.
echo FIRST TIME ONLY: this script will open your browser to log in.
echo.

cd /d "%~dp0"

echo Step 1 - Log in to Supabase (skip if already logged in)...
call npx supabase login
if errorlevel 1 (
  echo Login failed or was cancelled. Fix login then run this file again.
  pause
  exit /b 1
)

echo.
echo Step 2 - Link this folder to your Numi Supabase project...
call npx supabase link --project-ref qavbkmmspbtrqqeiczrd
if errorlevel 1 (
  echo Link failed. If already linked, you can ignore and continue.
)

echo.
echo Step 3 - Deploy billing (Stripe + Week 4 paywall)...
REM --no-verify-jwt lets Stripe webhooks through. Safe: the function itself
REM checks the user's login token for app actions and Stripe's signature
REM for webhook calls.
call npx supabase functions deploy billing --no-verify-jwt --project-ref qavbkmmspbtrqqeiczrd
if errorlevel 1 (
  echo billing deploy FAILED.
  pause
  exit /b 1
)

echo.
echo Step 4 - Deploy delete-account (Settings ^> Delete Account)...
call npx supabase functions deploy delete-account --project-ref qavbkmmspbtrqqeiczrd
if errorlevel 1 (
  echo delete-account deploy FAILED.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo   SUCCESS! Both functions deployed.
echo.
echo   In Supabase: Edge Functions -^> billing should show Updated: today
echo   You should also see: delete-account
echo.
echo   Next: refresh Supabase Edge Functions page in your browser.
echo ============================================================
pause
