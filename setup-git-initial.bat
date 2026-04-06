@echo off
REM Run this by double-clicking in File Explorer, or from Command Prompt.
REM It runs git in THIS folder (no need to type a path with apostrophes).
cd /d "%~dp0"
echo Working in: %CD%
echo.

if exist ".git" (
  echo A .git folder already exists. Skipping git init.
) else (
  git init
  if errorlevel 1 goto :error
)

git add .
if errorlevel 1 goto :error

REM "git commit" exits with 1 when there is nothing new to commit — that is OK, not an error.
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Initial commit"
  if errorlevel 1 (
    echo.
    echo Commit failed. Set your Git identity, then run this script again:
    echo   git config user.email "you@example.com"
    echo   git config user.name "Your Name"
    goto :error
  )
) else (
  echo Nothing new to commit — working tree is already clean. Your repo is ready.
)

echo.
echo Done.
pause
exit /b 0

:error
echo.
echo Something failed. If you see "git is not recognized", install Git: https://git-scm.com/download/win
pause
exit /b 1
