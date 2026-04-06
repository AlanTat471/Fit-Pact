@echo off
cd /d "%~dp0"
start /b npm run dev
timeout /t 5 /nobreak >nul
start http://localhost:8080
