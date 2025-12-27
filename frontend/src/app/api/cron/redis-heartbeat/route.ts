import 'server-only'

import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

/**
 * Vercel Cron Job: Redis Heartbeat
 * 
 * Scheduled to run every 7 days to prevent Upstash Redis auto-suspension
 * 
 * Vercel cron requires Authorization header with secret to prevent unauthorized invocations
 * 
 * See: https://vercel.com/docs/cron-jobs
 */
export async function GET(request: Request) {
    try {
        // Verify request is from Vercel's cron service
        const authHeader = request.headers.get('authorization');
        const vercelCronSecret = process.env.CRON_SECRET;

        if (!vercelCronSecret || authHeader !== `Bearer ${vercelCronSecret}`) {
            return NextResponse.json(
                { error: "Unauthorized - Invalid cron secret" },
                { status: 401 }
            );
        }

        const redis = Redis.fromEnv();
        const timestamp = new Date().toISOString();

        // Perform lightweight PING to keep Redis active
        const pingResult = await redis.ping();

        // Store heartbeat record for monitoring
        const heartbeatKey = "app:redis:heartbeat:last";
        await redis.set(heartbeatKey, timestamp, { ex: 30 * 24 * 60 * 60 }); // 30-day expiry

        // Increment heartbeat counter (for tracking frequency)
        const counterKey = "app:redis:heartbeat:count";
        const count = await redis.incr(counterKey);

        console.log(`[Redis Heartbeat] Success - Ping: ${pingResult}, Count: ${count}, Time: ${timestamp}`);

        return NextResponse.json({
            status: "success",
            message: "Redis heartbeat successful - instance kept active",
            timestamp,
            pingResponse: pingResult,
            heartbeatCount: count,
            nextHeartbeatDue: "In 7 days"
        });

    } catch (error) {
        console.error("[Redis Heartbeat] Failed:", error);

        return NextResponse.json(
            {
                status: "error",
                message: "Redis heartbeat failed - instance may become inactive",
                error: String(error),
                timestamp: new Date().toISOString()
            },
            { status: 500 }
        );
    }
}

/**
 * Configuration for Vercel cron job
 * Defines when this route should be executed
 */
export const dynamic = 'force-dynamic'; // Required for cron routes in Next.js
