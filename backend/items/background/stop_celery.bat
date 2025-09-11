@echo off
echo ========================================
echo       STOPPING CELERY PROCESSES
echo ========================================
echo.

echo 🛑 Stopping all Celery processes...

REM Kill celery.exe processes
taskkill /f /im "celery.exe" 2>nul
if %errorlevel% == 0 (
    echo ✅ Stopped celery.exe processes
) else (
    echo ℹ️  No celery.exe processes found
)

REM Kill Python processes that contain "celery" in their command line
echo 🔍 Looking for Python processes running Celery...

for /f "tokens=2,3" %%i in ('wmic process where "name='python.exe'" get processid^,commandline /format:csv ^| findstr celery') do (
    echo 🔪 Killing Python Celery process: %%j
    taskkill /f /pid %%j 2>nul
)

REM Alternative method using tasklist
for /f "tokens=2" %%i in ('tasklist /fi "imagename eq python.exe" /fo csv /nh ^| findstr celery') do (
    echo 🔪 Killing process: %%i
    taskkill /f /pid %%i 2>nul
)

echo.
echo ✅ Celery cleanup completed!
echo.
pause
