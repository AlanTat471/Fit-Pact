@echo off
echo ============================================================
echo   Numi v16.14 - Dark look: white logo, white buttons, colour glow
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
REM Designer dump. It is a copy of the screens for Claude, not the app.
git reset HEAD -- "NUMI-UI-CODE-FOR-CLAUDE.txt" >nul 2>&1

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
  -m "v16.14: dark canvas, white numi logo, white pill buttons" ^
  -m "Look only. Prices stay $0, $8.99/month and $6.00/month billed $72 yearly. Calculations, the sign-in disclaimer, and what each button does are unchanged." ^
  -m "Best Value stays the small one-line pill just inside the Annual card. It was not moved."

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
echo   Push complete.  v16.14 dark look
echo.
echo   Confirm nothing important is left behind:
git status --short
echo   (NUMI-UI-CODE-FOR-CLAUDE.txt may still be listed. That file is a
echo    designer copy and is meant to stay off GitHub.)
echo.
echo   1. VERCEL: wait 2-3 minutes, then open
echo      https://fit-pact.vercel.app
echo      and press Ctrl+Shift+R.
echo      The page should be near-black, the logo white, buttons white.
echo.
echo   2. STRIPE + SUPABASE prices: no price change in this update.
echo      Annual is still A$72.00 a year, shown as $6.00 /month.
echo      BEFORE REAL CUSTOMERS you must use LIVE mode:
echo        - A$72.00 yearly price in Live mode
echo        - that LIVE price ID in STRIPE_PRICE_ANNUAL
echo        - STRIPE_SECRET_KEY swapped to the live sk_live_ key
echo        - a Live webhook and STRIPE_WEBHOOK_SECRET
echo      Test and Live price IDs are not interchangeable.
echo.
echo   3. TEST on the website:
echo      - Annual: $6.00 /month and "Billed $72 yearly"
echo      - Best Value is ONE line: BEST VALUE (4 MONTHS FREE)
echo        It sits just inside the top of the Annual card.
echo      - Monthly: $8.99 /month and "Billed $8.99 monthly"
echo      - Free and Monthly have no blank gap under Inactive
echo      - Settings Billing shows $72/year, never $71.88
echo.
echo   4. SUPABASE billing function. The website push does NOT do this.
echo      Needed for the billing history table and for Delete Account
echo      to detach a saved card. In Command Prompt, from this folder:
echo        npx supabase login
echo        npx supabase functions deploy billing
echo.
echo   5. ANDROID. The phone app does not change when the website does.
echo      Current file: versionCode 22, versionName 1.0
echo      If Play says that version code is already used, stop and
echo      tell Cursor before uploading.
echo        Double-click build-and-android-sync.bat
echo      Then Android Studio, open the android folder,
echo      Build, Generate Signed Bundle / APK, Android App Bundle.
echo ============================================================
pause
