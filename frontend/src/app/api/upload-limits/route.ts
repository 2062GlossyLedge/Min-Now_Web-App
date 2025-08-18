import 'server-only'

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ratelimit } from "@/server/ratelimit";

export async function GET() {
    try {
        const user = await auth();

        if (!user.userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Use the actual rate limiter to get accurate status
        // This will consume 1 token, but gives us the true state
        const { limit, remaining, reset } = await ratelimit.fileUpload.limit(user.userId);

        const uploadsUsed = limit - remaining;
        const uploadsTotal = limit;
        const uploadsRemaining = remaining;

        return NextResponse.json({
            uploads_remaining: uploadsRemaining,
            uploads_total: uploadsTotal,
            uploads_used: uploadsUsed,
            can_upload: uploadsRemaining > 0,
            reset_time: reset,
            reset_date: new Date(reset).toISOString(),
            method: "rate_limiter_direct"
        });


    } catch (error) {
        console.error("Error checking upload limits:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
