@echo off
echo ========================================
echo   Numi - UI Polish Pass v2
echo   Day collapse, stat cards, bottom nav
echo ========================================
echo.

cd /d "%~dp0"

echo Adding changed files...

:: Previous-round global + component edits (in case not yet pushed)
git add src/index.css
git add src/components/ui/button.tsx
git add src/components/ui/input.tsx
git add src/components/ui/textarea.tsx
git add src/components/ui/tabs.tsx
git add src/components/BottomNav.tsx
git add src/pages/Settings.tsx
git add src/pages/PaymentDetails.tsx
git add src/pages/CommunityHelp.tsx

:: This round (UI polish v2)
git add src/pages/Profile.tsx
git add src/pages/Dashboard.tsx
git add src/pages/Workouts.tsx

:: Also commit the .bat file itself
git add git-push-update.bat

echo.
echo Committing...
git commit -m "UI polish v2: day collapse icons + outline cards + inline motivation + fixed save prompt (Dialog), brown stat cards (weight-loss + maintenance + streak), smaller date labels, TDEE dashboard button, flat bottom nav"

echo.
echo Pushing to origin...
git push

echo.
echo ========================================
echo   Push complete!
echo ========================================
pause
