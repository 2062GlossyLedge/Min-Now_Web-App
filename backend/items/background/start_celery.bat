@echo off
echo ========================================
echo       CELERY WORKER & BEAT STARTER
echo ========================================
echo.

REM Change to the correct directory
cd /d "C:\Min-Now_Web-App-1\backend\items\background"

echo 🛑 Stopping any existing Celery processes...
echo.

REM Kill any existing celery processes
taskkill /f /im "celery.exe" 2>nul
taskkill /f /im "python.exe" /fi "WINDOWTITLE eq *celery*" 2>nul

REM More comprehensive process killing
for /f "tokens=2" %%i in ('tasklist /fi "imagename eq python.exe" /fo table /nh ^| findstr celery') do (
    echo Killing Python process: %%i
    taskkill /f /pid %%i 2>nul
)

echo ✅ Cleanup completed
echo.

REM Wait a moment for processes to fully terminate
timeout /t 2 /nobreak >nul

echo 🚀 Starting Celery Worker and Beat...
echo.
echo Worker will start in a new window...
echo Beat will start in this window...
echo.

REM Start the worker in a new command window
start "Celery Worker" cmd /k "echo 🔧 CELERY WORKER STARTING... && celery -A tasks worker --loglevel=info --pool=solo"

REM Wait a moment for worker to initialize
timeout /t 3 /nobreak >nul

echo 📅 Starting Celery Beat scheduler...
echo Press Ctrl+C to stop both worker and beat
echo.

REM Start beat in the current window
celery -A tasks beat --loglevel=info

echo.
echo 🛑 Beat stopped. Don't forget to close the Worker window!
pause
