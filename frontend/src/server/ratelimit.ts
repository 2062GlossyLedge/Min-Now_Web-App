import 'server-only'
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

// Multiple rate limiters organized by purpose
export const ratelimit = {
    // General API rate limiting - 20 requests per 100 seconds
    api: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, "100 s"),
        analytics: true,
        prefix: "@upstash/ratelimit",
    }),

    // File upload rate limiting - 40 uploads per day
    fileUpload: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(40, "24 h"),
        analytics: true,
        prefix: "@upstash/ratelimit/file-upload",
    }),

    // Authentication rate limiting - 5 attempts per 15 minutes
    auth: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "15 m"),
        analytics: true,
        prefix: "@upstash/ratelimit/auth",
    }),

    // Email sending rate limiting - 3 emails per hour
    email: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(3, "1 h"),
        analytics: true,
        prefix: "@upstash/ratelimit/email",
    }),
};

// Export individual rate limiters for backward compatibility
export const fileUploadRatelimit = ratelimit.fileUpload;
export const apiRatelimit = ratelimit.api;