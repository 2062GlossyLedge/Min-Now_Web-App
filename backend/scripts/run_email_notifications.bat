@echo off
REM ========================================
REM  EMAIL NOTIFICATION TASK - WINDOWS
REM ========================================
REM This script runs the Django email notification command

echo ========================================
echo    EMAIL NOTIFICATION TASK - WINDOWS
echo ========================================
echo.

cd /d "C:\Min-Now_Web-App-1\backend"

echo 📧 Running email notification task...
echo 🐍 Using virtual environment Python...
echo.

"C:\Min-Now_Web-App-1\backend\venv\Scripts\python.exe" manage.py run_email_notifications --verbose --log-file "C:\Min-Now_Web-App-1\logs\email_notifications.log"

if %errorLevel% == 0 (
    echo ✅ Email notification task completed successfully
) else (
    echo ❌ Email notification task failed with error level: %errorLevel%
)

echo.
pause
