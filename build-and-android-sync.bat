@echo off
echo ============================================================
echo   Numi - Build web app and sync into Android project
echo ============================================================
echo.

cd /d "%~dp0"

echo [1/2] Building production web app (npm run build)...
call npm run build
if errorlevel 1 (
    echo.
    echo ***** BUILD FAILED - do NOT push or sync. *****
    echo Scroll up to read the error, then report it back in Cursor.
    pause
    exit /b 1
)

echo.
echo Build succeeded!
echo.
echo [2/2] Copying the build into the Android project (npx cap sync android)...
call npx cap sync android
if errorlevel 1 (
    echo.
    echo ***** ANDROID SYNC FAILED. *****
    echo The web build is fine, but Capacitor could not sync.
    echo Scroll up to read the error, then report it back in Cursor.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   All done!
echo   - Web build verified (dist folder is up to date)
echo   - Android project updated with the latest build
echo.
echo   Next: open the "android" folder in Android Studio and
echo   press Run to test on the emulator or your phone.
echo ============================================================
pause
