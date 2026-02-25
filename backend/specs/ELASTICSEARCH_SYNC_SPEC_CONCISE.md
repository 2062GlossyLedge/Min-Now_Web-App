# Elasticsearch Sync Specification (Concise)

**Last Updated:** February 2026 | **Location:** `backend/specs/ndjson/`, `backend/specs/es/`

## Quick Start

### Option 1: Windows Batch Script (Recommended)
```cmd
cd backend\scripts
sync_to_elasticsearch.bat
```

### Option 2: Manual Commands
```bash
# Export PostgreSQL to NDJSON
cd backend && python manage.py export_to_ndjson --overwrite --verbose

# Import NDJSON to Elasticsearch
python experiments/es/import_to_elasticsearch.py --data-dir specs/ndjson
```

**Batch script automatically:**
1. Exports PostgreSQL → NDJSON
2. Imports NDJSON → Elasticsearch
3. Displays status and errors
4. Executes enrichment policy (locations_policy) after location sync

## Overview

Mirrors PostgreSQL data to Elasticsearch indices via NDJSON intermediate format for fast full-text search.

**Key components:** export_to_ndjson (Django) → NDJSON files → import_to_elasticsearch (Python) → Elasticsearch indices

## Data Models

| Model | Key Fields |
|-------|-----------|
| User | id, clerk_id, username, email, first_name, last_name, is_active, date_joined |
| OwnedItem | id, user_id, name, item_type, status, current_location_id, dates, ownership_duration_goal_months |
| Location | id, user_id, slug, display_name, full_path, parent_id, level, dates |

## NDJSON Format

```ndjson
{"index":{"_index":"users","_id":"doc-id"}}
{"id":"doc-id","field1":"value1",...}
```

Files: `users.ndjson`, `items.ndjson`, `locations.ndjson`, `all_data.ndjson`

## Commands

### Export

```bash
python manage.py export_to_ndjson [--output-dir DIR] [--overwrite] [--verbose]
```

| Flag | Description |
|------|-------------|
| `--output-dir` | Output directory (default: `backend/specs/ndjson/`) |
| `--overwrite` | Overwrite existing files |
| `--verbose` | Print detailed progress |

### Import

```bash
python experiments/es/import_to_elasticsearch.py [--data-dir DIR]
```

Deletes existing indices and recreates with NDJSON data.

## Elasticsearch Indices

- **users:** id (keyword), clerk_id, username (text), email, first_name, last_name, is_active, date_joined
- **items:** id, user_id, name (text), item_type, status, current_location_id, dates, ownership_duration_goal_months  
- **locations:** id, user_id, slug, display_name (text), full_path (text), parent_id, level, dates

## Performance

| Operation | Volume | Time |
|-----------|--------|------|
| Export | 1M records | 30-60s |
| Import | 1M records | 3-5 min |

## Error Handling

| Error | Solution |
|-------|----------|
| Connection Refused | Check: `curl http://localhost:9200` |
| Index Already Exists | Delete manually: `curl -X DELETE http://localhost:9200/users` |
| JSON Parse Error | Re-export with `--verbose` flag |
| Out of Memory | Implement batching/pagination |

## Health Checks

```bash
curl http://localhost:9200/_cluster/health
curl http://localhost:9200/users/_count
curl http://localhost:9200/users/_mapping
```

## References

- Export: `backend/items/management/commands/export_to_ndjson.py`
- Import: `backend/experiments/es/import_to_elasticsearch.py`
- Serialization: `backend/items/elasticsearch_sync.py`
- Mappings: `backend/specs/es/elasticsearch_mappings.json`
- Tests: `backend/tests/export_ndjson_test.py`
