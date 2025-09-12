@echo off
REM ========================================
REM     MONTHLY EMAIL NOTIFICATION TEST
REM ========================================
REM This script tests the monthly email notification system
REM by simulating what would happen on the 1st day of the month

echo ========================================
echo     MONTHLY EMAIL NOTIFICATION TEST
echo ========================================
echo.

echo 🧪 Testing monthly email notification system...
echo    - Simulates first day of the month behavior
echo    - Shows which users would receive emails
echo    - Can create test data or use existing data
echo.

cd /d "C:\Min-Now_Web-App-1\backend"

echo � Step 1: Analyzing current user and checkup state...
"C:\Min-Now_Web-App-1\backend\venv\Scripts\python.exe" manage.py test_monthly_emails --verbose

echo.
echo 🎯 Choose test option:
echo 1) Test with current data (recommended first)
echo 2) Create test data and run comprehensive test
echo 3) Reset all test data back to normal
echo.

set /p choice="Enter your choice (1-3): "

if "%choice%"=="1" (
    echo.
    echo � Testing with current data...
    goto :test_current
) else if "%choice%"=="2" (
    echo.
    echo 🔧 Creating test data and running comprehensive test...
    goto :test_with_data
) else if "%choice%"=="3" (
    echo.
    echo 🔄 Resetting test data...
    goto :reset_data
) else (
    echo ❌ Invalid choice, defaulting to test with current data...
    goto :test_current
)

:test_current
echo 📧 Running monthly email notification test (DRY RUN)...
"C:\Min-Now_Web-App-1\backend\venv\Scripts\python.exe" manage.py run_email_notifications --verbose --test-monthly --dry-run --log-file "C:\Min-Now_Web-App-1\logs\monthly_email_test.log"
goto :ask_real_test

:test_with_data
echo 🔧 Creating test checkups that are due...
"C:\Min-Now_Web-App-1\backend\venv\Scripts\python.exe" manage.py test_monthly_emails --verbose --create-test-data

echo.
echo 📧 Running monthly email notification test with test data (DRY RUN)...
"C:\Min-Now_Web-App-1\backend\venv\Scripts\python.exe" manage.py run_email_notifications --verbose --test-monthly --dry-run --log-file "C:\Min-Now_Web-App-1\logs\monthly_email_test.log"
goto :ask_real_test

:reset_data
"C:\Min-Now_Web-App-1\backend\venv\Scripts\python.exe" manage.py test_monthly_emails --verbose --reset-test-data
echo ✅ Test data reset completed
goto :end

:ask_real_test
if %errorLevel% == 0 (
    echo.
    echo ✅ Monthly email test completed successfully (DRY RUN)
    echo.
    echo 📧 Do you want to send REAL emails?
    echo ⚠️  This will send actual emails to users with due checkups!
    echo.
    
    set /p confirm="Send real test emails? (y/N): "
    if /i "%confirm%"=="y" (
        echo.
        echo 📤 Sending real emails...
        "C:\Min-Now_Web-App-1\backend\venv\Scripts\python.exe" manage.py run_email_notifications --verbose --test-monthly --log-file "C:\Min-Now_Web-App-1\logs\monthly_email_test.log"
        
        if %errorLevel% == 0 (
            echo ✅ Real email test completed successfully
        ) else (
            echo ❌ Real email test failed with error level: %errorLevel%
        )
    ) else (
        echo ⏭️  Skipped real email sending
    )
) else (
    echo ❌ Monthly email test failed with error level: %errorLevel%
)

:end
echo.
echo 📊 Test Results Summary:
echo ========================================
echo Check the log file for detailed results:
echo C:\Min-Now_Web-App-1\logs\monthly_email_test.log
echo.
echo 🎯 What this test shows:
echo 1. Total users in database with Clerk IDs
echo 2. Users with email notifications enabled
echo 3. Users with due checkups (based on checkup intervals)
echo 4. Emails that would be sent on the 1st of the month
echo.
echo 📅 Production Scheduling Information:
echo - Actual scheduler runs on 1st of each month only
echo - Windows Task Scheduler: schtasks /query /tn "Django*"
echo - Production script: start_django_scheduler_production_v2.sh
echo - Only users with emailNotifications=true receive emails
echo - Only sends emails when checkups are actually due
echo.
echo 🔧 Useful commands for testing:
echo - python manage.py test_monthly_emails --verbose
echo - python manage.py test_monthly_emails --create-test-data
echo - python manage.py test_monthly_emails --reset-test-data
echo - python manage.py run_email_notifications --test-monthly --dry-run
echo.

pause
