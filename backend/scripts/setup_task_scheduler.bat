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
schtasks /delete /tn "Django Periodic Email Notification Task" /f >nul 2>&1
schtasks /delete /tn "Django Periodic Addition Task" /f >nul 2>&1
schtasks /delete /tn "Django Test Task" /f >nul 2>&1

echo ✅ Cleanup completed
echo.

echo 📅 Creating Django Periodic Email Notification Task...
echo    - Will run every minute
echo    - Sends emails to users with emailNotifications enabled
echo.

REM Create the periodic email notification task (every minute) for current user
schtasks /create /tn "Django Periodic Email Notification Task" /tr "C:\Min-Now_Web-App-1\backend\scripts\run_email_notifications.bat" /sc minute /mo 1 /f

if %errorLevel% == 0 (
    echo ✅ Django Periodic Email Notification Task created successfully
) else (
    echo ❌ Failed to create Django Periodic Email Notification Task
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
echo 2. Test manually: python manage.py run_email_notifications --verbose --dry-run
echo 3. Check logs at: C:\Min-Now_Web-App-1\logs\email_notifications.log
echo 4. To disable: schtasks /change /tn "Django Periodic Email Notification Task" /disable
echo 5. To enable: schtasks /change /tn "Django Periodic Email Notification Task" /enable
echo 6. To delete: schtasks /delete /tn "Django Periodic Email Notification Task" /f
echo.
echo ℹ️  Note: Task runs under your user account (no admin privileges needed)
echo ℹ️  Only users with emailNotifications=true in Clerk metadata will receive emails
echo.

pause
