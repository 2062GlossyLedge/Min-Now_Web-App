@echo off
REM ========================================
REM     DJANGO TASK SCHEDULER SETUP
REM ========================================
REM This script sets up Windows Task Scheduler to run
REM Django management commands periodically.

echo ========================================
echo     DJANGO TASK SCHEDULER SETUP
echo ========================================
echo.

echo ℹ️  Setting up user-level scheduled tasks (no admin required)
echo.

echo 🛑 Removing any existing Django periodic tasks...

REM Remove existing tasks if they exist
schtasks /delete /tn "Django Periodic Addition Task" /f >nul 2>&1
schtasks /delete /tn "Django Test Task" /f >nul 2>&1

echo ✅ Cleanup completed
echo.

echo 📅 Creating Django Periodic Addition Task...
echo    - Will run every minute
echo    - Executes addition task (16 + 16)
echo.

REM Create the periodic addition task (every minute) for current user
schtasks /create /tn "Django Periodic Addition Task" /tr "C:\Min-Now_Web-App-1\backend\scripts\run_periodic_addition.bat" /sc minute /mo 1 /f

if %errorLevel% == 0 (
    echo ✅ Django Periodic Addition Task created successfully
) else (
    echo ❌ Failed to create Django Periodic Addition Task
    echo Error Level: %errorLevel%
)

echo.
echo 📊 Listing all Django-related scheduled tasks:
schtasks /query /tn "Django*" /fo table

echo.
echo ========================================
echo          SETUP COMPLETED
echo ========================================
echo.
echo 🎯 Next Steps:
echo 1. Verify tasks are created: schtasks /query /tn "Django*"
echo 2. Test manually: python manage.py run_addition_task --verbose
echo 3. Check logs at: C:\Min-Now_Web-App-1\logs\periodic_tasks.log
echo 4. To disable: schtasks /change /tn "Django Periodic Addition Task" /disable
echo 5. To enable: schtasks /change /tn "Django Periodic Addition Task" /enable
echo 6. To delete: schtasks /delete /tn "Django Periodic Addition Task" /f
echo.
echo ℹ️  Note: Task runs under your user account (no admin privileges needed)
echo.

pause
