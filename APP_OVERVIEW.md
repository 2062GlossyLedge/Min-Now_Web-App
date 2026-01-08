# MinNow Application Overview

**Version:** 1.0  
**Last Updated:** January 2026  
**Status:** Production  
**Stack:** Next.js 16 (Frontend) + Django 5.2 (Backend)

---

## Mission & Philosophy

### Goal (What We're Building Toward)

Min-Now's goal is to help users become more intentional with their belongings by making ownership visible, trackable, and emotionally meaningful. The app aims to reduce clutter and regret by encouraging conscious acquisition, better care and usage of what's important, and timely letting-go—turning "stuff" into deliberate choices rather than passive accumulation.

### Product Objective (Why It Matters)

We want MinNow to shift user behavior from impulsive ownership to mindful stewardship. Success looks like users clearly understanding:
- What they own and why they own it
- How long they've owned each item
- How much value each possession is providing
- When it's time to sell, donate, or keep

### Execution Focus (How We're Getting There)

We're prioritizing:
- **Low-friction input and search:** Fast, easy data entry and search with voice and AI-assisted options
- **Clear ownership metrics:** Visible duration tracking and ownership goals
- **Emotional connection:** An app that feels reflective and motivating, not like inventory software, while balancing automation with intentional decision-making that nudge better decisions.

### Target Users

- Minimalism enthusiasts seeking to streamline possessions
- Environmentally conscious consumers reducing their footprint
- People seeking to reduce clutter and regain space
- Users interested in understanding their personal consumption patterns

---

## System Overview

**MinNow** is a personal asset management application that helps users track item ownership, make mindful decisions about consumption, and measure environmental impact through a gamified badge reward system.

### Value Proposition

**Core Promise:**
Transform passive accumulation into intentional ownership. Help users understand what they own, why they own it, and make deliberate decisions about keeping, caring for, or letting go of their possessions.

**User Benefits:**
- Reduce clutter and physical space consumed by unnecessary items
- Decrease buyer's remorse by intentional ownership
- Gain clear visibility into consumption patterns
- Experience motivation through reflection and achievement
- Make decisions about giving/donating with confidence

**Behavioral Shift:**
From: Impulsive purchasing → passive accumulation → guilt or hoarding  
To: Conscious acquisition → active stewardship → intentional letting-go

### Deployment Architecture

```
┌─────────────────────┐         ┌──────────────────────┐
│   Vercel (Frontend) │         │  Railway (Backend)   │
│   Next.js 16 + React│         │  Django 5.2 + Ninja  │
│   TypeScript + TW   │         │  PostgreSQL + Redis  │
└──────────┬──────────┘         └──────────┬───────────┘
           │                              │
           │      HTTPS/JSON              │
           └──────────────────────────────┘
                  /api/*
            
           ┌────────────────────────────────────────┐
           │   External Services                    │
           ├────────────────────────────────────────┤
           │ • Clerk: Authentication (JWT)          │
           │ • Uploadthing: File uploads (CDN)      │
           │ • Upstash Redis: Rate limiting         │
           │ • MailerSend: Transactional email      │
           └────────────────────────────────────────┘
```

---

## 1. Core Features

### Item Management
Users track personal possessions with full lifecycle management:

**Data Captured:**
- Item name and visual representation (emoji/image)
- Category classification (15 predefined types)
- Acquisition date and last usage date
- Current status: Keep, Give, or Donate
- Ownership duration goal (default 12 months)

**Operations:**
- Add items individually or in batch
- Filter by category, status, or duration
- Edit item properties
- Delete items
- Update status (e.g., Keep → Give)

**AI Enhancement:**
- Natural language item creation via LangGraph agent
- Batch processing of multiple item descriptions

### Checkup System
Periodic prompts encouraging item review:

**Mechanism:**
- Each user has two checkups: Keep checkup, Give checkup
- Checkup marked "due" when interval months have passed
- System sends optional email reminders
- User marks checkup complete, resetting timer

**Purpose:** Encourages regular reflection on ownership and consumption patterns

### Badge Reward System
Gamification tracking user impact:

**Keep Badges** (based on ownership duration per item):
- Bronze: Owned 1 year
- Silver: Owned 5 years
- Gold: Owned 10 years

**Give Badges** (based on quantity donated per item type):
- Bronze: Donated 1 item
- Silver: Donated 5 items
- Gold: Donated 10 items

**Display:** Type-specific grouping with progress visualization

### Onboarding & Tutorial
Multi-step guided tour explaining core features:
- Highlighted UI elements with spotlight overlays
- Sequential step progression
- Skippable and restartable
- Completion tracked per user

### User Settings
- Theme toggle (dark/light mode)
- Tutorial restart option
- Completion tracking

---

## 2. Data Model

### User Entity
- Unique identifier (integer)
- Linked to Clerk external ID for authentication
- Admin flag stored in Clerk metadata
- Email notification preference stored in Clerk metadata

### OwnedItem Entity
- UUID primary identifier
- Belongs to one user (cascade delete on user removal)
- Properties: name, category, status, dates, ownership goal
- Computed: duration owned, progress toward goal, badge achievements
- Max 10 items per user (admin exempt)

### Checkup Entity
- Unique per user per type (Keep, Give)
- Tracks last completion timestamp
- Configurable interval (months between reminders, default 1)
- Auto-generated on user creation

### Item Categories
15 predefined types: Clothing, Personal Care, Furniture, Decor, Subscriptions, Technology, Vehicles, Tools, Outdoor Gear, Fitness, Toys, Pet Supplies, Books, Miscellaneous, Other

### Item Status
Three-state model: Keep (active use), Give (transferred to person), Donate (transferred to organization)

---

## 3. Frontend Architecture

### Application Structure

**Pages & Views:**
- Home/Landing page
- Keep view (items user retains)
- Give view (items user transferred)
- Badge showcase (Keep badges, Give badges)
- Donated items/statistics view
- Settings page

**Key Components:**
- Navigation header with routing
- ItemCard: Individual item display with actions
- AddItemForm: Multi-tab form (manual entry, quick batch)
- FilterBar: Category, status, sort controls
- CheckupManager: Modal for item review sessions
- OnboardingManager: Tutorial presentation
- DatePickerComponent: Flexible date input

**State Management:**
- ItemUpdateContext: Signals item list invalidation
- CheckupContext: Manages checkup modal state
- OnboardingContext: Tracks tutorial progression
- ThemeContext: Dark/light mode preference

### Authentication Flow
1. User visits app
2. Redirected to Clerk sign-in if not authenticated
3. Clerk returns session token
4. Frontend obtains JWT from Clerk SDK
5. All API requests include JWT in Authorization header
6. Backend validates JWT signature

### File Upload System
- User can upload images for items via Uploadthing
- Files served from CDN
- Alternative: Use emoji representation

### Rate Limiting
- Regular users: 20 file uploads per 24 hours
- Admin users: Unlimited uploads
- Admin status checked from Clerk metadata
- Sliding window algorithm via Upstash Redis

---

## 4. Backend Architecture

### API Gateway
- Django Ninja REST framework
- HTTPS only (production)
- JSON request/response format
- Bearer token authentication (JWT)

### Core Services
- **ItemService:** Item CRUD, ownership limit validation, batch operations
- **CheckupService:** Checkup scheduling, completion tracking, email sending

### Data Layer
- PostgreSQL database (production)
- Django ORM with model-based queries
- Migrations for schema versioning
- Indexes on foreign keys and filter columns

### Background Tasks
- Django management commands for scheduled execution
- Deployed on Railway platform (not distributed job queue)
- Primary task: Daily email notifications for due checkups

**Email Notification Workflow:**
1. Task runs daily (scheduled via platform)
2. Queries all users with email notifications enabled
3. Checks if Keep or Give checkup is due
4. Sends personalized email via MailerSend
5. Updates last_checkup_date on completion
6. Retries on delivery failure

### AI Integration
- LangGraph agent for natural language item parsing
- Extracts item name, category, and metadata from user input
- Supports single and batch item creation

---

## 5. API Endpoints

### Item Management
- `GET /api/items` - List user's items (optional filters: status, type)
- `POST /api/items` - Create new item
- `GET /api/items/{id}` - Retrieve item details
- `PUT /api/items/{id}` - Update item properties
- `DELETE /api/items/{id}` - Delete item

### Checkup Management
- `GET /api/checkups` - List user's checkups
- `GET /api/checkups/{id}` - Retrieve checkup
- `POST /api/checkups/{id}/complete` - Mark checkup completed
- `PUT /api/checkups/{id}` - Update checkup interval

### User Statistics
- `GET /api/user/item-stats` - Current count, limit, remaining slots
- `GET /api/user/donated-badges` - Badge progress per item type

### Notifications & Agent
- `POST /api/send-test-checkup-email` - Send test email
- `POST /api/agent/add-item` - Create item from natural language
- `POST /api/agent/add-item-batch` - Batch create from multiple prompts

### Upload Management
- `GET /api/upload-limits` - Check remaining uploads
- `DELETE /api/uploadthing/delete` - Remove uploaded file

---

## 6. Authentication & Authorization

### Clerk Identity Provider
- OAuth/SAML sign-in
- JWT token issuance
- User metadata storage (public and private)
- Automatic session refresh

### Role-Based Access Control
- **Regular User:** 10 item limit, 20 uploads/day
- **Admin User:** Unlimited items, unlimited uploads, test features
- Role determined by Clerk `is-admin` metadata

### Authorization Model
- User can only view/modify own items
- Checkups scoped to authenticated user
- Admin status checked per-request at backend
- Item limit enforced on creation (bypass for admins)

---

## 7. External Dependencies

### Clerk
- Identity provider for sign-in/sign-up
- JWT token validation
- User metadata retrieval
- Session management

### Uploadthing
- Serverless file upload service
- CDN-backed image delivery
- File type and size validation
- Automatic image optimization

### Upstash Redis
- Distributed rate limiting (sliding window)
- Stores upload quota state per user
- 24-hour rolling window for quota reset

### MailerSend
- Transactional email delivery
- Type-specific templates (Keep, Give checkups)
- Personalization with user name and metrics
- Retry logic on delivery failure

---

## 8. Business Processes

### User Onboarding
1. User signs up via Clerk
2. System creates user in Django with default checkups
3. Frontend displays onboarding tutorial
4. User learns features via spotlight highlights

### Item Addition Workflow
1. User clicks "Add Item" button
2. Chooses manual (single) or quick (batch) mode
3. Enters item details (name, category, date, optional image)
4. System validates item limit
5. Item created with status "Keep"
6. UI refreshes to show new item
7. Optional: User earns notification of adding item

### Item Disposition Workflow
1. User reviews item in Keep view
2. Clicks "Give" button on item card
3. Item status updated to "Give"
4. Item moves to Give view
5. Badge progress recalculated
6. User sees updated badge metrics

### Checkup & Email Workflow
1. Backend scheduled task runs (daily)
2. Queries users with email notifications enabled
3. For each user, checks if Keep/Give checkup due
4. Sends personalized email if checkup due
5. User clicks email link to app
6. ReviewsCheckupManager modal appears
7. User marks checkup complete or skips
8. Checkup timestamp updated

---

## 9. Deployment

### Frontend (Vercel)
- Automatic deployment on git push
- Serverless Next.js functions
- Global CDN for static assets
- Environment variables managed via Vercel console
- Preview deployments for pull requests

### Backend (Railway)
- Containerized Django application
- PostgreSQL managed database with SSL
- Upstash Redis connection for rate limiting
- Task scheduling via platform scheduler
- Automatic restart on deployment
- HTTPS enforced via Caddy proxy

### Environment Configuration
**Production:**
- `PROD=True`, `DEBUG=False`
- PostgreSQL with SSL connection
- All external service credentials
- Allowed hosts: min-now.store, www.min-now.store

**Development:**
- `PROD=False`, `DEBUG=True`
- SQLite database option
- Test credentials for external services
- Debug API documentation endpoints

---

## 10. Current System State

### Item Limits
- Non-admin users: Maximum 10 items
- Admin users: Unlimited items
- Enforced at item creation time

### Checkup Frequency
- Default interval: 1 month between reminders
- User can customize per checkup type
- Email sent only if user opted in

### Upload Quota
- Regular users: 20 uploads per 24 hours (rolling window)
- Admin users: Unlimited
- Consumed per file upload attempt

### Badge Achievements
- Calculated per item type
- Keep badges: Time-based (12, 60, 120 months)
- Give badges: Quantity-based (1, 5, 10 items)
- Progress shown as decimal (0.0-1.0)

### Supported Item Types
Clothing & Accessories, Personal Care Items, Furniture & Appliances, Decor & Art, Subscriptions & Licenses, Technology, Vehicles, Tools & Equipment, Outdoor Gear, Fitness Equipment, Toys & Games, Pet Supplies, Books & Media, Miscellaneous, Other

---

## 11. Key Constraints

**Business:**
- Item limit: 10 per user (configurable)
- Checkup interval minimum: 1 month
- No hard delete for items (historical tracking)

**Technical:**
- Users authenticate once (session in frontend)
- Backend stateless (horizontal scalability)
- Item names unstructured (no validation)
- Email delivery best-effort

**Scale Assumptions:**
- < 10,000 active users
- < 100,000 total items
- < 1,000 requests/second peak
- < 500ms response time (p95)

---

## 12. Security Model

### Authentication
- JWT bearer tokens from Clerk
- Asymmetric signature validation
- No password storage (delegated to Clerk)

### Authorization
- User isolation (queries scoped to principal)
- Role-based access (admin via Clerk metadata)
- Item limit enforcement
- Resource ownership validation

### Data Protection
- SQL parameterization (Django ORM)
- CORS configured for frontend domain
- CSRF protection on modifying endpoints
- Rate limiting prevents abuse
- SSL/TLS encryption in transit

---

**End of MinNow Application Overview**
