@echo off
REM Sync PostgreSQL data to Elasticsearch
REM This script exports data from PostgreSQL to NDJSON files and imports to Elasticsearch

echo ============================================================
echo PostgreSQL to Elasticsearch Sync
echo ============================================================
echo.

REM Change to backend directory (parent of scripts)
cd /d "%~dp0.."

REM Step 1: Export PostgreSQL data to NDJSON
echo Step 1: Exporting PostgreSQL data to NDJSON...
python manage.py export_to_ndjson --overwrite --verbose

if errorlevel 1 (
    echo.
    echo ERROR: Failed to export data from PostgreSQL
    pause
    exit /b 1
)

echo.
echo ============================================================
echo.

REM Step 2: Import NDJSON data to Elasticsearch
echo Step 2: Importing NDJSON data to Elasticsearch...
python experiments\es\import_to_elasticsearch.py --data-dir specs\ndjson

if errorlevel 1 (
    echo.
    echo ERROR: Failed to import data to Elasticsearch
    pause
    exit /b 1
)

echo.
echo ============================================================
echo Sync Complete!
echo ============================================================
echo.
echo PostgreSQL data has been synced to Elasticsearch
pause
