#!/bin/bash

echo "========================================="
echo "   DJANGO TASK SCHEDULER - PRODUCTION"
echo "           (Celery-Free Version)"
echo "========================================="
echo ""

# Set production environment
export RAILWAY_ENVIRONMENT=production

# Change to the backend directory
cd /app/backend

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
export DJANGO_SETTINGS_MODULE=minNow.settings

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
echo "⏰ Email notifications will be checked every 60 seconds"
echo "📊 To monitor: tail -f $LOG_FILE"
echo "🔄 Press Ctrl+C to stop"
echo ""

# Function to run the periodic email notification task
run_periodic_email_task() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "$timestamp - � Running periodic email notification task..."
    
    # Run the Django management command with logging
    python manage.py run_email_notifications \
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
    
    local task_count=0
    while true; do
        task_count=$((task_count + 1))
        echo "=================================="
        echo "Email Notification Check #$task_count"
        echo "=================================="
        
        run_periodic_email_task
        
        echo ""
        echo "⏳ Waiting 60 seconds until next execution..."
        echo ""
        
        # Wait 60 seconds before next execution
        sleep 60
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
