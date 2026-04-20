@echo off
echo ========================================
echo   Numi - Stitch Redesign Push
echo   Light theme + Plus Jakarta Sans
echo   Material Symbols + Numi branding
echo ========================================
echo.

cd /d "%~dp0"

echo Adding changed files...

:: Foundation
git add index.html
git add src/index.css
git add tailwind.config.ts
git add src/components/ui/material-icon.tsx

:: Layout
git add src/layouts/AppLayout.tsx
git add src/components/BottomNav.tsx
git add src/components/HamburgerMenu.tsx

:: Pages - Core
git add src/pages/MacroBreakdown.tsx
git add src/pages/Dashboard.tsx
git add src/pages/Workouts.tsx
git add src/pages/Profile.tsx
git add src/pages/Achievements.tsx

:: Pages - Secondary
git add src/pages/Settings.tsx
git add src/pages/PaymentDetails.tsx
git add src/pages/CommunityHelp.tsx
git add src/pages/AboutUs.tsx
git add src/pages/Privacy.tsx

:: Pages - Auth
git add src/pages/Index.tsx

:: Branding
git add src/components/AppSidebar.tsx
git add src/design/stitch-token-map.json
git add README.md

:: This file
git add git-push-update.bat

echo.
echo Committing...
git commit -m "Stitch redesign: light theme, Plus Jakarta Sans, Material Symbols, Numi branding"

echo.
echo Pushing to origin...
git push

echo.
echo ========================================
echo   Push complete!
echo ========================================
pause
