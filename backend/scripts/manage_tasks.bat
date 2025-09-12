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
echo 2. Start Django Periodic Email Notification Task
echo 3. Stop Django Periodic Email Notification Task
echo 4. View task logs
echo 5. Test email notification command manually (dry run)
echo 6. Test email notification command manually (send emails)
echo 7. Test addition command manually (legacy)
echo 8. Clear logs
echo 9. Remove all Django scheduled tasks
echo 10. Exit
echo.

set /p choice="Enter your choice (1-10): "

if "%choice%"=="1" goto view_tasks
if "%choice%"=="2" goto start_task
if "%choice%"=="3" goto stop_task
if "%choice%"=="4" goto view_logs
if "%choice%"=="5" goto test_email_dry_run
if "%choice%"=="6" goto test_email_send
if "%choice%"=="7" goto test_addition
if "%choice%"=="8" goto clear_logs
if "%choice%"=="9" goto remove_tasks
if "%choice%"=="10" goto exit
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
echo 🚀 Starting Django Periodic Email Notification Task...
schtasks /change /tn "Django Periodic Email Notification Task" /enable
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
echo 🛑 Stopping Django Periodic Email Notification Task...
schtasks /change /tn "Django Periodic Email Notification Task" /disable
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
if exist "C:\Min-Now_Web-App-1\logs\email_notifications.log" (
    echo.
    echo Last 20 lines of email_notifications.log:
    echo ----------------------------------------
    powershell "Get-Content 'C:\Min-Now_Web-App-1\logs\email_notifications.log' | Select-Object -Last 20"
) else (
    echo No log file found at C:\Min-Now_Web-App-1\logs\email_notifications.log
)
echo.
pause
goto menu

:test_email_dry_run
echo.
echo 📧 Testing email notification command (dry run - no emails sent)...
cd /d "C:\Min-Now_Web-App-1\backend"
"C:\Min-Now_Web-App-1\backend\venv\Scripts\python.exe" manage.py run_email_notifications --verbose --dry-run
echo.
pause
goto menu

:test_email_send
echo.
echo 📧 Testing email notification command (WILL SEND EMAILS)...
echo ⚠️  WARNING: This will actually send emails to users!
set /p confirm="Are you sure? (y/N): "
if /i "%confirm%"=="y" (
    cd /d "C:\Min-Now_Web-App-1\backend"
    "C:\Min-Now_Web-App-1\backend\venv\Scripts\python.exe" manage.py run_email_notifications --verbose
) else (
    echo Operation cancelled
)
echo.
pause
goto menu

:test_addition
echo.
echo 🧮 Testing addition command manually (legacy)...
cd /d "C:\Min-Now_Web-App-1\backend"
"C:\Min-Now_Web-App-1\backend\venv\Scripts\python.exe" manage.py run_addition_task --verbose
echo.
pause
goto menu

:test_test
echo.
echo 🧪 Testing test command manually...
cd /d "C:\Min-Now_Web-App-1\backend"
"C:\Min-Now_Web-App-1\backend\venv\Scripts\python.exe" manage.py run_test_task test_manual --verbose
echo.
pause
goto menu

:clear_logs
echo.
echo 🗑️ Clearing log files...
if exist "C:\Min-Now_Web-App-1\logs\email_notifications.log" (
    del "C:\Min-Now_Web-App-1\logs\email_notifications.log"
    echo ✅ Email notifications log file cleared
) else (
    echo No email notifications log file to clear
)
if exist "C:\Min-Now_Web-App-1\logs\periodic_tasks.log" (
    del "C:\Min-Now_Web-App-1\logs\periodic_tasks.log"
    echo ✅ Legacy periodic tasks log file cleared
) else (
    echo No legacy periodic tasks log file to clear
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
    schtasks /delete /tn "Django Periodic Email Notification Task" /f >nul 2>&1
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
