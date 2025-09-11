#!/bin/bash

echo "========================================="
echo "    CELERY PRODUCTION STARTUP SCRIPT"
echo "========================================="
echo ""

# Set production environment
export RAILWAY_ENVIRONMENT=production

# Change to the correct directory
cd /app/backend/items/background

echo "🚂 Starting Celery services in PRODUCTION mode..."
echo "📍 Current directory: $(pwd)"
echo "🔧 Python version: $(python --version)"
echo "📦 Celery version: $(celery --version)"
echo ""

# Check if we can import our tasks
echo "🔍 Checking if tasks module can be imported..."
python -c "import tasks; print('✅ Tasks module imported successfully')" || {
    echo "❌ Failed to import tasks module"
    exit 1
}

echo ""
echo "🚀 Starting Celery worker and beat processes..."
echo ""

# Create a function to handle graceful shutdown
cleanup() {
    echo ""
    echo "🛑 Shutting down Celery processes..."
    kill $WORKER_PID $BEAT_PID 2>/dev/null
    wait $WORKER_PID $BEAT_PID 2>/dev/null
    echo "✅ Shutdown complete"
    exit 0
}

# Set up signal handlers for graceful shutdown
trap cleanup SIGTERM SIGINT

# Start Celery worker in the background
echo "🔧 Starting Celery worker..."
celery -A tasks worker \
    --loglevel=INFO \
    --concurrency=1 \
    --pool=prefork \
    --without-gossip \
    --without-mingle \
    --without-heartbeat &
WORKER_PID=$!

# Wait a moment for worker to start
sleep 5

# Start Celery beat in the background
echo "📅 Starting Celery beat scheduler..."
celery -A tasks beat \
    --loglevel=INFO \
    --schedule=/tmp/celerybeat-schedule \
    --pidfile=/tmp/celerybeat.pid &
BEAT_PID=$!

echo ""
echo "✅ Both processes started successfully!"
echo "🔧 Worker PID: $WORKER_PID"
echo "📅 Beat PID: $BEAT_PID"
echo ""
echo "📊 Process status:"
ps -p $WORKER_PID,$BEAT_PID -o pid,ppid,cmd

echo ""
echo "🎯 Services are running. Addition tasks will execute every minute."
echo "📝 Logs will appear below..."
echo ""

# Wait for both processes to finish
wait $WORKER_PID $BEAT_PID
