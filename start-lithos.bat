@echo off
title LITHOS - Startup Launcher
color 0B
echo ============================================================
echo      LITHOS - Terrain Intelligence Platform Launcher
echo ============================================================
echo.

REM Detect Python executable (prefer project virtualenv if available)
set "PYTHON_EXEC=python"
if exist "%~dp0.venv\Scripts\python.exe" (
    set "PYTHON_EXEC=%~dp0.venv\Scripts\python.exe"
    echo [ENV] Using project virtual environment: %~dp0.venv
)

echo [1/2] Starting LITHOS Backend API (FastAPI on Port 8000)...
start "LITHOS Backend (Port 8000)" cmd /k "cd /d "%~dp0phase7-webapp\backend" && "%PYTHON_EXEC%" run_server.py"

echo [2/2] Starting LITHOS Web Client (Vite on Port 5173)...
start "LITHOS Frontend (Port 5173)" cmd /k "cd /d "%~dp0phase7-webapp\frontend" && npm run dev"

echo.
echo Initializing servers (waiting 5 seconds)...
timeout /t 5 /nobreak >nul

echo Launching LITHOS in your default browser...
start http://localhost:5173/

echo.
echo ============================================================
echo   LITHOS Web Client: http://localhost:5173/
echo   Backend API Docs:  http://localhost:8000/docs
echo ============================================================
echo Keep the backend and frontend terminal windows open.
pause
