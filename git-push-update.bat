@echo off
echo ============================================================
echo   Numi v16.8 - Plan card gaps, Active/Inactive status, 4-week trial
echo ============================================================
echo.

cd /d "%~dp0"

REM ------------------------------------------------------------------
REM WHY THIS FILE CHANGED (v16.7)
REM
REM 1. Earlier versions listed each file by hand with "git add <file>".
REM    That is how 7 weeks of finished work (27 Jul - 15 Sep 2026) never
REM    reached GitHub: files not on the hand-written list were silently
REM    skipped, so Vercel kept rebuilding an old snapshot. Now uses
REM    "git add -A" so nothing can be missed. Junk stays out via
REM    .gitignore, not human memory.
REM
REM 2. It used to abort whenever "git commit" returned an error - even
REM    for the harmless "nothing to commit" case. That stranded an
REM    already-made commit when a push was interrupted. It now only
REM    treats a failed commit as fatal if there were staged changes,
REM    and it always pushes any commit still waiting.
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

REM "git diff --cached --quiet" exits 1 when something IS staged.
git diff --cached --quiet
if errorlevel 1 (set HAVE_STAGED=1) else (set HAVE_STAGED=0)

echo.
echo [3/4] Committing...

if "%HAVE_STAGED%"=="0" goto :after_commit

echo These files are about to be committed:
git status --short
echo.

git commit ^
  -m "v16.8: plan card gaps removed, unified Active/Inactive status, 4-week free trial with real end date" ^
  -m "Plan cards: the Annually badge now sits beside the heading (smaller text) and the reserved empty badge slot is gone, so Free Plan and Monthly no longer have a blank gap under their headings." ^
  -m "Status: all three cards show the same Active/(your current active plan) or Inactive/(plan not active) block under the heading, and exactly one card is ever Active. Buttons keep their distinct actions (Subscribe, Selected, Cancel selected plan, Resume plan, Update payment method, Switch to Free Plan) with consistent typography." ^
  -m "Free trial: card now says 4 weeks instead of 14 days, matching the 28-day Acclimation Phase the code has always granted. Trial Period reads 'Your Free Trial will end on DD/MM/YY' from the journey's acclimation end date, falling back to '4 weeks after your journey start date' for users with no start date yet." ^
  -m "v16.7 (included): annual plan $72/year, plan card redesign, login and device-trust fixes, Android project added" ^
  -m "Pricing: annual is now A$72/year shown as $6.00/month with 'Billed $72 yearly'; Best Value badge wraps onto two lines; Free/Monthly/Annually share one card header so all three boxes align; Settings and the switch-plan popup quote $72. No Quarterly plan." ^
  -m "Login: 60-second cooldown on sending verification codes with live countdown, plain-English Supabase email rate-limit messages (new src/lib/authEmailErrors.ts), and legacy device-fingerprint migration so devices trusted before v12 are recognised without a fresh OTP." ^
  -m "Community Help: success popup spins three times then freezes with a green tick." ^
  -m "Repo hygiene: Capacitor android/ project added to version control, Supabase CLI scratch files untracked and gitignored, stray 0-byte files removed. Android set to versionCode 18 / versionName 2.4."

if errorlevel 1 (
    echo.
    echo ***** COMMIT FAILED - and there WERE changes to save. *****
    echo Read the message above. Most likely:
    echo   "Author identity unknown" = git does not know who you are.
    echo   Fix once, then run this file again:
    echo     git config --global user.name "AlanTat471"
    echo     git config --global user.email "alan.tat@hotmail.com"
    echo.
    echo   Your staged files are NOT lost - they stay staged.
    pause
    exit /b 1
)
echo Commit created.
goto :after_commit

:after_commit
if "%HAVE_STAGED%"=="0" echo No new file changes to commit - checking for commits still waiting to be pushed...

set AHEAD=0
for /f %%i in ('git rev-list --count origin/main..HEAD') do set AHEAD=%%i

if "%AHEAD%"=="0" (
    echo.
    echo ============================================================
    echo   Nothing to do - GitHub already has all your work.
    echo ============================================================
    pause
    exit /b 0
)

echo.
echo [4/4] Pushing %AHEAD% commit/s to GitHub...
echo.
echo   NOTE: if a GitHub sign-in window appears, COMPLETE IT.
echo   Do not close it - the upload stops if you do.
echo   You only need to do this once on this PC.
echo.
git push
if errorlevel 1 (
    echo.
    echo ***** PUSH FAILED. *****
    echo Your commit is SAFE on this PC - just not uploaded yet.
    echo   - Closed the GitHub sign-in window? Run this file again
    echo     and complete the sign-in.
    echo   - "rejected / non-fast-forward"? Run:  git pull
    echo     then run this file again.
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
