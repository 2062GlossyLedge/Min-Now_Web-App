@echo off
REM ========================================
REM     DJANGO TASK SCHEDULER MANAGER
REM ========================================
REM This script helps manage Django scheduled tasks

echo ========================================
echo    DJANGO TASK SCHEDULER MANAGER
echo ========================================
echo.

:menu
echo Please choose an option:
echo 1. View all Django scheduled tasks
echo 2. Start Django Periodic Addition Task
echo 3. Stop Django Periodic Addition Task
echo 4. View task logs
echo 5. Test addition command manually
echo 6. Test test command manually
echo 7. Clear logs
echo 8. Remove all Django scheduled tasks
echo 9. Exit
echo.

set /p choice="Enter your choice (1-9): "

if "%choice%"=="1" goto view_tasks
if "%choice%"=="2" goto start_task
if "%choice%"=="3" goto stop_task
if "%choice%"=="4" goto view_logs
if "%choice%"=="5" goto test_addition
if "%choice%"=="6" goto test_test
if "%choice%"=="7" goto clear_logs
if "%choice%"=="8" goto remove_tasks
if "%choice%"=="9" goto exit
goto menu

:view_tasks
echo.
echo 📊 Django Scheduled Tasks:
schtasks /query /tn "Django*" /fo table 2>nul
if %errorLevel% neq 0 (
    echo No Django tasks found.
)
echo.
pause
goto menu

:start_task
echo.
echo 🚀 Starting Django Periodic Addition Task...
schtasks /change /tn "Django Periodic Addition Task" /enable
if %errorLevel% == 0 (
    echo ✅ Task enabled successfully
) else (
    echo ❌ Failed to enable task. Make sure it exists.
)
echo.
pause
goto menu

:stop_task
echo.
echo 🛑 Stopping Django Periodic Addition Task...
schtasks /change /tn "Django Periodic Addition Task" /disable
if %errorLevel% == 0 (
    echo ✅ Task disabled successfully
) else (
    echo ❌ Failed to disable task. Make sure it exists.
)
echo.
pause
goto menu

:view_logs
echo.
echo 📜 Recent log entries:
if exist "C:\Min-Now_Web-App-1\logs\periodic_tasks.log" (
    echo.
    echo Last 20 lines of periodic_tasks.log:
    echo ----------------------------------------
    powershell "Get-Content 'C:\Min-Now_Web-App-1\logs\periodic_tasks.log' | Select-Object -Last 20"
) else (
    echo No log file found at C:\Min-Now_Web-App-1\logs\periodic_tasks.log
)
echo.
pause
goto menu

:test_addition
echo.
echo 🧮 Testing addition command manually...
cd /d "C:\Min-Now_Web-App-1\backend"
python manage.py run_addition_task --verbose
echo.
pause
goto menu

:test_test
echo.
echo 🧪 Testing test command manually...
cd /d "C:\Min-Now_Web-App-1\backend"
python manage.py run_test_task test_manual --verbose
echo.
pause
goto menu

:clear_logs
echo.
echo 🗑️ Clearing log files...
if exist "C:\Min-Now_Web-App-1\logs\periodic_tasks.log" (
    del "C:\Min-Now_Web-App-1\logs\periodic_tasks.log"
    echo ✅ Log file cleared
) else (
    echo No log file to clear
)
echo.
pause
goto menu

:remove_tasks
echo.
echo ⚠️  WARNING: This will remove ALL Django scheduled tasks!
set /p confirm="Are you sure? (y/N): "
if /i "%confirm%"=="y" (
    echo 🛑 Removing Django scheduled tasks...
    schtasks /delete /tn "Django Periodic Addition Task" /f >nul 2>&1
    schtasks /delete /tn "Django Test Task" /f >nul 2>&1
    echo ✅ All Django tasks removed
) else (
    echo Operation cancelled
)
echo.
pause
goto menu

:exit
echo.
echo 👋 Goodbye!
exit /b 0
