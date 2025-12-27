# Frontend API Routes Documentation

## Overview

This document provides complete documentation for all API routes in the Next.js frontend application. All routes are server-side endpoints that leverage Clerk authentication, Upstash Redis for rate limiting, and Uploadthing for file management.

**Base URL:** `https://your-domain.com/api` (or `http://localhost:3000/api` in development)

---

## Table of Contents

1. [CSRF Token (Legacy)](#csrf-token-legacy)
2. [Upload Limits](#upload-limits)
   - [Check Upload Limits](#check-upload-limits)
   - [Debug Upload Limits](#debug-upload-limits)
3. [Uploadthing](#uploadthing)
   - [Delete File](#delete-file)
4. [Redis Management](#redis-management)
   - [Redis Heartbeat (Cron)](#redis-heartbeat-cron)
   - [Redis Status](#redis-status)

---

## CSRF Token (Legacy)

### Endpoint: GET `/api/csrf-token`

**Status:** ⚠️ DEPRECATED - Legacy support only

**Purpose:** Provides fake CSRF token for legacy code that still requests it. This endpoint exists for backward compatibility during migration to JWT-only authentication.

**Authentication:** None required

**Rate Limiting:** None

**Request:**
```bash
GET /api/csrf-token
```

**Response (200 OK):**
```json
{
  "token": "legacy-stub-token",
  "message": "This is a legacy endpoint. JWT authentication is now used."
}
```

**Notes:**
- This endpoint will always return success to prevent 404 errors
- Actual CSRF protection is handled by Clerk JWT authentication
- Can be removed once all code migrates to JWT-only auth

---

## Upload Limits

### Check Upload Limits

**Endpoint:** `GET /api/upload-limits`

**Purpose:** Check user's remaining file uploads for the current 24-hour period. Admins see unlimited uploads.

**Authentication:** ✅ Required (Clerk JWT)

**Rate Limiting:** ✅ Enforced (uses file upload rate limiter - consumes 1 token)

**Query Parameters:** None

**Request:**
```bash
GET /api/upload-limits \
  -H "Authorization: Bearer <clerk-jwt>"
```

**Response (200 OK) - Regular User:**
```json
{
  "uploads_remaining": 15,
  "uploads_total": 20,
  "uploads_used": 5,
  "can_upload": true,
  "reset_time": 1703587200000,
  "reset_date": "2023-12-26T12:00:00.000Z",
  "method": "rate_limiter_direct",
  "is_admin": false
}
```

**Response (200 OK) - Admin User:**
```json
{
  "uploads_remaining": 999999,
  "uploads_total": 999999,
  "uploads_used": 0,
  "can_upload": true,
  "reset_time": 0,
  "reset_date": "1970-01-01T00:00:00.000Z",
  "method": "admin_bypass",
  "is_admin": true
}
```

**Response (401 Unauthorized):**
```json
{
  "error": "Unauthorized"
}
```

**Response (500 Internal Server Error):**
```json
{
  "error": "Internal server error"
}
```

**Field Descriptions:**
| Field | Type | Description |
|-------|------|-------------|
| `uploads_remaining` | number | Files user can still upload in current window |
| `uploads_total` | number | Total uploads allowed per 24-hour period |
| `uploads_used` | number | Files already uploaded in current period |
| `can_upload` | boolean | Whether user can upload right now |
| `reset_time` | number | Unix timestamp (ms) when limit resets |
| `reset_date` | string | ISO 8601 formatted reset time |
| `method` | string | How limit was determined: `admin_bypass` or `rate_limiter_direct` |
| `is_admin` | boolean | Whether user has admin status |

**Implementation Details:**
- Checks Clerk public metadata for `is-admin` flag
- Admins bypass rate limiting entirely
- Regular users: 20 uploads per 24 hours
- Uses Upstash Redis sliding window algorithm
- **Note:** This endpoint consumes 1 token each time it's called

---

### Debug Upload Limits

**Endpoint:** `GET /api/upload-limits/debug`

**Purpose:** Detailed debugging information for rate limit state. Shows raw Redis data, token counts, and verification of rate limiter calculations.

**Authentication:** ✅ Required (Clerk JWT)

**Prerequisites:** `NEXT_PUBLIC_DEBUG=true` environment variable

**Rate Limiting:** ✅ Rate limiters are checked but results shown without blocking

**Request:**
```bash
GET /api/upload-limits/debug \
  -H "Authorization: Bearer <clerk-jwt>"
```

**Response (200 OK):**
```json
{
  "userId": "user_123abc",
  "currentTime": 1703587200000,
  "currentTimeISO": "2023-12-26T12:00:00.000Z",
  "rateLimiters": {
    "fileUpload": {
      "key": "@upstash/ratelimit/file-upload:user_123abc",
      "windowDuration": "24 hours",
      "windowStart": 1703500800000,
      "windowStartISO": "2023-12-25T12:00:00.000Z",
      "tokensInWindow": 5,
      "hashData": {...},
      "sortedSetData": [[timestamp1, score1], ...],
      "keyTTL": 2592000,
      "rateLimiterResult": {
        "success": true,
        "limit": 20,
        "remaining": 15,
        "reset": 1703587200000,
        "resetDate": "2023-12-26T12:00:00.000Z"
      },
      "comparison": {
        "redisDirectCount": 5,
        "rateLimiterRemaining": 15,
        "rateLimiterUsed": 5,
        "match": true
      }
    },
    "api": {
      "key": "@upstash/ratelimit:user_123abc",
      "windowDuration": "100 seconds",
      "windowStart": 1703587100000,
      "windowStartISO": "2023-12-26T11:58:20.000Z",
      "tokensInWindow": 3,
      "hashData": {...},
      "keyTTL": 100,
      "rateLimiterResult": {
        "success": true,
        "limit": 20,
        "remaining": 17,
        "reset": 1703587200000,
        "resetDate": "2023-12-26T12:01:40.000Z"
      }
    },
    "auth": {...},
    "email": {...}
  },
  "summary": {
    "fileUpload": "15/20 remaining",
    "api": "17/20 remaining",
    "auth": "5/5 remaining",
    "email": "3/3 remaining"
  }
}
```

**Response (404 Not Found) - Debug Disabled:**
```json
{
  "error": "Debug endpoint not available"
}
```

**Rate Limiters Shown:**
| Limiter | Window | Limit | Purpose |
|---------|--------|-------|---------|
| `fileUpload` | 24 hours | 20 uploads | File upload rate limiting |
| `api` | 100 seconds | 20 requests | General API rate limiting |
| `auth` | 15 minutes | 5 attempts | Authentication attempts |
| `email` | 1 hour | 3 emails | Email sending rate limiting |

**Reset Method:**

**Endpoint:** `DELETE /api/upload-limits/debug`

**Purpose:** Reset rate limit counters for a user (testing/debugging only)

**Request:**
```bash
DELETE /api/upload-limits/debug \
  -H "Authorization: Bearer <clerk-jwt>"
```

**Response (200 OK):**
```json
{
  "message": "Rate limit reset completed",
  "userId": "user_123abc",
  "resetResults": [
    {
      "limiter": "fileUpload",
      "status": "success"
    },
    {
      "limiter": "api",
      "status": "success"
    },
    {
      "limiter": "auth",
      "status": "success"
    },
    {
      "limiter": "email",
      "status": "success"
    }
  ],
  "summary": {
    "successful": 4,
    "failed": 0,
    "total": 4
  }
}
```

**Important Notes:**
- ⚠️ Only available when `NEXT_PUBLIC_DEBUG=true`
- Shows raw Redis keys and their TTL
- Comparison field verifies Redis data matches rate limiter library
- Useful for troubleshooting rate limiting issues

---

## Uploadthing

### Delete File

**Endpoint:** `POST /api/uploadthing/delete`

**Purpose:** Delete a file from Uploadthing storage and remove associated database records.

**Authentication:** ✅ Required (Clerk JWT)

**Rate Limiting:** None (handled by general API limiter if enabled)

**Request:**
```bash
POST /api/uploadthing/delete \
  -H "Authorization: Bearer <clerk-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"fileKey": "fileid_abc123"}'
```

**Request Body:**
```json
{
  "fileKey": "fileid_abc123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

**Response (400 Bad Request) - Missing fileKey:**
```json
{
  "error": "File key is required"
}
```

**Response (401 Unauthorized):**
```json
{
  "error": "Unauthorized"
}
```

**Response (500 Internal Server Error):**
```json
{
  "error": "Failed to delete file from uploadthing"
}
```

**Field Descriptions:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fileKey` | string | Yes | Uploadthing file identifier to delete |

**Implementation Details:**
- Uses Uploadthing API client (`utapi`) to delete files
- Ensures user is authenticated before deletion
- Handles all Uploadthing service errors gracefully

---

## Redis Management

### Redis Heartbeat (Cron)

**Endpoint:** `GET /api/cron/redis-heartbeat`

**Status:** ⚠️ Vercel Cron Job (Automated)

**Purpose:** Automated heartbeat to keep Upstash Redis instance active. Prevents auto-deactivation after 14 days of inactivity.

**Authentication:** ✅ Required (Vercel CRON_SECRET header)

**Execution:** Every Sunday at 00:00 UTC (automated by Vercel)

**Request (Manual Testing):**
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-domain.com/api/cron/redis-heartbeat
```

**Response (200 OK):**
```json
{
  "status": "success",
  "message": "Redis heartbeat successful - instance kept active",
  "timestamp": "2023-12-26T00:00:00.000Z",
  "pingResponse": "PONG",
  "heartbeatCount": 52,
  "nextHeartbeatDue": "In 7 days"
}
```

**Response (401 Unauthorized) - Invalid Secret:**
```json
{
  "error": "Unauthorized - Invalid cron secret"
}
```

**Response (500 Internal Server Error):**
```json
{
  "status": "error",
  "message": "Redis heartbeat failed - instance may become inactive",
  "error": "Error details here",
  "timestamp": "2023-12-26T00:00:00.000Z"
}
```

**Field Descriptions:**
| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Result: `success` or `error` |
| `message` | string | Human-readable status message |
| `timestamp` | string | ISO 8601 formatted execution time |
| `pingResponse` | string | Redis PING response (`PONG`) |
| `heartbeatCount` | number | Total heartbeat executions |
| `nextHeartbeatDue` | string | When next heartbeat will run |

**Implementation Details:**
- Performs lightweight Redis PING operation
- Stores timestamp in `app:redis:heartbeat:last` key (30-day expiry)
- Increments counter in `app:redis:heartbeat:count` for tracking
- Requires `CRON_SECRET` environment variable on Vercel
- Automatically called by Vercel every Sunday at midnight UTC
- Ensures Redis instance never remains inactive for >7 days
- Vercel handles manual triggering of the cron job, and logging

**Configuration:**
- Location: `/frontend/vercel.json`
- Schedule: `0 0 * * 0` (Every Sunday at 00:00 UTC)
- Required ENV: `CRON_SECRET` (set in Vercel dashboard)

---

### Redis Status

**Endpoint:** `GET /api/redis-status`

**Purpose:** Check Redis instance health and verify cron job is running properly. Public monitoring endpoint.

**Authentication:** ❌ Not required

**Rate Limiting:** None

**Request:**
```bash
GET /api/redis-status
```

**Response (200 OK) - Healthy:**
```json
{
  "status": "healthy",
  "lastHeartbeat": "2023-12-26T00:00:00.000Z",
  "daysSinceLastHeartbeat": 0,
  "totalHeartbeats": 52,
  "redisActive": true,
  "cronJobStatus": "✅ Running normally",
  "recommendation": "Redis instance is being kept active by Vercel cron job",
  "vercelDashboardLink": "https://vercel.com/dashboard",
  "monitoringNotes": {
    "expectedInterval": "Every 7 days",
    "maxAllowedDaysSinceHeartbeat": 10,
    "action": "If daysSinceLastHeartbeat > 10, check Vercel Functions tab for errors"
  }
}
```

**Response (200 OK) - Warning:**
```json
{
  "status": "warning",
  "lastHeartbeat": "2023-12-19T00:00:00.000Z",
  "daysSinceLastHeartbeat": 7,
  "totalHeartbeats": 51,
  "redisActive": true,
  "cronJobStatus": "⚠️ May have failed",
  "recommendation": "Check Vercel Functions logs - cron job may have encountered an error",
  "vercelDashboardLink": "https://vercel.com/dashboard",
  "monitoringNotes": {
    "expectedInterval": "Every 7 days",
    "maxAllowedDaysSinceHeartbeat": 10,
    "action": "If daysSinceLastHeartbeat > 10, check Vercel Functions tab for errors"
  }
}
```

**Response (500 Internal Server Error):**
```json
{
  "status": "error",
  "message": "Cannot reach Redis",
  "error": "Connection refused at harmless-satyr-54371.upstash.io:6379"
}
```

**Field Descriptions:**
| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Health status: `healthy`, `warning`, or `error` |
| `lastHeartbeat` | string | ISO 8601 timestamp of last successful heartbeat |
| `daysSinceLastHeartbeat` | number | Days elapsed since last heartbeat execution |
| `totalHeartbeats` | number | Total successful heartbeat executions |
| `redisActive` | boolean | Whether Redis instance is responding |
| `cronJobStatus` | string | Visual indicator of cron job health |
| `recommendation` | string | Action to take based on status |

**Implementation Details:**
- Queries Redis for `app:redis:heartbeat:last` timestamp
- Reads `app:redis:heartbeat:count` counter
- Calculates days since last heartbeat
- Status becomes "warning" if > 10 days since heartbeat
- Fully public - no authentication required for monitoring
- Used by monitoring dashboards and health checks

**Healthy Threshold:** daysSinceLastHeartbeat < 10  
**Warning Threshold:** daysSinceLastHeartbeat >= 10


---

## Authentication

### Clerk JWT

Most endpoints require Clerk JWT authentication. The token is automatically included by `@clerk/nextjs` on the client side.

**Header:**
```
Authorization: Bearer <clerk-jwt-token>
```

**Client Example (React):**
```typescript
const { getToken } = useAuth();
const token = await getToken();

const response = await fetch('/api/upload-limits', {
  headers: {
    Authorization: `Bearer ${token}`
  }
});
```

---

## Rate Limiting

The application uses Upstash Redis-based rate limiting via the `@upstash/ratelimit` library.

### Rate Limit Configuration

**File Uploads:**
- Limit: 20 uploads
- Window: 24 hours
- Algorithm: Sliding window
- Bypass: Admins (checked via Clerk metadata)

**API Requests:**
- Limit: 20 requests
- Window: 50 seconds
- Algorithm: Sliding window

**Authentication:**
- Limit: 5 attempts
- Window: 15 minutes
- Algorithm: Fixed window

**Email:**
- Limit: 3 emails
- Window: 1 hour
- Algorithm: Fixed window

### Rate Limit Errors

When rate limit is exceeded, the middleware returns a 429 error:

```json
{
  "error": "Rate limit exceeded. Try again after 30 seconds."
}
```

---

## Environment Variables Required

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://harmless-satyr-54371.upstash.io
UPSTASH_REDIS_REST_TOKEN=AdRjAAInc...

# Uploadthing
UPLOADTHING_SECRET=sk_live_...
UPLOADTHING_APP_ID=...

# Vercel Cron
CRON_SECRET=your-secret-hex-string

# Debug Mode
NEXT_PUBLIC_DEBUG=true  (only in development/preview)
```

---

## Testing API Routes

### Using cURL

```bash
# Check upload limits
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/upload-limits

# Test CSRF endpoint
curl http://localhost:3000/api/csrf-token

# Check Redis status
curl http://localhost:3000/api/redis-status

# Debug rate limits (if enabled)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/upload-limits/debug
```

### Using JavaScript/Fetch

```typescript
// Check upload limits
const response = await fetch('/api/upload-limits', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const data = await response.json();
console.log(`You can upload ${data.uploads_remaining} more files`);

// Check Redis status
const statusResponse = await fetch('/api/redis-status');
const status = await statusResponse.json();
console.log(`Redis status: ${status.status}`);
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2023-12-26 | Initial documentation |
| 1.1 | 2024-01-15 | Added cron job documentation |
| 1.2 | 2024-02-20 | Added rate limiting details |

---

## Support & Troubleshooting

### Common Issues

**"Debug endpoint not available"**
- Set `NEXT_PUBLIC_DEBUG=true` in environment
- Only available in development/preview environments

**"Rate limit exceeded"**
- Wait for the time specified in error
- Check `/api/upload-limits` for remaining quota
- Contact admins if consistently hitting limits

**"Redis heartbeat failed"**
- Check Vercel Functions logs
- Verify `CRON_SECRET` is set correctly
- Ensure `UPSTASH_REDIS_*` variables are configured

**"Unauthorized"**
- Ensure you have valid Clerk JWT token
- Check token is passed in Authorization header
- Verify token hasn't expired

---

## Related Documentation

- [Rate Limiting Overview](./CRON_QUICK_REFERENCE.md)
- [Vercel Cron Setup](./VERCEL_CRON_SETUP.md)
- [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)
