@echo off
echo ================================================
echo   Numi - biometrics removal + Previous Weeks line
echo ================================================
echo.

cd /d "%~dp0"

echo Adding changed files...

git add src/lib/lastLoginEmail.ts
git add src/components/LoginForm.tsx
git add src/pages/Logout.tsx
git add package.json
git add package-lock.json
git add android/app/build.gradle

git add src/index.css
git add src/pages/Dashboard.tsx

git add -u src/lib/

git add resources/README.md 2>nul
git add git-push-update.bat
echo Committing...
git commit ^
  -m "Remove biometric sign-in; keep last-email prefill; full gain/loss on Dashboard" ^
  -m "Dropped @capgo/capacitor-native-biometric (npm audit) and deleted biometricAuth.ts. Login is password or OTP only again. Email is still saved to localStorage (numiLastEmail) after successful sign-in so the field pre-fills next time. Legacy numiBiometricEnabled key is cleared once when the login screen mounts." ^
  -m "Dashboard Previous Weeks: new .completed-week-summary-line replaces .auto-fit-text on the summary row so Gain/Loss (+/- kg) is not truncated with ellipsis on narrow phones."

echo.
echo Pushing to origin...
git push

echo.
echo ================================================
echo   Push complete!
echo.
echo   On your PC, refresh dependencies and Android:
echo     npm install
echo     npm run build
echo     npx cap sync android
echo   Then open Android Studio and build a new AAB.
echo ================================================
pause
