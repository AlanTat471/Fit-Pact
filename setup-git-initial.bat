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

git commit -m "Initial commit"
if errorlevel 1 (
  echo.
  echo If commit failed, you may need: git config user.email "you@example.com"
  echo and: git config user.name "Your Name"
  goto :error
)

echo.
echo Done.
pause
exit /b 0

:error
echo.
echo Something failed. Make sure Git is installed: https://git-scm.com/download/win
pause
exit /b 1
