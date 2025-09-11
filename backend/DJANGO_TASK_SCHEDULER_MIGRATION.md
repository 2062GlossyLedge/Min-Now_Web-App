# Django Task Scheduler Migration Documentation

## Overview

This project has migrated from **Celery-based periodic tasks** to **Django Management Commands with Task Scheduling** for better compatibility with Railway deployment and simplified dependency management.

## Migration Summary

### Before (Celery Setup)
- ✗ Required Redis/Celery dependencies
- ✗ Complex multi-process setup (worker + beat)
- ✗ Railway deployment issues with background processes
- ✗ Resource intensive for simple periodic tasks

### After (Django Task Scheduler)
- ✅ No Redis/Celery dependencies required
- ✅ Simple single-process loop
- ✅ Railway-compatible deployment
- ✅ Lightweight and efficient for simple tasks

## Files Changed

### 1. Railway Configuration
**File:** `railway.json`
```json
{
    "deploy": {
        "startCommand": "cd backend/items/background && chmod +x start_django_scheduler_production.sh && ./start_django_scheduler_production.sh"
    }
}
```

### 2. New Production Scripts
- `start_django_scheduler_production.sh` - Main production script
- `start_django_scheduler_production_v2.sh` - Enhanced version with better error handling

### 3. Django Management Command
**File:** `backend/items/management/commands/run_addition_task.py`
- Replaces Celery periodic tasks
- Can be run manually or via scheduler
- Supports logging and verbose output

## How It Works

### Production Deployment (Railway)
1. Railway starts the Django scheduler script
2. Script runs `python manage.py run_addition_task` every 60 seconds
3. Tasks are logged to `/app/logs/periodic_tasks.log`
4. Graceful shutdown handling with signal traps

### Local Development (Windows)
1. Use Windows Task Scheduler with provided batch scripts
2. Run `setup_task_scheduler.bat` to configure automatic execution
3. Manage tasks with `manage_tasks.bat`

## Commands

### Manual Task Execution
```bash
# Run the addition task manually
python manage.py run_addition_task --verbose

# Run with custom parameters
python manage.py run_addition_task --x 10 --y 20 --verbose

# Run with logging to file
python manage.py run_addition_task --verbose --log-file /path/to/logfile.log
```

### Railway Deployment
```bash
# The deployment automatically runs:
./start_django_scheduler_production.sh
```

### Windows Task Scheduler (Development)
```batch
# Setup scheduled tasks
backend\scripts\setup_task_scheduler.bat

# Manage tasks
backend\scripts\manage_tasks.bat
```

## Benefits of Migration

1. **Simplified Dependencies**: No need for Redis, Celery, or message brokers
2. **Railway Compatibility**: Works seamlessly with Railway's deployment model
3. **Resource Efficiency**: Lower memory and CPU usage for simple periodic tasks
4. **Easier Debugging**: Direct Django logging and error handling
5. **Cross-Platform**: Works on Windows (Task Scheduler) and Linux (cron/systemd)

## Monitoring and Logs

### Production (Railway)
- Logs are written to `/app/logs/periodic_tasks.log`
- Live logs visible in Railway dashboard
- Script shows real-time execution status

### Development (Windows)
- Logs written to `C:\Min-Now_Web-App-1\logs\periodic_tasks.log`
- Use `manage_tasks.bat` to view logs
- Windows Event Viewer shows Task Scheduler execution

## Rollback Plan

If needed, you can rollback to Celery by:

1. Restore `railway.json` to use `start_celery_production.sh`
2. Ensure Redis/Celery dependencies are installed
3. Re-enable periodic tasks in `tasks.py` (currently commented out)

## Future Enhancements

1. **Multiple Task Types**: Add more management commands for different periodic tasks
2. **Configuration**: Make task intervals configurable via environment variables
3. **Health Checks**: Add endpoint to verify scheduler is running
4. **Monitoring**: Add metrics and alerting for task failures
5. **Scaling**: Consider using systemd/cron for more complex scheduling needs

## Testing

### Local Testing
```bash
# Test the management command
python manage.py run_addition_task --verbose

# Test with different parameters
python manage.py run_addition_task --x 5 --y 10 --verbose
```

### Production Testing
```bash
# SSH into Railway container and check logs
tail -f /app/logs/periodic_tasks.log

# Check if process is running
ps aux | grep python
```

## Support

For issues or questions regarding the task scheduler migration:
1. Check the logs first (`periodic_tasks.log`)
2. Verify Django management command works manually
3. Ensure proper file permissions on shell scripts
4. Check Railway environment variables are set correctly
