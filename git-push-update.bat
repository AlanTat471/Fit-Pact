@echo off
echo ========================================
echo   Numi - UI Polish Pass (Brown Theme)
echo   Tabs, Inputs, Buttons, Stat Cards
echo ========================================
echo.

cd /d "%~dp0"

echo Adding changed files...

:: Global CSS + Tailwind
git add src/index.css

:: Global shadcn components (Button, Input, Textarea, Tabs)
git add src/components/ui/button.tsx
git add src/components/ui/input.tsx
git add src/components/ui/textarea.tsx
git add src/components/ui/tabs.tsx

:: Layout
git add src/components/BottomNav.tsx

:: Pages - Core (this round)
git add src/pages/Settings.tsx
git add src/pages/PaymentDetails.tsx
git add src/pages/Profile.tsx
git add src/pages/Dashboard.tsx
git add src/pages/CommunityHelp.tsx

:: This file
git add git-push-update.bat

echo.
echo Committing...
git commit -m "UI polish: brown active tabs, darker inputs, solid brown CTAs, aligned plan cards, light-only dashboard/profile hero, inline day goals"

echo.
echo Pushing to origin...
git push

echo.
echo ========================================
echo   Push complete!
echo ========================================
pause
