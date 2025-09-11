@echo off
echo ========================================
echo    CELERY DEVELOPMENT ENVIRONMENT
echo ========================================
echo.

REM Change to the backend directory
cd /d "C:\Min-Now_Web-App-1\backend"

REM Check if virtual environment exists
if not exist "venv\Scripts\activate.bat" (
    echo ❌ Virtual environment not found at: venv\Scripts\activate.bat
    echo Please make sure you're in the correct directory and venv exists
    pause
    exit /b 1
)

echo 🔧 Activating virtual environment...
call venv\Scripts\activate.bat

REM Change to the tasks directory
cd items\background

echo 🛑 Cleaning up any existing Celery processes...
taskkill /f /im "celery.exe" 2>nul
taskkill /f /im "python.exe" /fi "WINDOWTITLE eq *celery*" 2>nul

REM Wait for cleanup
timeout /t 2 /nobreak >nul

echo.
echo 🚀 Starting Celery services...
echo.
echo 📋 Services that will start:
echo   - Worker (in new window)
echo   - Beat scheduler (in this window)
echo.

REM Start worker in new window with virtual environment
start "Celery Worker" cmd /k "cd /d C:\Min-Now_Web-App-1\backend && call venv\Scripts\activate.bat && cd items\background && echo 🔧 WORKER STARTING... && celery -A tasks worker --loglevel=info --pool=solo"

REM Give worker time to start
echo ⏳ Waiting for worker to initialize...
timeout /t 5 /nobreak >nul

echo 📅 Starting Beat scheduler in this window...
echo Press Ctrl+C to stop Beat (Worker will continue in separate window)
echo.

REM Start beat in current window
celery -A tasks beat --loglevel=info

echo.
echo 🛑 Beat scheduler stopped.
echo ⚠️  Don't forget to close the Worker window manually!
echo.
pause
