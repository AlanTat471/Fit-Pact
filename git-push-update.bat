@echo off
echo ============================================================
echo   Numi v14 - Week 12 popup queue + maintenance fallbacks
echo ============================================================
echo.

cd /d "%~dp0"

echo Adding changed files...

REM v14 — Week 12 completion UX:
REM   • Targets-updated popup no longer overlaps Week 12 summary (fixes frozen Got it)
REM   • Dialog order: targets -^> Week 12 summary -^> Maintenance suggestion
REM   • Escape closes popups and shows Dashboard fallback cards
REM   • Start Maintenance Phase / Start Weight Loss Phase #N sections
REM
git add src/pages/Dashboard.tsx
git add android/app/build.gradle
git add BUGS-AND-DEFECTS.md
git add git-push-update.bat

echo Committing...
git commit ^
  -m "v14: fix Week 12 targets popup freeze and add maintenance fallbacks" ^
  -m "Queue the steps/calories targets dialog before the Week 12 summary so Radix AlertDialog overlay cannot block Got it. Escape closes popups and shows Maintenance Phase and Weight Loss Phase #N choice cards on the Dashboard. Skip-maintenance archives the completed cycle and starts fresh Acclimation from Week 12 end weight."

echo.
echo Pushing to origin...
git push

echo.
echo ============================================================
echo   Push complete!  versionCode 14, versionName 2.0
echo.
echo   1. VERCEL: wait for green deploy, hard-refresh (Ctrl+Shift+R)
echo   2. TEST on web:
echo      - Complete a week with weight gain (targets popup) -^> Got it works
echo      - Complete Week 12 with targets change: targets first, then summary, then maintenance
echo      - Press Escape on targets popup: two fallback sections appear on Dashboard
echo      - Tap Start Maintenance Phase OR Start Weight Loss Phase #2
echo   3. ANDROID:
echo        npm run build
echo        npx cap sync android
echo      Android Studio -^> signed AAB -^> Play Internal testing (v14 / 2.0)
echo   4. Supabase / Stripe: no changes
echo ============================================================
pause
