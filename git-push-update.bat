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
git add src/lib/motivationalQuotes.ts

git add src/contexts/AuthContext.tsx
git add src/pages/Index.tsx
git add src/components/LoginForm.tsx
git add src/pages/Register.tsx
git add src/components/RegisterForm.tsx
git add src/layouts/AppLayout.tsx

git add git-push-update.bat

echo Committing...
git commit ^
  -m "Fix Vercel build: track motivationalQuotes; auth session gate" ^
  -m "Add src/lib/motivationalQuotes.ts (was untracked — Dashboard/AuthContext/AppLayout import it; build failed on Vercel)." ^
  -m "Session gate: explicit login flag; trusted devices fingerprint + local trust fallback; idle clears login flag."

echo.
echo Pushing to origin...
git push

echo.
echo ================================================
echo   Push complete!
echo   Next: npm install, npm run build, deploy Vercel, npx cap sync android, new AAB if needed.
echo ================================================
pause
