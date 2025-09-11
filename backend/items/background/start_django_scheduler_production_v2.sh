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

echo "🚂 Starting Django Task Scheduler in PRODUCTION mode..."
echo "📍 Current directory: $(pwd)"
echo "🔧 Python version: $(python --version)"
echo "📦 Django version: $(python -c 'import django; print(django.get_version())')"
echo "🎯 Mode: Django Management Commands (No Celery/Redis required)"
echo ""

# Create logs directory if it doesn't exist
mkdir -p /app/logs

# Set the log file path
LOG_FILE="/app/logs/periodic_tasks.log"

echo "📝 Log file: $LOG_FILE"
echo ""

# Initialize Django settings
export DJANGO_SETTINGS_MODULE=minNow.settings

# Test the Django management command first
echo "🧪 Testing Django management command..."
python manage.py run_addition_task --verbose || {
    echo "❌ Failed to run Django management command"
    exit 1
}

echo "✅ Django management command test successful"
echo ""

# Create a function to handle graceful shutdown
cleanup() {
    echo ""
    echo "🛑 Shutting down Django Task Scheduler..."
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

echo "🚀 Starting Django Task Scheduler loop..."
echo "⏰ Tasks will run every 60 seconds"
echo "📊 To monitor: tail -f $LOG_FILE"
echo "🔄 Press Ctrl+C to stop"
echo ""

# Function to run the periodic task
run_periodic_task() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "$timestamp - 🔄 Running periodic addition task..."
    
    # Run the Django management command with logging
    python manage.py run_addition_task \
        --x 16 \
        --y 16 \
        --verbose \
        --log-file "$LOG_FILE" 2>&1 | while IFS= read -r line; do
        echo "$timestamp - $line"
    done
    
    local exit_code=${PIPESTATUS[0]}
    if [ $exit_code -ne 0 ]; then
        echo "$timestamp - ❌ Task execution failed with exit code: $exit_code"
        return $exit_code
    else
        echo "$timestamp - ✅ Task execution completed successfully"
        return 0
    fi
}

# Start the periodic task scheduler
(
    # Initial delay to ensure Django is fully loaded
    sleep 5
    
    local task_count=0
    while true; do
        task_count=$((task_count + 1))
        echo "=================================="
        echo "Task Execution #$task_count"
        echo "=================================="
        
        run_periodic_task
        
        echo ""
        echo "⏳ Waiting 60 seconds until next execution..."
        echo ""
        
        # Wait 60 seconds before next execution
        sleep 60
    done
) &

SCHEDULER_PID=$!

echo "✅ Django Task Scheduler started successfully!"
echo "🆔 Scheduler PID: $SCHEDULER_PID"
echo ""
echo "📊 Process status:"
ps -p $SCHEDULER_PID -o pid,ppid,cmd 2>/dev/null || echo "Process status not available"

echo ""
echo "🎯 Django Task Scheduler is running."
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
