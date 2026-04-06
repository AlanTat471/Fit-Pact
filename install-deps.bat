@echo off
cd /d "%~dp0"
echo Installing dependencies (including Supabase)...
echo.
npm install
echo.
if %ERRORLEVEL% EQU 0 (
  echo Done. You can now run "npm run dev" or use start-dev.bat
) else (
  echo Install failed. Check the output above.
)
pause
