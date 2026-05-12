@echo off
echo ================================================
echo   Numi - auth session gate + trusted devices
echo ================================================
echo.

cd /d "%~dp0"

echo Adding changed files...

git add src/lib/authSessionGate.ts
git add src/lib/deviceFingerprint.ts
git add src/lib/supabaseTrustedDevices.ts

git add src/contexts/AuthContext.tsx
git add src/pages/Index.tsx
git add src/components/LoginForm.tsx
git add src/pages/Register.tsx
git add src/components/RegisterForm.tsx
git add src/layouts/AppLayout.tsx

git add git-push-update.bat

echo Committing...
git commit ^
  -m "Auth: require explicit login per visit; harden trusted devices" ^
  -m "Clear restored JWT unless numiLoginOkThisDocument is set after password/OTP/device verify or registration (useLayoutEffect gate). Remove Index auto-redirect to dashboard." ^
  -m "Trusted device: stable install id in fingerprint; per-user local trust cache; treat Supabase read errors with fallback; surface addTrustedDevice errors softly." ^
  -m "Idle timeout clears explicit-login flag. Register redirect to dashboard only when gate flag set."

echo.
echo Pushing to origin...
git push

echo.
echo ================================================
echo   Push complete!
echo   Next: npm install, npm run build, deploy Vercel, npx cap sync android, new AAB if needed.
echo ================================================
pause
