# Min-Now Frontend Product Specification

**Last Updated:** January 8, 2026  
**Framework:** Next.js 16.0.7 with React 19.2.1 and TypeScript  
**Styling:** Tailwind CSS with Radix UI Components  
**Authentication:** Clerk (JWT-based)  
**State Management:** React Context API

---

## Table of Contents

1. [Product Overview](#product-overview)
2. [Core Features](#core-features)
3. [Architecture](#architecture)
4. [Key Components](#key-components)
5. [Data Models](#data-models)
6. [Authentication & Authorization](#authentication--authorization)
7. [API Integration](#api-integration)
8. [User Experience Flows](#user-experience-flows)
9. [Technical Stack](#technical-stack)
10. [File Upload & Rate Limiting](#file-upload--rate-limiting)

---

## Product Overview

**Min-Now** is a personal asset management web application designed to help users track their belongings, make conscious decisions about ownership, and measure their environmental and personal impact through a badge reward system.

### Core Value Proposition

- **Track Ownership:** Keep a comprehensive record of items you own
- **Make Mindful Decisions:** Receive suggestions on items to keep or donate based on usage patterns
- **Measure Impact:** Earn badges for responsible ownership practices (longer retention of frequently used items, regular donations)
- **Smart Organization:** Categorize and organize items with intelligent filtering and search capabilities

### Target Users

- Minimalism enthusiasts
- Environmentally conscious consumers
- People seeking to reduce clutter
- Users interested in tracking personal consumption patterns

---

## Core Features

### 1. **Item Management System**

Users can add, view, edit, and delete items with the following capabilities:

#### Add Items
- **Manual Add:** Detailed form with item name, category, emoji or image upload, received date
- **Quick Add:** Batch add multiple items with flexible date entry (month/year, year only, or year range)
- **Ownership Duration Goal:** Set target ownership lengths for items (e.g., "keep this item for 2 years")
- **Image Support:** Upload images or use emoji representations
- **Date Tracking:** Multiple date entry modes:
  - Full date (day, month, year)
  - Month and year only
  - Year only
  - Year range (for items with uncertain acquisition dates)

#### Item Properties
- **Item ID:** Unique identifier
- **Name:** User-specified item name
- **Picture:** URL to uploaded image or emoji representation
- **Category:** Predefined item types (Clothing & Accessories, Electronics, Furniture, etc.)
- **Status:** Reflects current state (Keep, Give, or Donated)
- **Received Date:** When the item was acquired
- **Last Used Date:** When the item was last used
- **Ownership Duration:** Calculated time owned (years, months, days)
- **Ownership Duration Goal:** Target duration for item retention

### 2. **Item Organization & Filtering**

#### Status-Based Views
- **Keep View:** Items the user intends to keep
- **Give View:** Items the user has decided to give away
- **Badges Views:** Visual representations of impact (Keep badges, Give badges)

#### Filtering & Search
- Filter items by type/category
- Sort items by various criteria
- Search functionality for quick item discovery

### 3. **Checkup System**

Periodic prompts that encourage users to review their items:

- **Checkup Status Tracking:** System monitors when users should be prompted to review items
- **Checkup Manager Component:** Triggered modal/dialog for item review sessions
- **Smart Prompts:** Suggestions based on item usage patterns and ownership duration
- **Email Notifications:** Option to receive checkup reminders via email

### 4. **Badge Reward System**

Gamification through visual badges tracking user impact:

#### Keep Badges
- Earned for maintaining items over target ownership durations
- Rewards long-term ownership of frequently used items
- Shows commitment to responsible consumption

#### Give/Donate Badges
- Earned for donating or selling unused items
- Tracks total items given away
- Encourages sustainable consumption patterns
- May show impact metrics (estimated items diverted from landfill)

### 5. **User Settings**

- **Dark Mode Toggle:** Light/dark theme preference
- **Tutorial Management:** Ability to restart onboarding tutorial
- **Tutorial Completion Tracking:** Records how many times user completed tutorial

### 6. **Onboarding & Tutorial System**

- **Multi-Step Onboarding:** Guided introduction to app features
- **Interactive Spotlight Elements:** Highlights specific UI elements
- **Tutorial Explanations:** Contextual help text for each feature
- **Persistent State:** Remembers user's onboarding progress
- **Restart Capability:** Users can replay tutorial from settings

### 7. **AI-Powered Item Addition (Agent)**

- **Intelligent Item Suggestions:** AI agent can auto-generate items based on user input
- **Batch Processing:** Can suggest multiple items at once
- **Customizable Parameters:** Works with the manual/quick add system

---

## Architecture

### Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js app router pages
│   │   ├── page.tsx            # Landing/home page
│   │   ├── give/               # Give/donate view
│   │   ├── keep/               # Keep/maintain view
│   │   ├── donated/            # Donation history/stats
│   │   ├── gave-badges/        # Give badge showcase
│   │   ├── keep-badges/        # Keep badge showcase
│   │   ├── settings/           # User settings
│   │   ├── api/                # API route handlers
│   │   ├── layout.tsx          # Root layout
│   │   └── _analytics/         # Analytics integration
│   ├── components/             # Reusable React components
│   │   ├── ItemCard.tsx        # Individual item card display
│   │   ├── AddItemForm.tsx     # Form for adding items
│   │   ├── CheckupManager.tsx  # Checkup prompt component
│   │   ├── FilterBar.tsx       # Item filtering interface
│   │   ├── Navigation.tsx      # Navigation menu
│   │   ├── OnboardingManager.tsx # Onboarding flow management
│   │   ├── DatePickerComponent.tsx # Date selection UI
│   │   └── ui/                 # Radix UI wrapped components
│   ├── contexts/               # React Context for state
│   │   ├── ItemUpdateContext.tsx # Item state triggers
│   │   ├── CheckupContext.tsx  # Checkup state management
│   │   └── OnboardingContext.tsx # Onboarding state
│   ├── hooks/                  # Custom React hooks
│   │   ├── useCheckupStatus.ts # Hook for checkup status
│   │   └── useAuthenticatedFetch.ts # HTTP request wrapper
│   ├── types/                  # TypeScript interfaces
│   │   └── item.ts            # Item data model
│   ├── utils/                  # Utility functions
│   │   ├── api.ts             # API communication layer
│   │   └── datePickerHelpers.ts # Date utility functions
│   └── lib/                    # External library wrappers
├── public/                     # Static assets
├── tests/                      # E2E tests with Playwright
├── package.json               # Dependencies and scripts
└── tsconfig.json              # TypeScript configuration
```

### Component Hierarchy

```
App (Root Layout)
├── Navigation
├── HomePage / GiveView / KeepView / SettingsPage
│   ├── AuthMessage (if not signed in)
│   ├── FilterBar
│   ├── AddItemForm (in Keep view)
│   ├── ItemCard[] (list of items)
│   │   └── ItemReceivedDateSection
│   ├── CheckupManager (if checkup due)
│   └── OnboardingManager (if onboarding active)
└── ThemeProvider (wraps entire app)
```

### State Management Strategy

**Context-Based Architecture:**

1. **ItemUpdateContext:** Manages item list refresh triggers
   - `refreshTrigger`: Incremented to signal item list changes
   - `updatedItems`: Tracks specific items that were modified
   - `clearUpdatedItems()`: Resets updated items list

2. **CheckupContext:** Manages checkup system state
   - `triggerCheckupRefresh()`: Forces checkup status re-check
   - Coordinates with backend for checkup scheduling

3. **OnboardingContext:** Manages tutorial/onboarding flow
   - `onboardingStep`: Current tutorial step
   - `startOnboarding()`: Begins tutorial sequence
   - `nextStep()`: Advances to next tutorial step

---

## Key Components

### ItemCard Component
Displays individual item information:
- Item image/emoji
- Item name and category
- Ownership duration with progress
- Status (Keep/Give/Donated)
- Received date display
- Quick action buttons (edit, delete, status change)
- Responsive design for mobile and desktop

### AddItemForm Component
Complex form with two modes:
- **Manual Tab:** Single item entry with full form
- **Quick Tab:** Batch entry with simplified inputs
- Features:
  - Dynamic date picker with multiple selection modes
  - Image upload via Uploadthing
  - Emoji picker
  - Ownership duration goal setting
  - Item category selection
  - File size/validation
  - Admin-specific features (no item limit)

### CheckupManager Component
Modal/dialog interface for item reviews:
- Presents items due for checkup
- Allows quick status changes
- Triggers checkup email sending
- Shows checkup frequency recommendations

### FilterBar Component
Item filtering interface:
- Category/type filtering
- Status filtering (Keep/Give)
- Sort options (date added, ownership duration, etc.)
- Clear filters button

### Navigation Component
App-wide navigation:
- Links to main views (Keep, Give, Badges)
- User profile/auth state display
- Theme toggle access
- Mobile hamburger menu support

### OnboardingManager Component
Tutorial presentation system:
- Step-by-step guidance
- Spotlight highlights on UI elements
- Explanation text for features
- Progress tracking
- Skip/complete options

### DatePickerComponent
Flexible date input:
- Full date picker (calendar)
- Month/year selector
- Year-only selector
- Year range selector
- Validation logic
- Sensible defaults (current date or range)

---

## Data Models

### Item Interface

```typescript
interface Item {
  id: string
  name: string
  pictureUrl: string
  picture_url?: string
  itemType: string
  item_type?: string
  status: 'Keep' | 'Give' | 'Donated'
  ownershipDuration: string
  lastUsedDuration: string
  item_received_date?: string
  last_used?: string
  ownership_duration?: {
    years: number
    months: number
    days: number
    description: string
  }
  ownership_duration_goal_months?: number
  ownershipDurationGoalMonths?: number
  ownership_duration_goal_progress?: number
  ownershipDurationGoalProgress?: number
}
```

### Item Categories

Common item types the app supports:
- Clothing & Accessories
- Electronics
- Furniture
- Home & Kitchen
- Books & Media
- Sports & Outdoors
- Toys & Games
- Art & Collectibles
- Other

---

## Authentication & Authorization

### Clerk Integration

The application uses **Clerk** for authentication and authorization:

#### Features Implemented
- **JWT-Based Authentication:** Clerk provides JWT tokens for API calls
- **User Session Management:** Automatic session persistence and renewal
- **Sign In/Sign Up:** Clerk UI components for auth flows
- **User Public Metadata:** Stores admin flag (`is-admin`) for privilege escalation

#### JWT Workflow
1. User signs in via Clerk UI
2. Frontend obtains JWT token via `useAuth().getToken()`
3. JWT token included in API request headers
4. Backend validates JWT and processes request

#### Authorization Levels

**Regular Users:**
- 20 file uploads per 24-hour period
- Standard item limits
- Access to all features

**Admin Users:**
- Unlimited file uploads
- No item limits
- Flagged in Clerk public metadata

#### Signed In / Signed Out States

Components use Clerk hooks to handle auth states:
- `useUser()`: Gets current user info and auth status
- `useAuth()`: Gets JWT token and auth methods
- `SignedIn/SignedOut`: Conditional rendering components

---

## API Integration

### Base API Architecture

**Endpoint Base:** `/api` (relative to frontend domain)

### Key API Routes

#### Upload Management
- `GET /api/upload-limits` - Check user's remaining uploads
- `GET /api/upload-limits/debug` - Detailed upload limit debug info
- `POST /api/uploadthing/*` - Uploadthing file upload handlers

#### Item Management
- `POST /api/items` - Create item (backend)
- `GET /api/items?status=Keep` - Fetch items by status (backend)
- `PUT /api/items/:id` - Update item (backend)
- `DELETE /api/items/:id` - Delete item (backend)

#### Checkup System
- `GET /api/checkup-status` - Get checkup due dates (backend)
- `POST /api/send-checkup-email` - Trigger checkup email (backend)

#### Uploads
- `DELETE /api/uploadthing/delete` - Delete uploaded file

#### Legacy/Debug
- `GET /api/csrf-token` - Legacy CSRF token (deprecated)

### API Communication Layer (`utils/api.ts`)

Provides wrapper functions for all API calls (JWT-based authentication):
- `fetchItemsByStatus()` - Get items by status
- `createItem()` - Add new item
- `updateItem()` - Modify existing item
- `deleteItem()` - Remove item
- `sendTestCheckupEmail()` - Send checkup email
- `agentAddItem()` - AI-powered item addition
- `validateImageFile()` - File validation
- `fetchCheckup()` - Get checkup status
- `completeCheckup()` - Mark checkup as complete
- `createCheckup()` - Create new checkup

### Error Handling

Standardized error responses:
```typescript
{
  error: string
  details?: object
}
```

All API functions return:
```typescript
{ data?: T, error?: string }
```

---

## User Experience Flows

### 1. New User Onboarding

1. User lands on homepage
2. Sees marketing carousel (4 sections highlighting features)
3. Clicks "Sign Up"
4. Creates account via Clerk
5. Redirected to Keep view
6. Onboarding tutorial starts automatically
7. Tutorial highlights key features:
   - How to add items
   - How to use Keep/Give views
   - How badges work
   - Settings options

### 2. Adding an Item (Manual)

1. User clicks "Add Item" button
2. Form modal opens on Manual tab
3. User enters:
   - Item name
   - Category (dropdown)
   - Received date (via date picker)
   - Image or emoji
   - Optional: Ownership duration goal
4. Clicks submit
5. Item appears in Keep view immediately
6. Toast notification confirms creation

### 3. Adding Items (Quick Batch)

1. User clicks "Add Item" and selects Quick tab
2. Enters first item name
3. Selects date entry mode (full/month/year/range)
4. Clicks "Add Another" to add more items
5. Reviews summary of items to be added
6. Clicks "Add All"
7. Items appear in Keep view with progress indication

### 4. Item Review (Checkup)

1. System determines checkup is due (context-specific, e.g., "Keep Checkup")
2. CheckupManager modal appears
3. Shows items due for review with prompts
4. User can:
   - Move item to "Give" status
   - Keep item and update last-used date
   - Skip and review later
5. After review, can send reminder email (optional)

### 5. Moving Items to Give

1. User navigates to Keep view
2. Finds item they want to give away
3. Clicks "Give" button on ItemCard
4. Item moves to Give view
5. Badge progress updates
6. User gets notification of impact

### 6. Viewing Badges

1. User navigates to "Keep Badges" or "Give Badges"
2. Views collection of earned badges
3. Sees impact metrics and statistics
4. Can share badge collection (future feature)

### 7. Settings Management

1. User navigates to Settings page
2. Toggles dark mode on/off
3. Can restart tutorial
4. See tutorial completion count

---

## Technical Stack

### Frontend Framework & Runtime
- **Next.js 16.0.7** - React framework with server/client components
- **React 19.2.1** - UI library
- **React DOM 19.2.1** - DOM rendering

### Styling & UI
- **Tailwind CSS 4.1.4** - Utility-first CSS framework
- **@tailwindcss/postcss 4.1.4** - PostCSS plugin
- **@tailwindcss/vite 4.1.4** - Vite integration
- **Radix UI (multiple)** - Headless component library
  - Accordion, Avatar, Checkbox, Dialog, Dropdown, Menubar, Navigation Menu, Popover, Progress, Radio Group, Scroll Area, Select, Separator, Tabs, Toast, Tooltip, etc.
- **Lucide React 0.503.0** - Icon library
- **Tailwind Merge 3.2.0** - Utility class conflict resolution
- **Class Variance Authority 0.7.1** - Component variant system

### Authentication & Authorization
- **@clerk/nextjs 6.36.0** - Clerk auth SDK for Next.js
- **@clerk/themes 2.4.42** - Clerk UI theming
- **@clerk/testing 1.7.5** (dev) - Clerk testing utilities

### Form Management & Validation
- **React Hook Form 7.56.1** - Efficient form state management
- **@hookform/resolvers 5.0.1** - Schema validation integration
- **Zod 3.24.3** - TypeScript-first schema validation

### File Upload & Storage
- **Uploadthing 7.7.2** - File upload service
- **@uploadthing/react 7.3.1** - React integration for Uploadthing

### Rate Limiting & Security
- **@upstash/ratelimit 2.0.6** - Redis-backed rate limiting
- **next-auth 4.24.11** - Authentication (legacy support)

### Date & Time
- **date-fns 4.1.0** - Date manipulation and formatting
- **react-day-picker 9.7.0** - Calendar component

### Analytics & Monitoring
- **posthog-js 1.265.0** - Product analytics

### Utilities
- **axios 1.9.0** - HTTP client
- **sonner 2.0.6** - Toast notification system
- **next-themes 0.4.6** - Theme management

### Testing & Development
- **@playwright/test 1.42.1** - E2E testing framework
- **TypeScript 5.5.3** - Type safety
- **ESLint 9.9.0** - Code linting
- **eslint-plugin-react-hooks 5.1.0-rc.0** - React hooks linting

### Build & Development
- **PostCSS 8.5.3** - CSS processing
- **Vite** - Implied build tool support (tsconfig references)

---

## File Upload & Rate Limiting

### Uploadthing Integration

**Purpose:** Secure file upload service for item images

**Features:**
- Chunked upload support
- Automatic file validation
- CDN-backed image serving
- Delete endpoint for cleanup

**File Type Support:**
- Images (JPEG, PNG, WebP, GIF)
- Size limits enforced per tier

**Flow:**
1. User selects/uploads image in AddItemForm
2. UploadButton component shows upload progress
3. Upon completion, image URL returned
4. Image URL stored with item record
5. Image served via Uploadthing CDN

### Rate Limiting System

**Technology:** Upstash Redis with sliding window algorithm

**Limits by User Type:**

**Regular Users:**
- 20 file uploads per 24-hour period
- Sliding window enforced per request
- Limit resets daily

**Admin Users:**
- Unlimited uploads
- Identified via Clerk public metadata (`is-admin`)
- Bypass all rate limiting

**Rate Limit Endpoints:**

1. **Check Limits:** `GET /api/upload-limits`
   - Shows remaining uploads
   - Shows reset time
   - Indicates admin status
   - Does NOT consume token

2. **Debug Info:** `GET /api/upload-limits/debug`
   - Shows raw Redis state
   - Shows sliding window calculations
   - Shows detailed token status
   - Requires `NEXT_PUBLIC_DEBUG=true`

**Rate Limiting Consumption:**

- File upload: 1 token
- Checkup email: 0-1 token (may have separate limiter)
- Regular API calls: No rate limiting by default

---

## Development & Deployment

### Scripts

```json
{
  "dev": "next dev --turbopack",       // Local dev with Turbopack
  "build": "next build",                // Production build
  "start": "next start",                // Production server
  "lint": "next lint",                  // Run ESLint
  "test": "playwright test",            // Run E2E tests
  "test:ui": "playwright test --ui"    // Run tests with UI
}
```

### Environment Configuration

**Key Environment Variables:**
- `NEXT_PUBLIC_DEBUG` - Enable debug endpoints
- `NEXT_PUBLIC_API_URL` - Backend API base URL
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk public key
- Uploadthing API key
- Upstash Redis connection string
- PostHog API key

### Build Optimization

- **Turbopack:** Enabled for faster dev builds
- **Next.js 16 Features:**
  - React 19 with automatic batching
  - Improved server components
  - Enhanced image optimization

---

## Testing

### E2E Testing with Playwright

**Test Coverage:**
- Login/authentication flows
- Item CRUD operations
- Badge earning
- Checkup system
- Filter and search functionality
- Mobile responsiveness

**Test Files:**
- `tests/global.setup.ts` - Global setup (auth, etc.)
- `tests/test-item.spec.ts` - Item management tests

**Run Tests:**
```bash
npm test                  # Headless
npm run test:ui         # Interactive UI mode
```

---

## Future Considerations

### Potential Features
1. Item sharing with other users
2. Community marketplace for items
3. Advanced analytics dashboard
4. Mobile app (React Native)
5. Integration with donation services (Goodwill API, etc.)
6. Social sharing of badges and impact
7. AI-powered item recommendations
8. Barcode scanning for quick adds
9. Receipt scanning for item creation
10. Recurring checkup scheduling

### Performance Optimization Opportunities
- Image optimization and lazy loading
- Code splitting by route
- Caching strategies for item lists
- Debouncing filter operations
- Virtualizing long item lists

### Security Enhancements
- CORS policy review
- CSP headers
- Automated security scanning
- Dependency updates

---

## Support & Documentation

### For Developers
- See `API_ROUTES.md` for detailed API documentation
- Check component JSDoc comments for prop definitions
- Review Clerk documentation: https://clerk.com/docs
- Radix UI documentation: https://www.radix-ui.com/docs

### Common Issues

**Authentication Not Working:**
- Verify Clerk keys are set in environment
- Check browser console for Clerk errors
- Ensure JWT is being passed in API calls

**Image Upload Failures:**
- Check Uploadthing API key
- Verify file size limits
- Check browser file type restrictions

**Rate Limiting Issues:**
- Verify Upstash Redis connection
- Check user admin status in Clerk
- Review rate limit debug endpoint

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Jan 8, 2026 | Initial product spec documentation |
| - | - | JWT authentication migration (in progress) |
| - | - | Radix UI component library integration |
| - | - | Onboarding system with spotlight guidance |

---

**Document End**
