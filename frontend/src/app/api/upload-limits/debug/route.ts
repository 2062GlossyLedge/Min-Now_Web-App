import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { ratelimit } from "@/server/ratelimit";

export async function GET() {
    try {
        // Check if debug mode is enabled
        if (process.env.NEXT_PUBLIC_DEBUG !== 'true') {
            return NextResponse.json({ error: "Debug endpoint not available" }, { status: 404 });
        }

        const user = await auth();

        if (!user.userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const redis = Redis.fromEnv();
        const now = Date.now();

        // Define types for rate limit checks
        type RateLimitCheck = {
            key: string;
            windowDuration: string;
            windowStart: number;
            windowStartISO: string;
            tokensInWindow: number;
            hashData: Record<string, unknown> | null;
            sortedSetData?: unknown[];
            keyTTL: number;
            rateLimiterResult: {
                success: boolean;
                limit: number;
                remaining: number;
                reset: number;
                resetDate: string;
            };
            comparison?: {
                redisDirectCount: number;
                rateLimiterRemaining: number;
                rateLimiterUsed: number;
                match: boolean;
            };
        } | { error: string };

        // Check all rate limiters
        const rateLimitChecks: {
            fileUpload: RateLimitCheck | null;
            api: RateLimitCheck | null;
            auth: RateLimitCheck | null;
            email: RateLimitCheck | null;
        } = {
            fileUpload: null,
            api: null,
            auth: null,
            email: null
        };

        // Check file upload rate limiter (24 hour window)
        try {
            const fileUploadKey = `@upstash/ratelimit/file-upload:${user.userId}`;
            const fileUploadWindowStart = now - (24 * 60 * 60 * 1000); // 24 hours ago
            const fileUploadTokensInWindow = await redis.zcount(fileUploadKey, fileUploadWindowStart, now);
            const fileUploadHashData = await redis.hgetall(fileUploadKey);
            const fileUploadSortedSetData = await redis.zrange(fileUploadKey, 0, -1, { withScores: true });

            // ALSO get what the actual rate limiter thinks (this will consume 1 token for debugging)
            const fileUploadRateLimiterResult = await ratelimit.fileUpload.limit(user.userId);

            rateLimitChecks.fileUpload = {
                key: fileUploadKey,
                windowDuration: "24 hours",
                windowStart: fileUploadWindowStart,
                windowStartISO: new Date(fileUploadWindowStart).toISOString(),
                tokensInWindow: fileUploadTokensInWindow,
                hashData: fileUploadHashData,
                sortedSetData: fileUploadSortedSetData,
                keyTTL: await redis.ttl(fileUploadKey),
                rateLimiterResult: {
                    success: fileUploadRateLimiterResult.success,
                    limit: fileUploadRateLimiterResult.limit,
                    remaining: fileUploadRateLimiterResult.remaining,
                    reset: fileUploadRateLimiterResult.reset,
                    resetDate: new Date(fileUploadRateLimiterResult.reset).toISOString()
                },
                // Show both methods for comparison
                comparison: {
                    redisDirectCount: fileUploadTokensInWindow,
                    rateLimiterRemaining: fileUploadRateLimiterResult.remaining,
                    rateLimiterUsed: 40 - fileUploadRateLimiterResult.remaining,
                    match: fileUploadTokensInWindow === (40 - fileUploadRateLimiterResult.remaining)
                }
            };
        } catch (error) {
            rateLimitChecks.fileUpload = { error: String(error) };
        }

        // Check API rate limiter (100 second window)
        try {
            const apiKey = `@upstash/ratelimit:${user.userId}`;
            const apiWindowStart = now - (100 * 1000); // 100 seconds ago
            const apiTokensInWindow = await redis.zcount(apiKey, apiWindowStart, now);
            const apiHashData = await redis.hgetall(apiKey);

            // Calculate remaining without consuming tokens
            const apiLimit = 20;
            const apiRemaining = Math.max(0, apiLimit - apiTokensInWindow);
            const apiSuccess = apiRemaining > 0;

            rateLimitChecks.api = {
                key: apiKey,
                windowDuration: "100 seconds",
                windowStart: apiWindowStart,
                windowStartISO: new Date(apiWindowStart).toISOString(),
                tokensInWindow: apiTokensInWindow,
                hashData: apiHashData,
                keyTTL: await redis.ttl(apiKey),
                rateLimiterResult: {
                    success: apiSuccess,
                    limit: apiLimit,
                    remaining: apiRemaining,
                    reset: now + (100 * 1000),
                    resetDate: new Date(now + (100 * 1000)).toISOString()
                }
            };
        } catch (error) {
            rateLimitChecks.api = { error: String(error) };
        }

        // Check auth rate limiter (15 minute window)
        try {
            const authKey = `@upstash/ratelimit/auth:${user.userId}`;
            const authWindowStart = now - (15 * 60 * 1000); // 15 minutes ago
            const authTokensInWindow = await redis.zcount(authKey, authWindowStart, now);
            const authHashData = await redis.hgetall(authKey);

            // Calculate remaining without consuming tokens
            const authLimit = 5;
            const authRemaining = Math.max(0, authLimit - authTokensInWindow);
            const authSuccess = authRemaining > 0;

            rateLimitChecks.auth = {
                key: authKey,
                windowDuration: "15 minutes",
                windowStart: authWindowStart,
                windowStartISO: new Date(authWindowStart).toISOString(),
                tokensInWindow: authTokensInWindow,
                hashData: authHashData,
                keyTTL: await redis.ttl(authKey),
                rateLimiterResult: {
                    success: authSuccess,
                    limit: authLimit,
                    remaining: authRemaining,
                    reset: now + (15 * 60 * 1000),
                    resetDate: new Date(now + (15 * 60 * 1000)).toISOString()
                }
            };
        } catch (error) {
            rateLimitChecks.auth = { error: String(error) };
        }

        // Check email rate limiter (1 hour window)
        try {
            const emailKey = `@upstash/ratelimit/email:${user.userId}`;
            const emailWindowStart = now - (60 * 60 * 1000); // 1 hour ago
            const emailTokensInWindow = await redis.zcount(emailKey, emailWindowStart, now);
            const emailHashData = await redis.hgetall(emailKey);

            // Calculate remaining without consuming tokens
            const emailLimit = 3;
            const emailRemaining = Math.max(0, emailLimit - emailTokensInWindow);
            const emailSuccess = emailRemaining > 0;

            rateLimitChecks.email = {
                key: emailKey,
                windowDuration: "1 hour",
                windowStart: emailWindowStart,
                windowStartISO: new Date(emailWindowStart).toISOString(),
                tokensInWindow: emailTokensInWindow,
                hashData: emailHashData,
                keyTTL: await redis.ttl(emailKey),
                rateLimiterResult: {
                    success: emailSuccess,
                    limit: emailLimit,
                    remaining: emailRemaining,
                    reset: now + (60 * 60 * 1000),
                    resetDate: new Date(now + (60 * 60 * 1000)).toISOString()
                }
            };
        } catch (error) {
            rateLimitChecks.email = { error: String(error) };
        }

        // Helper function to get summary for each rate limiter
        const getSummary = (check: RateLimitCheck | null): string => {
            if (!check) return "No data";
            if ('error' in check) return `Error: ${check.error}`;
            return `${check.rateLimiterResult.remaining}/${check.rateLimiterResult.limit} remaining`;
        };

        return NextResponse.json({
            userId: user.userId,
            currentTime: now,
            currentTimeISO: new Date().toISOString(),
            rateLimiters: rateLimitChecks,
            summary: {
                fileUpload: getSummary(rateLimitChecks.fileUpload),
                api: getSummary(rateLimitChecks.api),
                auth: getSummary(rateLimitChecks.auth),
                email: getSummary(rateLimitChecks.email)
            }
        });
    } catch (error) {
        console.error("Error debugging upload limits:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE() {
    try {
        // Check if debug mode is enabled
        if (process.env.NEXT_PUBLIC_DEBUG !== 'true') {
            return NextResponse.json({ error: "Debug endpoint not available" }, { status: 404 });
        }

        const user = await auth();

        if (!user.userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Use the proper reset method from Upstash ratelimit
        const resetResults = [];

        try {
            await ratelimit.fileUpload.resetUsedTokens(user.userId);
            resetResults.push({ limiter: "fileUpload", status: "success" });
        } catch (error) {
            resetResults.push({ limiter: "fileUpload", status: "error", error: String(error) });
        }

        try {
            await ratelimit.api.resetUsedTokens(user.userId);
            resetResults.push({ limiter: "api", status: "success" });
        } catch (error) {
            resetResults.push({ limiter: "api", status: "error", error: String(error) });
        }

        try {
            await ratelimit.auth.resetUsedTokens(user.userId);
            resetResults.push({ limiter: "auth", status: "success" });
        } catch (error) {
            resetResults.push({ limiter: "auth", status: "error", error: String(error) });
        }

        try {
            await ratelimit.email.resetUsedTokens(user.userId);
            resetResults.push({ limiter: "email", status: "success" });
        } catch (error) {
            resetResults.push({ limiter: "email", status: "error", error: String(error) });
        }

        const successCount = resetResults.filter(result => result.status === "success").length;
        const errorCount = resetResults.filter(result => result.status === "error").length;

        return NextResponse.json({
            message: "Rate limit reset completed",
            userId: user.userId,
            resetResults,
            summary: {
                successful: successCount,
                failed: errorCount,
                total: resetResults.length
            }
        });
    } catch (error) {
        console.error("Error resetting rate limits:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
