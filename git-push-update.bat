@echo off
echo ============================================================
echo   Numi v16.7 - Annual $72 plan + 7 weeks of unpushed work
echo ============================================================
echo.

cd /d "%~dp0"

REM ------------------------------------------------------------------
REM WHY THIS FILE CHANGED (v16.7)
REM
REM Previous versions listed each file by hand with "git add <file>".
REM That is how 7 weeks of finished work (27 Jul - 15 Sep 2026) never
REM reached GitHub: files that were not on the hand-written list were
REM silently left behind, so Vercel kept rebuilding an old snapshot.
REM
REM This version uses "git add -A", which stages EVERY change in the
REM project - modified, new and deleted - so nothing can be missed
REM again. Junk is kept out by .gitignore (node_modules, dist,
REM supabase/.temp) rather than by remembering to omit it.
REM ------------------------------------------------------------------

echo [1/4] Checking this really is the Numi project folder...
if not exist package.json (
    echo.
    echo ***** WRONG FOLDER - package.json not found. *****
    echo Put this .bat file in the folder that contains package.json.
    pause
    exit /b 1
)

echo [2/4] Staging ALL changes (modified, new and deleted)...
git add -A

echo.
echo These files are about to be pushed:
git status --short
echo.

echo [3/4] Committing...
git commit ^
  -m "v16.7: annual plan $72/year, plan card redesign, login and device-trust fixes, Android project added" ^
  -m "Pricing: annual is now A$72/year shown as $6.00/month with 'Billed $72 yearly'; Best Value badge wraps onto two lines; Free/Monthly/Annually share one card header so all three boxes align; Settings and the switch-plan popup quote $72. No Quarterly plan." ^
  -m "Login: 60-second cooldown on sending verification codes with live countdown, plain-English Supabase email rate-limit messages (new src/lib/authEmailErrors.ts), and legacy device-fingerprint migration so devices trusted before v12 are recognised without a fresh OTP." ^
  -m "Community Help: success popup spins three times then freezes with a green tick." ^
  -m "Repo hygiene: Capacitor android/ project added to version control, Supabase CLI scratch files untracked and gitignored, stray 0-byte files removed. Android set to versionCode 18 / versionName 2.4."

if errorlevel 1 (
    echo.
    echo ***** COMMIT DID NOT RUN. *****
    echo Read the message above. Common causes:
    echo   - "Author identity unknown" = git does not know who you are
    echo     on this PC. Fix once with these two commands:
    echo       git config --global user.name "AlanTat471"
    echo       git config --global user.email "alan.tat@hotmail.com"
    echo     then run this file again.
    echo   - "nothing to commit" = everything is already saved. Fine.
    echo   Anything else: report it back in Cursor.
    echo   Your staged files are NOT lost - they stay staged.
    pause
    exit /b 1
)

echo.
echo [4/4] Pushing to GitHub...
git push
if errorlevel 1 (
    echo.
    echo ***** PUSH FAILED. *****
    echo Most likely cause: GitHub has commits your PC does not.
    echo Fix: run  git pull  then run this file again.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   Push complete!  v16.7
echo.
echo   Confirm nothing is left behind - this should print nothing:
git status --short
echo   (if lines appear above, tell Cursor)
echo.
echo   1. VERCEL: wait 2-3 mins, then open
echo      https://fit-pact.vercel.app
echo      and press Ctrl+Shift+R (hard refresh).
echo      Annually must show $6.00 /month and "Billed $72 yearly".
echo.
echo   2. STRIPE + SUPABASE: already done by you (TEST mode).
echo      Nothing further to do for testing.
echo      BEFORE REAL LAUNCH you must repeat in LIVE mode:
echo        - create the A$72.00 yearly price in Live mode
echo        - put that LIVE price ID in STRIPE_PRICE_ANNUAL
echo        - swap STRIPE_SECRET_KEY to the live sk_live_ key
echo        - create a Live webhook and set STRIPE_WEBHOOK_SECRET
echo      Test and Live price IDs are NOT interchangeable.
echo.
echo   3. TEST on web (Payment Details page):
echo      - Annually: $6.00 /month + "Billed $72 yearly"
echo      - Badge line 1: BEST VALUE - 33%% DISCOUNT
echo        Badge line 2: (4 MONTHS FREE)
echo      - Monthly: $8.99 /month + "Billed $8.99 monthly"
echo      - All three boxes equal height, buttons aligned
echo      - Stripe TEST checkout for Annually shows A$72.00
echo      - Settings ^> Billing shows $72/year, never $71.88
echo      - Log out and back in: this PC should NOT ask for a
echo        new email code now that the trust fix is live
echo.
echo   4. ANDROID (after Android Studio finishes installing):
echo        Double-click build-and-android-sync.bat
echo      Android Studio ^> open the "android" folder
echo      Build ^> Generate Signed Bundle / APK ^> Android App Bundle
echo      Already set: versionCode 18, versionName 2.4
echo      If Play says "version code 18 already used", change
echo      versionCode to 19 in android/app/build.gradle and rebuild.
echo ============================================================
pause
