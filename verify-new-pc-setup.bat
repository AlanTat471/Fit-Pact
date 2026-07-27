@echo off
echo ============================================================
echo   Numi - Verify New PC Setup
echo ============================================================
echo.
cd /d "%~dp0"

echo [1/6] Checking Git...
git --version
if errorlevel 1 goto :failed

echo.
echo [2/6] Checking Node.js...
node --version
if errorlevel 1 goto :failed

echo.
echo [3/6] Checking npm...
npm --version
if errorlevel 1 goto :failed

echo.
echo [4/6] Checking local Supabase environment file...
if not exist ".env.local" (
  echo ERROR: .env.local is missing.
  echo Copy it from OneDrive\Numi Private Transfer into this project folder.
  goto :failed
)
echo .env.local found.

echo.
echo [5/6] Installing project dependencies...
call npm install
if errorlevel 1 goto :failed

echo.
echo [6/6] Running production build and Android sync...
call npm run build
if errorlevel 1 goto :failed
call npx cap sync android
if errorlevel 1 goto :failed

echo.
echo ============================================================
echo   SUCCESS: New PC development setup passed all checks.
echo.
echo   Next:
echo   1. Double-click start-dev.bat to test Numi in a browser.
echo   2. Open the android folder in Android Studio.
echo   3. Run Numi on an emulator before any Play release.
echo ============================================================
pause
exit /b 0

:failed
echo.
echo ============================================================
echo   SETUP CHECK FAILED
echo   Read the error immediately above this message.
echo   Do not publish or delete the old PC project yet.
echo ============================================================
pause
exit /b 1
