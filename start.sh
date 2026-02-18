#!/bin/bash

if [ "$SERVICE_TYPE" = "web" ]; then
    exec gunicorn backend.minNow.wsgi:application --bind 0.0.0.0:$PORT
elif [ "$SERVICE_TYPE" = "scheduler" ]; then
    cd backend/items/background && chmod +x start_django_scheduler_production_v2.sh && exec ./start_django_scheduler_production_v2.sh
else
    echo "Error: SERVICE_TYPE environment variable not set"
    echo "Please set SERVICE_TYPE to either 'web' or 'scheduler'"
    exit 1
fi
