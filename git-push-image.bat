@echo off
cd /d "%~dp0"

echo === Adding Fit.jpg and pushing to GitHub ===

git add public/Fit.jpg
if errorlevel 1 (
    echo [FAIL] git add failed
    pause
    exit /b 1
)

git commit -m "Add Fit.jpg logo to public folder"
if errorlevel 1 (
    echo [INFO] Nothing new to commit - image may already be committed
)

git push origin main
if errorlevel 1 (
    echo [FAIL] git push failed
    pause
    exit /b 1
)

echo.
echo === SUCCESS: Fit.jpg pushed to GitHub ===
echo Vercel will auto-redeploy with the new image.
echo.
pause
