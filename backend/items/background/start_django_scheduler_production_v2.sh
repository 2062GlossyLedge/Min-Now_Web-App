#!/bin/bash

echo "========================================="
echo "   DJANGO TASK SCHEDULER - PRODUCTION"
echo "           (Celery-Free Version)"
echo "========================================="
echo ""

# Set production environment
export RAILWAY_ENVIRONMENT=production

# Change to the app directory
cd /app

echo "🚂 Starting Django Email Notification Scheduler in PRODUCTION mode..."
echo "📍 Current directory: $(pwd)"
echo "🔧 Python version: $(python --version)"
echo "📦 Django version: $(python -c 'import django; print(django.get_version())')"
echo "🎯 Mode: Django Management Commands (Email Notifications)"
echo ""

# Create logs directory if it doesn't exist
mkdir -p /app/logs

# Set the log file path
LOG_FILE="/app/logs/email_notifications.log"

echo "📝 Log file: $LOG_FILE"
echo ""

# Initialize Django settings
export DJANGO_SETTINGS_MODULE=backend.minNow.settings

# Test the Django management command first
echo "🧪 Testing Django email notification command..."
python manage.py run_email_notifications --verbose --dry-run || {
    echo "❌ Failed to run Django email notification command"
    exit 1
}

echo "✅ Django email notification command test successful"
echo ""

# Create a function to handle graceful shutdown
cleanup() {
    echo ""
    echo "🛑 Shutting down Django Email Notification Scheduler..."
    if [ ! -z "$SCHEDULER_PID" ]; then
        kill $SCHEDULER_PID 2>/dev/null
        wait $SCHEDULER_PID 2>/dev/null
    fi
    if [ ! -z "$TAIL_PID" ]; then
        kill $TAIL_PID 2>/dev/null
    fi
    echo "✅ Shutdown complete"
    exit 0
}

# Set up signal handlers for graceful shutdown
trap cleanup SIGTERM SIGINT EXIT

echo "🚀 Starting Django Email Notification Scheduler loop..."
echo "⏰ Email notifications will be checked once per month on the 1st day"
echo "📊 To monitor: tail -f $LOG_FILE"
echo "🔄 Press Ctrl+C to stop"
echo ""

# Function to check if today is the first day of the month
is_first_day_of_month() {
    local day_of_month=$(date '+%-d')  # Use %-d to avoid leading zeros
    [ "$day_of_month" == "1" ]
}

# Function to calculate seconds until next first day of month
seconds_until_next_first() {
    local current_date=$(date '+%Y-%m-%d')
    local current_year=$(date '+%Y')
    local current_month=$(date '+%-m')  # Use %-m to avoid leading zeros
    local current_day=$(date '+%-d')    # Use %-d to avoid leading zeros
    
    if [ "$current_day" == "1" ]; then
        # If today is the 1st, next first day is next month
        local next_month=$((current_month + 1))
        local next_year=$current_year
        
        if [ $next_month -gt 12 ]; then
            next_month=1
            next_year=$((current_year + 1))
        fi
        
        local next_first=$(printf "%04d-%02d-01" $next_year $next_month)
    else
        # Next first day is first day of next month
        local next_month=$((current_month + 1))
        local next_year=$current_year
        
        if [ $next_month -gt 12 ]; then
            next_month=1
            next_year=$((current_year + 1))
        fi
        
        local next_first=$(printf "%04d-%02d-01" $next_year $next_month)
    fi
    
    local current_timestamp=$(date '+%s')
    local next_timestamp=$(date -d "$next_first" '+%s')
    local seconds_diff=$((next_timestamp - current_timestamp))
    
    echo $seconds_diff
}

# Function to run the periodic email notification task
run_periodic_email_task() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "$timestamp - � Running periodic email notification task..."
    
    # Run the Django management command with logging
    python backend/manage.py run_email_notifications \
        --verbose \
        --log-file "$LOG_FILE" 2>&1 | while IFS= read -r line; do
        echo "$timestamp - $line"
    done
    
    local exit_code=${PIPESTATUS[0]}
    if [ $exit_code -ne 0 ]; then
        echo "$timestamp - ❌ Email notification task execution failed with exit code: $exit_code"
        return $exit_code
    else
        echo "$timestamp - ✅ Email notification task execution completed successfully"
        return 0
    fi
}

# Start the periodic email notification scheduler
(
    # Initial delay to ensure Django is fully loaded
    sleep 5
    
    task_count=0
    
    echo "🗓️  Checking if today is the first day of the month..."
    
    # Check if today is the first day of the month and run immediately if so
    if is_first_day_of_month; then
        task_count=$((task_count + 1))
        echo "✅ Today is the 1st! Running email notification task..."
        echo "=================================="
        echo "Email Notification Check #$task_count"
        echo "=================================="
        
        run_periodic_email_task
        echo ""
    else
        echo "📅 Today is not the 1st day of the month. Waiting for next occurrence..."
    fi
    
    # Main scheduling loop
    while true; do
        seconds_to_wait=$(seconds_until_next_first)
        
        # Ensure we have a valid number
        if [ -z "$seconds_to_wait" ] || [ "$seconds_to_wait" -le 0 ]; then
            echo "⚠️  Error calculating wait time. Waiting 1 hour and retrying..."
            sleep 3600
            continue
        fi
        
        days_to_wait=$((seconds_to_wait / 86400))
        hours_to_wait=$(((seconds_to_wait % 86400) / 3600))
        minutes_to_wait=$(((seconds_to_wait % 3600) / 60))
        
        echo "⏳ Next execution in: ${days_to_wait}d ${hours_to_wait}h ${minutes_to_wait}m"
        echo "📅 Next run date: $(date -d "+${seconds_to_wait} seconds" '+%Y-%m-%d %H:%M:%S')"
        
        # Sleep until the first day of next month
        sleep $seconds_to_wait
        
        # Run the task when we wake up (should be 1st of the month)
        if is_first_day_of_month; then
            task_count=$((task_count + 1))
            echo "=================================="
            echo "Email Notification Check #$task_count"
            echo "$(date '+%Y-%m-%d') - First day of the month!"
            echo "=================================="
            
            run_periodic_email_task
            echo ""
        else
            echo "⚠️  Woke up but it's not the 1st day of the month. Recalculating..."
        fi
    done
) &

SCHEDULER_PID=$!

echo "✅ Django Email Notification Scheduler started successfully!"
echo "🆔 Scheduler PID: $SCHEDULER_PID"
echo ""
echo "📊 Process status:"
ps -p $SCHEDULER_PID -o pid,ppid,cmd 2>/dev/null || echo "Process status not available"

echo ""
echo "🎯 Django Email Notification Scheduler is running."
echo "📝 Live logs from $LOG_FILE:"
echo "=================================="

# Show live log output if log file exists, otherwise show a message
if [ -f "$LOG_FILE" ]; then
    tail -f "$LOG_FILE" &
    TAIL_PID=$!
else
    echo "Waiting for log file to be created..."
    # Wait for log file to be created, then start tailing
    while [ ! -f "$LOG_FILE" ]; do
        sleep 1
    done
    tail -f "$LOG_FILE" &
    TAIL_PID=$!
fi

# Wait for the scheduler process to finish
wait $SCHEDULER_PID
