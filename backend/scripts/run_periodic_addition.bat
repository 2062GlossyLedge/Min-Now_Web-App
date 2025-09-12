@echo off
REM# Change to the Django project directory
cd /d "C:\Min-Now_Web-App-1\backend"

REM Run the Django management command using virtual environment Python directly
echo %date% %time% - Executing addition task command >> "C:\Min-Now_Web-App-1\logs\periodic_tasks.log"
"C:\Min-Now_Web-App-1\backend\venv\Scripts\python.exe" manage.py run_addition_task --x 16 --y 16 --verbose --log-file "C:\Min-Now_Web-App-1\logs\periodic_tasks.log" >> "C:\Min-Now_Web-App-1\logs\periodic_tasks.log" 2>&1=============================
REM     DJANGO PERIODIC ADDITION TASK
REM ========================================
REM This batch script runs the Django management command
REM that replaces the Celery periodic task.
REM Called by Windows Task Scheduler every minute.

REM Ensure logs directory exists
if not exist "C:\Min-Now_Web-App-1\logs" mkdir "C:\Min-Now_Web-App-1\logs"

REM Log start time
echo %date% %time% - Starting periodic addition task >> "C:\Min-Now_Web-App-1\logs\periodic_tasks.log"

REM Change to the Django project directory
cd /d "C:\Min-Now_Web-App-1\backend"

REM Activate virtual environment if it exists
if exist "venv\Scripts\activate.bat" (
    echo %date% %time% - Activating virtual environment >> "C:\Min-Now_Web-App-1\logs\periodic_tasks.log"
    call venv\Scripts\activate.bat
)

REM Run the Django management command
echo %date% %time% - Executing addition task command >> "C:\Min-Now_Web-App-1\logs\periodic_tasks.log"
python manage.py run_addition_task --x 16 --y 16 --verbose --log-file "C:\Min-Now_Web-App-1\logs\periodic_tasks.log" >> "C:\Min-Now_Web-App-1\logs\periodic_tasks.log" 2>&1

REM Log completion
echo %date% %time% - Periodic addition task completed >> "C:\Min-Now_Web-App-1\logs\periodic_tasks.log"
echo. >> "C:\Min-Now_Web-App-1\logs\periodic_tasks.log"
