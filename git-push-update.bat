@echo off
echo ============================================================
echo   Numi v16.17 - Mobile Acclimation editor, safe area, black icon, versionCode 26
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
  -m "v16.17: mobile Acclimation one-day editor, safe area, black icon" ^
  -m "Complete Week still marks weeks complete. Prices stay $0, $8.99/month and $6.00/month billed $72 yearly. Android versionCode 26. No Supabase or Stripe deploy needed for this UI pass."

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
echo   Push complete.  v16.17
echo.
echo   Confirm nothing important is left behind:
git status --short
echo   (NUMI-UI-CODE-FOR-CLAUDE.txt may still be listed. That file is a
echo    designer copy and is meant to stay off GitHub.)
echo.
echo   1. VERCEL: wait 2-3 minutes, then open
echo      https://fit-pact.vercel.app
echo      and press Ctrl+Shift+R.
echo.
echo   2. STRIPE is unchanged for this UI pass.
echo      Prices stay Monthly $8.99 and Annual $6.00/month billed $72 yearly.
echo      Do NOT deploy Stripe or create live prices for this release.
echo.
echo   3. SUPABASE: no function deploy is required for this UI pass.
echo      Only deploy billing if you are fixing Stripe webhooks separately:
echo        deploy-supabase-functions.bat
echo.
echo   4. TEST on the website after hard refresh:
echo      - Acclimation day boxes open a one-day editor
echo      - Clear All / Collapse stay inside the Acclimation card
echo      - Average Weight is centred on a narrow window
echo      - Cancel-selection buttons wrap on a narrow window
echo.
echo   5. ANDROID. The phone app does not change when the website does.
echo      This build is versionCode 26, versionName 1.0
echo      Oldest phone that can install it: Android 8.
echo        Double-click build-and-android-sync.bat
echo      Then Android Studio, open the android folder,
echo      Build, Generate Signed Bundle / APK, Android App Bundle.
echo      Use the existing key file android\numi-release-key.jks
echo      The finished file is C:\numi-build\app\outputs\bundle\release\app-release.aab
echo ============================================================
pause
