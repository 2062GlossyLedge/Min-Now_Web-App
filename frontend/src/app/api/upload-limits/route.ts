import 'server-only'

import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ratelimit } from "@/server/ratelimit";

// Helper function to check if user is admin
const isUserAdmin = async (userId: string): Promise<boolean> => {
    try {
        const client = await clerkClient();
        const user = await client.users.getUser(userId);
        return (user.publicMetadata as any)?.['is-admin'] === true;
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
};

export async function GET() {
    try {
        const user = await auth();

        if (!user.userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check if user is admin - admins bypass rate limits
        const isAdmin = await isUserAdmin(user.userId);

        if (isAdmin) {
            // Admin users have unlimited uploads
            return NextResponse.json({
                uploads_remaining: 999999,
                uploads_total: 999999,
                uploads_used: 0,
                can_upload: true,
                reset_time: 0,
                reset_date: new Date(0).toISOString(),
                method: "admin_bypass",
                is_admin: true
            });
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
            method: "rate_limiter_direct",
            is_admin: false
        });


    } catch (error) {
        console.error("Error checking upload limits:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
