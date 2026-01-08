# MinNow Backend Product Specification

**Last Updated:** January 2026  
**Platform:** Django 5.2 + Django Ninja API  
**Database:** PostgreSQL (Production on Railway)  
**Task Queue:** Celery (optional) + Django Management Commands  
**Rate Limiting:** Upstash Redis  
**Email Service:** MailerSend  
**Authentication:** Clerk (JWT-based)

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Core Data Models](#core-data-models)
3. [API Endpoints](#api-endpoints)
4. [Authentication & Security](#authentication--security)
5. [Background Jobs & Scheduled Tasks](#background-jobs--scheduled-tasks)
6. [Services & Business Logic](#services--business-logic)
7. [Database Schema](#database-schema)
8. [Deployment & Configuration](#deployment--configuration)
9. [Development Notes](#development-notes)

---

## System Architecture

### Overview

MinNow Backend is a Django-based REST API that manages user item ownership tracking, donation/giving tracking, and periodic checkup reminders. The system follows a modular architecture with:

- **API Layer:** Django Ninja (lightweight REST framework)
- **Business Logic:** Service classes (ItemService, CheckupService)
- **Data Layer:** Django ORM with PostgreSQL
- **Background Tasks:** Django management commands + Windows Task Scheduler (primary), optional Celery
- **External Services:** Clerk (auth), MailerSend (email)

### Key Components

```
minNow/                    # Django project settings
├── settings.py          # Environment-aware configuration
├── urls.py             # URL routing (API & admin endpoints)
├── auth.py             # Clerk JWT authentication
├── asgi.py & wsgi.py   # WSGI/ASGI servers
└── __init__.py

items/                     # Main application (models, APIs, services)
├── models.py           # OwnedItem, Checkup, ItemType, ItemStatus
├── api.py              # Django Ninja API endpoints
├── services.py         # ItemService, CheckupService
├── background/         # Scheduled task definitions
│   └── tasks.py        # Celery tasks (optional)
├── management/         # Django management commands
│   └── commands/
│       ├── run_addition_task.py          # Demo task
│       ├── run_email_notifications.py    # Checkup email sender
│       └── backfill_checkups.py          # Initialize checkups for users
└── migrations/         # Database migrations

users/                     # User model (extends Django AbstractUser)
├── models.py           # Custom User model with Clerk integration
└── management/
    └── commands/
        └── backfill_clerk_emails.py    # Sync Clerk emails to DB
```

### Environment Configuration

The backend supports **two deployment modes**:

- **Development (local):** SQLite or local PostgreSQL, debug logging, development auth bypass
- **Production (Railway):** PostgreSQL with SSL, hardened security, production Clerk auth

Configuration via environment variables:
- `PROD` (True/False) - Enable production mode
- `DEBUG` (True/False) - Enable Django debug mode
- Database credentials: `PGHOST`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `PGPORT`
- Clerk secrets: `CLERK_SECRET_KEY`
- Email: `MAILERSEND_API_KEY`
- Redis: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

---

## Core Data Models

### 1. **User Model** (`users/models.py`)

Extends Django's `AbstractUser` with Clerk integration:

```python
class User(AbstractUser):
    clerk_id: CharField (unique)  # Maps to Clerk user ID
    # Inherits: username, email, first_name, last_name, etc.
```

**Key Functions:**
- `is_user_admin(user)` - Check Clerk public metadata for admin status
- `has_email_notifications_enabled(user)` - Check Clerk unsafe metadata for email notification preference

---

### 2. **OwnedItem Model** (`items/models.py`)

Represents a physical item owned by a user:

```python
class OwnedItem(models.Model):
    id: UUIDField (primary key)
    user: ForeignKey(User)  # Owner
    name: CharField(255)    # Item name/description
    picture_url: CharField(255)  # Emoji or image URL
    item_type: CharField    # Category (see ItemType choices)
    status: CharField       # Keep, Give, or Donate (see ItemStatus choices)
    item_received_date: DateTimeField  # When user received the item
    last_used: DateTimeField           # Last time user interacted with item
    ownership_duration_goal_months: IntegerField (default=12)
```

**Constraints:**
- Max 10 items per user (enforced on save, bypassed for admins)
- Unique constraint on user + item for checkups

**Computed Properties:**

- `ownership_duration` → TimeSpan (years, months, days owned)
- `last_used_duration` → TimeSpan (time since last used)
- `ownership_duration_goal_progress` → Float (0.0-1.0, percentage towards goal)
- `keep_badge_progress` → List[BadgeProgress] (achievements based on duration owned)

**Lifecycle:**
- When created, validates item limit (raises ValidationError if exceeded)
- Deletion cascades from User
- No hard delete for historical tracking (items can be marked as Donate/Give instead)

---

### 3. **ItemType Enum** (`items/models.py`)

Categories for classifying items:

```python
Clothing_Accessories, Personal_Care_Items, Furniture_Appliances, Decor_Art,
Subscriptions_Licenses, Technology, Vehicles, Tools_Equipment, Outdoor_Gear,
Fitness_Equipment, Toys_Games, Pet_Supplies, Books_Media, Miscellaneous, Other
```

---

### 4. **ItemStatus Enum** (`items/models.py`)

Item disposition tracking:

```python
Keep    # User still owns and uses
Give    # User gave to someone else
Donate  # User donated to charity/organization
```

---

### 5. **Checkup Model** (`items/models.py`)

Reminder system for reviewing items:

```python
class Checkup(models.Model):
    user: ForeignKey(User)
    checkup_type: CharField  # 'keep' or 'give'
    last_checkup_date: DateTimeField
    checkup_interval_months: IntegerField (default=1)
    
    class Meta:
        unique_together = ('user', 'checkup_type')
```

**Purpose:** Prompts users to review items at intervals and update status/metadata

**Key Methods:**
- `is_checkup_due()` → Boolean (calculates if enough months have passed)
- `complete_checkup()` → Updates last_checkup_date to now
- `change_checkup_interval(months)` → Adjusts reminder frequency

**Auto-Creation:** Two default checkups created when User is registered:
- `Keep checkup` (interval: 1 month)
- `Give checkup` (interval: 1 month)

---

### 6. **TimeSpan Class** (`items/models.py`)

Helper class for duration calculations:

```python
class TimeSpan:
    years: int
    months: int
    days: int
    
    @property
    def description: str  # e.g., "2y 3m"
    
    @classmethod
    def from_dates(start, end) → TimeSpan  # Calculate from date range
```

---

### 7. **Badge Tiers** (`items/models.py`)

Achievement system constants:

**Keep Badges (based on ownership duration):**
- Bronze: 1 year (12 months)
- Silver: 5 years (60 months)
- Gold: 10 years (120 months)

**Donated Badges (based on quantity donated):**
- Bronze: 1 item donated
- Silver: 5 items donated
- Gold: 10 items donated

Badges are **item-type specific** (e.g., "Gold Clothing Keeper", "Silver Furniture Giver")

---

## API Endpoints

### Base URL
- **Development:** `http://localhost:8000/api/`
- **Production:** `https://min-now.store/api/` or Railway deployment URL

### Authentication

All endpoints require JWT Bearer token from Clerk:

```http
Authorization: Bearer <clerk_jwt_token>
```

Rate limiting: 100 requests per 60 seconds per user (via Upstash Redis)

---

### Item Management Endpoints

#### **List Items**

```http
GET /api/items?status={Keep|Give|Donate}&item_type={ItemType}
```

**Query Parameters:**
- `status` (optional): Filter by status
- `item_type` (optional): Filter by item type

**Response:** `200 OK`
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Wool Sweater",
    "picture_url": "🧶",
    "item_type": "Clothing_Accessories",
    "status": "Keep",
    "item_received_date": "2023-01-15T10:30:00Z",
    "last_used": "2024-12-20T15:45:00Z",
    "ownership_duration": {
      "years": 1,
      "months": 11,
      "days": 5,
      "description": "1y 11m"
    },
    "last_used_duration": {
      "years": 0,
      "months": 0,
      "days": 19,
      "description": "0y 0m"
    },
    "keep_badge_progress": [
      {
        "tier": "bronze",
        "name": "Bronze Clothing Keeper",
        "description": "Owned an item for 1 year",
        "min": 12,
        "unit": "months",
        "progress": 0.99,
        "achieved": true
      },
      {
        "tier": "silver",
        "name": "Silver Clothing Keeper",
        "description": "Owned an item for 5 years",
        "min": 60,
        "unit": "months",
        "progress": 0.2,
        "achieved": false
      }
    ],
    "ownership_duration_goal_months": 12,
    "ownership_duration_goal_progress": 0.99
  }
]
```

---

#### **Create Item**

```http
POST /api/items
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Gaming Laptop",
  "picture_url": "💻",
  "item_type": "Technology",
  "status": "Keep",
  "item_received_date": "2024-06-01T00:00:00Z",
  "last_used": "2025-01-08T14:20:00Z",
  "ownership_duration_goal_months": 24
}
```

**Response:** `201 Created`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "name": "Gaming Laptop",
  ...
}
```

**Errors:**
- `400 Bad Request` - Missing fields, invalid item type, item limit exceeded
- `429 Too Many Requests` - Rate limit exceeded

---

#### **Get Item Details**

```http
GET /api/items/{item_id}
```

**Response:** `200 OK` (item object)  
**Response:** `404 Not Found`

---

#### **Update Item**

```http
PUT /api/items/{item_id}
Content-Type: application/json
```

**Request Body (all fields optional):**
```json
{
  "name": "Updated Name",
  "status": "Donate",
  "last_used": "2025-01-08T16:00:00Z",
  "ownership_duration_goal_months": 36
}
```

**Response:** `200 OK` (updated item object)

---

#### **Delete Item**

```http
DELETE /api/items/{item_id}
```

**Response:** `204 No Content`  
**Response:** `404 Not Found`

---

### Checkup Endpoints

#### **List User Checkups**

```http
GET /api/checkups
```

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "last_checkup_date": "2024-12-08T10:00:00Z",
    "checkup_interval_months": 1,
    "is_checkup_due": true,
    "checkup_type": "keep"
  },
  {
    "id": 2,
    "last_checkup_date": "2024-12-15T14:30:00Z",
    "checkup_interval_months": 1,
    "is_checkup_due": false,
    "checkup_type": "give"
  }
]
```

---

#### **Get Checkup**

```http
GET /api/checkups/{checkup_id}
```

**Response:** `200 OK` (checkup object)

---

#### **Complete Checkup**

```http
POST /api/checkups/{checkup_id}/complete
```

Updates `last_checkup_date` to now, marking checkup as completed.

**Response:** `200 OK`
```json
{
  "id": 1,
  "last_checkup_date": "2025-01-08T16:00:00Z",
  "checkup_interval_months": 1,
  "is_checkup_due": false,
  "checkup_type": "keep"
}
```

---

#### **Update Checkup Interval**

```http
PUT /api/checkups/{checkup_id}
Content-Type: application/json
```

**Request Body:**
```json
{
  "interval_months": 3
}
```

**Response:** `200 OK`

---

### User Statistics & Badges

#### **Get User Item Statistics**

```http
GET /api/user/item-stats
```

**Response:** `200 OK`
```json
{
  "current_count": 7,
  "max_items": 10,
  "remaining_slots": 3,
  "can_add_items": true
}
```

**Note:** Admin users always see `"remaining_slots": 999` and `"can_add_items": true`

---

#### **Get Donated Badges**

```http
GET /api/user/donated-badges
```

Returns achievement badges for donated/given items grouped by item type.

**Response:** `200 OK`
```json
{
  "Clothing_Accessories": [
    {
      "tier": "bronze",
      "name": "Bronze Clothing Giver",
      "description": "Gave 1 item",
      "min": 1,
      "progress": 1.0,
      "achieved": true
    },
    {
      "tier": "silver",
      "name": "Silver Clothing Giver",
      "description": "Gave 5 items",
      "min": 5,
      "progress": 0.4,
      "achieved": false
    }
  ],
  "Technology": [
    {
      "tier": "bronze",
      "name": "Bronze Technology Giver",
      "description": "Gave 1 item",
      "min": 1,
      "progress": 1.0,
      "achieved": true
    }
  ]
}
```

---

### AI Agent Endpoints

#### **Add Item via AI Agent**

```http
POST /api/agent/add-item
Content-Type: application/json
```

Uses LangGraph AI agent to parse natural language and create items.

**Request Body:**
```json
{
  "prompt": "I bought a new white t-shirt yesterday that I plan to keep for at least 2 years"
}
```

**Response:** `200 OK`
```json
{
  "status": "success",
  "item": {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "name": "White T-Shirt",
    "picture_url": "👕",
    "item_type": "Clothing_Accessories",
    "status": "Keep",
    "ownership_duration_goal_months": 24,
    ...
  }
}
```

---

#### **Batch Add Items via AI Agent**

```http
POST /api/agent/add-item-batch
Content-Type: application/json
```

Process multiple prompts in a single request.

**Request Body:**
```json
{
  "prompts": {
    "item1": "Red running shoes I got for my marathon training",
    "item2": "Donate my old desk chair to the office",
    "item3": "Gave my Nintendo Switch to my brother"
  }
}
```

**Response:** `200 OK`
```json
{
  "status": "success",
  "results": {
    "item1": { "status": "success", "item": {...} },
    "item2": { "status": "success", "item": {...} },
    "item3": { "status": "success", "item": {...} }
  }
}
```

---

### Email & Notification Endpoints

#### **Send Test Checkup Email**

```http
POST /api/send-test-checkup-email
Content-Type: application/json
```

**Request Body:**
```json
{
  "checkup_type": "keep"
}
```

**Response:** `200 OK`
```json
{
  "checkup_type": "keep",
  "status": "sent",
  "recipient_email": "user@example.com",
  "recipient_username": "john_doe"
}
```

---

### User Preferences

#### **Sync User Preferences**

```http
POST /api/user/sync-preferences
Content-Type: application/json
```

Synchronizes user preferences from Clerk (email notifications, admin status, etc.).

**Response:** `200 OK`
```json
{
  "status": "success",
  "preferences_updated": true
}
```

---

### Development-Only Endpoints

#### **Clerk JWT Login (Dev Only)**

```http
POST /api/dev/auth/clerk-login
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:** `200 OK`
```json
{
  "jwt_token": "eyJhbGc...",
  "user_id": "user_123",
  "email": "user@example.com",
  "message": "Use this JWT token in Swagger Authorize button"
}
```

**Note:** Only available when `DEBUG=True`

---

#### **API Documentation**

- **Swagger UI:** `/api/docs` (dev only)
- **OpenAPI Schema:** `/api/openapi.json` (dev only)

---

## Authentication & Security

### Clerk Integration

**How it works:**
1. Frontend obtains JWT token from Clerk after user login
2. Frontend includes token in `Authorization: Bearer <token>` header
3. Backend validates token signature using Clerk's public JWKS
4. Backend extracts user ID and creates/updates Django User record

**Clerk Configuration:**
- Public JWKS endpoint used for token validation
- Secret key stored in `CLERK_SECRET_KEY` environment variable
- User metadata stored in Clerk (not Django):
  - `public_metadata.is-admin` - Admin status
  - `unsafe_metadata.emailNotifications` - Email notification preference

### JWT Authentication Decorator

```python
@jwt_required  # From minNow.auth
def my_endpoint(request):
    user_id = request.user.clerk_id
    # ...
```

Validates JWT, checks rate limits, returns 401/429 if failed.

### Rate Limiting

- **Service:** Upstash Redis
- **Strategy:** FixedWindow (100 requests per 60 seconds per user)
- **Fallback:** IP-based limiting if no user ID available
- **Graceful Degradation:** If Upstash unavailable, rate limiting disabled with warning

---

## Background Jobs & Scheduled Tasks

### Migration from Celery to Management Commands

**Status:** Periodic tasks **migrated from Celery to Django management commands + Windows Task Scheduler**

- Celery is now optional and used for manual task execution only
- All production periodic tasks run via scheduled management commands
- Windows Task Scheduler triggers commands on Railway deployment

---

### Management Commands

#### **1. run_email_notifications**

Sends checkup reminder emails to users with email notifications enabled.

```bash
python manage.py run_email_notifications --verbose --log-file logs/email.log
```

**What it does:**
1. Fetches all users from database
2. Checks Clerk metadata for `emailNotifications` preference
3. For each user, fetches their "keep" and "give" checkups
4. Sends email if checkup is due
5. Updates `last_checkup_date` after email sent

**Email Template:** Customized per checkup type (keep/give)  
**Email Service:** MailerSend API  
**Frequency (Production):** Daily (via Task Scheduler)

---

#### **2. run_addition_task**

Demo/utility task that adds two numbers (placeholder for future periodic tasks).

```bash
python manage.py run_addition_task --x 16 --y 16 --verbose
```

---

#### **3. backfill_checkups**

Initializes checkups for users who don't have them (data recovery).

```bash
python manage.py backfill_checkups --verbose
```

**Actions:**
- Creates default "keep" and "give" checkups for each user
- Skips if checkup already exists

---

#### **4. backfill_clerk_emails** (users app)

Synchronizes email addresses from Clerk to Django User model.

```bash
python manage.py backfill_clerk_emails --verbose
```

---

### Celery Configuration (Optional)

Located in `items/background/tasks.py`

**Broker & Backend:** Upstash Redis (production) or local Redis (dev)  
**Worker Pool:** Solo (Windows compatibility)  
**Serializer:** JSON

**How to use (if needed):**
```bash
# Start Celery worker
celery -A items.background.tasks worker --loglevel=info

# Or on Windows with special configuration
python -m items.background.tasks
```

**Note:** Celery is not required for current functionality; management commands are preferred.

---

## Services & Business Logic

### ItemService

Handles item CRUD operations and validation.

**Methods:**

```python
ItemService.create_item(user, **kwargs) → OwnedItem
# Creates item with limit validation

ItemService.get_item(item_id) → OwnedItem | None

ItemService.update_item(item_id, **kwargs) → OwnedItem | None

ItemService.delete_item(item_id) → bool

ItemService.get_items_by_status(status) → QuerySet[OwnedItem]

ItemService.get_items_by_type(item_type) → QuerySet[OwnedItem]

ItemService.get_items_for_user(user, status=None, item_type=None) → QuerySet[OwnedItem]

ItemService.get_user_item_stats(user) → Dict[str, Any]
# Returns: current_count, max_items, remaining_slots, can_add_items
```

**Item Limit Enforcement:**
- Max 10 items per user (non-admin)
- Admins can add unlimited items
- Validation happens on creation (model.save() override)

---

### CheckupService

Manages checkup scheduling and notifications.

**Methods:**

```python
CheckupService.create_checkup(user, interval_months=1, checkup_type="keep") → Checkup

CheckupService.get_checkup_by_type(user, checkup_type) → Checkup | None

CheckupService.complete_checkup(checkup_id) → bool

CheckupService.change_checkup_interval(checkup_id, months) → bool

CheckupService.send_checkup_email(user, checkup_type) → Dict
# Sends email via MailerSend; updates last_checkup_date
```

---

### Email Service Integration

**Provider:** MailerSend  
**API Key:** `MAILERSEND_API_KEY` environment variable

**Email Templates:**
- Keep Checkup: Reminds user to review items they're keeping
- Give Checkup: Reminds user to review items they gave away

**Personalization:**
- User's first name, username
- Count of items in relevant category
- Direct link to web app

---

## Database Schema

### Tables

**minnow_user**
```sql
id INTEGER PRIMARY KEY
username VARCHAR(150) UNIQUE NOT NULL
email VARCHAR(254)
first_name VARCHAR(150)
last_name VARCHAR(150)
clerk_id VARCHAR(255) UNIQUE
password_hash VARCHAR
is_active BOOLEAN DEFAULT TRUE
is_staff BOOLEAN DEFAULT FALSE
is_superuser BOOLEAN DEFAULT FALSE
date_joined TIMESTAMP
last_login TIMESTAMP
groups_id (M2M)
user_permissions_id (M2M)
```

**items_owneditem**
```sql
id UUID PRIMARY KEY
user_id INTEGER (FK to minnow_user)
name VARCHAR(255) NOT NULL
picture_url VARCHAR(255)
item_type VARCHAR(30) NOT NULL  -- Enum choice
status VARCHAR(10) NOT NULL     -- Enum choice (Keep, Give, Donate)
item_received_date TIMESTAMP NOT NULL
last_used TIMESTAMP NOT NULL
ownership_duration_goal_months INTEGER DEFAULT 12
created_at TIMESTAMP (implicit from Django)
updated_at TIMESTAMP (implicit from Django)

UNIQUE(user_id, id)  -- No natural unique constraint, but user can't have duplicate item IDs
```

**items_checkup**
```sql
id INTEGER PRIMARY KEY
user_id INTEGER (FK to minnow_user) NOT NULL
checkup_type VARCHAR(10) NOT NULL  -- 'keep' or 'give'
last_checkup_date TIMESTAMP NOT NULL
checkup_interval_months INTEGER DEFAULT 1

UNIQUE(user_id, checkup_type)  -- One checkup per user per type
```

### Indexes

Recommended (check Django migrations):
- `items_owneditem.user_id`
- `items_owneditem.status`
- `items_owneditem.item_type`
- `items_checkup.user_id`
- `items_checkup.checkup_type`

---

## Deployment & Configuration

### Production Environment (Railway)

**Deployment Platform:** Railway  
**Web Server:** Gunicorn (23.0.0)  
**Database:** PostgreSQL with SSL

**Configuration:**
```bash
PROD=True
DEBUG=False
ALLOWED_HOSTS=min-now.store,www.min-now.store,magnificent-optimism-production.up.railway.app
DATABASE_URL=postgresql://...@railway.internal:5432/...
CLERK_SECRET_KEY=sk_live_...
MAILERSEND_API_KEY=...
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

**Static Files:** Collected via `python manage.py collectstatic` (stored in `staticfiles/`)

**CORS:** Configured for frontend domain  
**SSL:** Enforced via Railway + Caddy proxy (Caddyfile)

**Task Scheduling:** Windows Task Scheduler (on Railway virtual machine)
- `run_email_notifications` - Daily at 9 AM UTC
- Other tasks on-demand

---

### Development Environment (Local)

**Database:** SQLite (default) or local PostgreSQL  
**Static Files:** Auto-served by Django dev server

**Setup:**
```bash
python -m venv venv
source venv/Scripts/activate  # or .bin/activate on Linux
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

**Access:**
- API: `http://localhost:8000/api/`
- Swagger Docs: `http://localhost:8000/api/docs/`
- Admin: `http://localhost:8000/admin/`

---

## Development Notes

### Key Dependencies

**Core:**
- `django==5.2.1` - Web framework
- `django-ninja==1.4.1` - REST API (lightweight Starlette-like framework)
- `djangorestframework` - Alternative REST framework (not used currently)
- `psycopg2` - PostgreSQL adapter
- `gunicorn==23.0.0` - WSGI server

**Authentication & External Services:**
- `clerk-backend-api==2.2.0` - Clerk SDK
- `upstash-ratelimit` - Rate limiting
- `upstash-redis` - Redis client for rate limiting
- `mailersend==0.6.0` - Email service

**AI & Background Tasks:**
- `langchain==0.3.25` - AI framework
- `langchain-openai==0.3.23` - OpenAI integration
- `langgraph==0.4.8` - Graph-based workflows
- `celery==5.5.3` - Task queue (optional)
- `kombu==5.5.4` - Message broker
- `amqp==5.3.1` - AMQP library

**Utilities:**
- `python-dotenv` - Environment variable loading
- `httpx` - Async HTTP client
- `pydantic` - Data validation (via django-ninja)
- `django-cors-headers==4.7.0` - CORS support
- `django-anymail==13.0` - Email backend abstraction
- `django-permissions-policy==4.26.0` - Permissions policy headers

---

### Code Organization Best Practices

1. **Separation of Concerns:** Business logic in Services, APIs handle routing/validation
2. **DRY:** Reusable utilities in `utils/`, shared models in `models/`
3. **Error Handling:** Consistent exception handling with proper HTTP status codes
4. **Logging:** Structured logging via Python logging module
5. **Testing:** Unit tests in `tests/` directory per app

---

### Common Development Tasks

**Run tests:**
```bash
pytest backend/tests/ -v
```

**Create new migration:**
```bash
python manage.py makemigrations
python manage.py migrate
```

**Add new API endpoint:**
1. Define schema in `items/api.py` (Pydantic Schema)
2. Implement endpoint function decorated with `@router.get/post/put/delete`
3. Add authentication via `@jwt_required` decorator
4. Test with Swagger UI at `/api/docs/`

**Test scheduled task:**
```bash
python manage.py run_email_notifications --verbose
```

---

### Known Limitations & Future Improvements

**Current Limitations:**
- Item limit (10 per user) is hard-coded; could be configurable per user tier
- Email templates hardcoded; consider using template engine (Jinja2)
- AI agent limited to English prompts
- No pagination on list endpoints (fine for small datasets, problematic at scale)

**Future Enhancements:**
- [ ] Implement pagination for item/checkup lists
- [ ] Add item history/audit trail for data analysis
- [ ] Multi-language support for emails and item types
- [ ] Advanced search/filtering (date ranges, text search, etc.)
- [ ] Real-time notifications via WebSocket
- [ ] Mobile app API versioning strategy
- [ ] Backup/export user data functionality

---

## Appendix: API Error Codes

| Status | Meaning | Example |
|--------|---------|---------|
| 200 | Success | GET request returned data |
| 201 | Created | Item successfully created |
| 204 | No Content | Deletion successful |
| 400 | Bad Request | Missing/invalid field |
| 401 | Unauthorized | Invalid/expired JWT token |
| 404 | Not Found | Item ID doesn't exist |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Unexpected exception |

---

## Appendix: Environment Checklist

**Before deploying to production, ensure:**
- [ ] `PROD=True` and `DEBUG=False`
- [ ] All Clerk secrets configured
- [ ] PostgreSQL database credentials correct
- [ ] MailerSend API key set
- [ ] Upstash Redis credentials configured
- [ ] ALLOWED_HOSTS includes production domain(s)
- [ ] SSL certificates valid
- [ ] Database migrations applied
- [ ] Static files collected
- [ ] Task Scheduler jobs configured on hosting platform
- [ ] Email templates tested
- [ ] Rate limiting verified

---

**End of Backend Product Specification**
