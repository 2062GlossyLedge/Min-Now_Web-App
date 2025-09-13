import 'server-only'
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

// Multiple rate limiters organized by purpose
export const ratelimit = {
    // General API rate limiting 
    api: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, "50 s"),
        analytics: true,
        prefix: "@upstash/ratelimit",
    }),

    // File upload rate limiting - 40 uploads per day
    fileUpload: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, "24 h"),
        analytics: true,
        prefix: "@upstash/ratelimit/file-upload",
    }),



};

// Export individual rate limiters for backward compatibility
export const fileUploadRatelimit = ratelimit.fileUpload;
export const apiRatelimit = ratelimit.api;