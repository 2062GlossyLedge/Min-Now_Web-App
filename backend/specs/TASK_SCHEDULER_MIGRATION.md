# Django Task Scheduler Migration

This document explains how the project has migrated from Celery periodic tasks to Django management commands with Windows Task Scheduler.

## Overview

Previously, the project used Celery with Redis for periodic tasks. This has been replaced with:
- **Django Management Commands**: For task logic
- **Windows Task Scheduler**: For scheduling
- **Batch Scripts**: For execution and logging

## Benefits

✅ **Simplified Architecture**: No Redis dependency for scheduling  
✅ **Native Windows Integration**: Uses built-in Task Scheduler  
✅ **Better Logging**: Centralized logs with timestamps  
✅ **Easier Debugging**: Run commands manually for testing  
✅ **Reduced Dependencies**: Less infrastructure to manage  

## File Structure

```
backend/
├── items/management/commands/
│   ├── run_addition_task.py     # Addition task command
│   └── run_test_task.py         # Test task command
├── scripts/
│   ├── run_periodic_addition.bat    # Batch script for Task Scheduler
│   ├── setup_task_scheduler.bat     # Sets up Windows scheduled tasks
│   └── manage_tasks.bat             # Task management interface
└── items/background/
    └── tasks.py                     # Celery setup (now optional)

logs/
└── periodic_tasks.log               # Centralized logging
```

## Usage

### 1. Set Up Task Scheduler (One-time)

Run as Administrator:
```batch
cd C:\Min-Now_Web-App-1\backend\scripts
.\setup_task_scheduler.bat
```

### 2. Manage Tasks

```batch
cd C:\Min-Now_Web-App-1\backend\scripts
.\manage_tasks.bat
```

### 3. Manual Testing

```batch
cd C:\Min-Now_Web-App-1\backend
python manage.py run_addition_task --verbose
python manage.py run_test_task test_argument --verbose
```

### 4. View Logs

```batch
type C:\Min-Now_Web-App-1\logs\periodic_tasks.log
```

## Task Scheduler Commands

```batch
# View all Django tasks
schtasks /query /tn "Django*"

# Enable task
schtasks /change /tn "Django Periodic Addition Task" /enable

# Disable task
schtasks /change /tn "Django Periodic Addition Task" /disable

# Delete task
schtasks /delete /tn "Django Periodic Addition Task" /f
```

## Migration Notes

### What Changed
- ✅ Periodic tasks moved from Celery to Windows Task Scheduler
- ✅ Task logic moved to Django management commands
- ✅ Celery periodic task setup disabled (commented out)
- ✅ Centralized logging added

### What Stayed
- ✅ Celery still available for manual async tasks
- ✅ Redis connection maintained for manual Celery usage
- ✅ Original task logic preserved

### Celery Usage (Optional)

If you still need Celery for async tasks:
```python
# Manual task execution
from items.background.tasks import add, test
result = add.delay(10, 20)  # Async execution
result = test.delay("manual_test")  # Async execution
```

## Troubleshooting

### Task Not Running
1. Check if task is enabled: `schtasks /query /tn "Django*"`
2. Verify batch script path exists
3. Check logs for errors

### Permission Issues
- Run setup script as Administrator
- Ensure Django project path is accessible

### Virtual Environment
- Update batch scripts if using different venv path
- Ensure venv is activated in batch scripts

## Environment Variables

The system respects existing environment variables:
- `RAILWAY_ENVIRONMENT`: Detects production environment
- Django settings for database, logging, etc.

No additional configuration needed for the Task Scheduler approach.
