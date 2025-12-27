import 'server-only'

import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

/**
 * Redis Status Monitoring Endpoint
 * Shows last heartbeat time, verifies cron job is working
 * Public endpoint - no authentication required (monitoring only)
 */
export async function GET() {
    try {
        const redis = Redis.fromEnv();

        // Get last heartbeat timestamp
        const lastHeartbeat = await redis.get<string>("app:redis:heartbeat:last");
        const heartbeatCount = await redis.get<number>("app:redis:heartbeat:count") || 0;

        const lastHeartbeatDate = lastHeartbeat ? new Date(lastHeartbeat) : null;
        const daysSinceHeartbeat = lastHeartbeatDate
            ? Math.floor((Date.now() - lastHeartbeatDate.getTime()) / (1000 * 60 * 60 * 24))
            : null;

        // Alert if no heartbeat in 10 days (cron job may have failed)
        const isHealthy = daysSinceHeartbeat !== null && daysSinceHeartbeat < 10;

        return NextResponse.json({
            status: isHealthy ? "healthy" : "warning",
            lastHeartbeat: lastHeartbeatDate?.toISOString() || "Never",
            daysSinceLastHeartbeat: daysSinceHeartbeat,
            totalHeartbeats: heartbeatCount,
            redisActive: true,
            cronJobStatus: isHealthy ? "✅ Running normally" : "⚠️ May have failed",
            recommendation: isHealthy
                ? "Redis instance is being kept active by Vercel cron job"
                : "Check Vercel Functions logs - cron job may have encountered an error",
            vercelDashboardLink: "https://vercel.com/dashboard",
            monitoringNotes: {
                expectedInterval: "Every 7 days",
                maxAllowedDaysSinceHeartbeat: 10,
                action: "If daysSinceLastHeartbeat > 10, check Vercel Functions tab for errors"
            }
        });

    } catch (error) {
        return NextResponse.json(
            {
                status: "error",
                message: "Cannot reach Redis",
                error: String(error)
            },
            { status: 500 }
        );
    }
}
