#!/bin/bash

echo "========================================="
echo "   DJANGO TASK SCHEDULER - PRODUCTION"
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
echo ""

# Create logs directory if it doesn't exist
mkdir -p /app/logs

# Set the log file path
LOG_FILE="/app/logs/periodic_tasks.log"

echo "📝 Log file: $LOG_FILE"
echo ""

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
    kill $SCHEDULER_PID 2>/dev/null
    wait $SCHEDULER_PID 2>/dev/null
    echo "✅ Shutdown complete"
    exit 0
}

# Set up signal handlers for graceful shutdown
trap cleanup SIGTERM SIGINT

echo "🚀 Starting Django Task Scheduler loop..."
echo "⏰ Tasks will run every 60 seconds"
echo "📊 To monitor: tail -f $LOG_FILE"
echo ""

# Start the periodic task scheduler
(
    while true; do
        echo "$(date '+%Y-%m-%d %H:%M:%S') - 🔄 Running periodic addition task..."
        
        # Run the Django management command with logging
        python manage.py run_addition_task \
            --x 16 \
            --y 16 \
            --verbose \
            --log-file "$LOG_FILE" || {
            echo "$(date '+%Y-%m-%d %H:%M:%S') - ❌ Task execution failed"
        }
        
        # Wait 60 seconds before next execution
        sleep 60
    done
) &

SCHEDULER_PID=$!

echo "✅ Django Task Scheduler started successfully!"
echo "🆔 Scheduler PID: $SCHEDULER_PID"
echo ""
echo "📊 Process status:"
ps -p $SCHEDULER_PID -o pid,ppid,cmd

echo ""
echo "🎯 Django Task Scheduler is running. Addition tasks will execute every minute."
echo "📝 Logs will appear below and in $LOG_FILE..."
echo ""

# Show live log output
tail -f "$LOG_FILE" &
TAIL_PID=$!

# Wait for the scheduler process to finish
wait $SCHEDULER_PID

# Clean up tail process
kill $TAIL_PID 2>/dev/null
