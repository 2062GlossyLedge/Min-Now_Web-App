import 'server-only'

import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { ratelimit } from "@/server/ratelimit";

const f = createUploadthing();

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


// FileRouter for your app, can contain multiple FileRoutes
export const ourFileRouter = {
    // Define as many FileRoutes as you like, each with a unique routeSlug
    // Only allows image uploads

    imageUploader: f({
        image: {
            /**
             * For full list of options and defaults, see the File Route API reference
             * @see https://docs.uploadthing.com/file-routes#route-config
             */
            maxFileSize: "4MB",
            maxFileCount: 1,

        },
    })
        // Set permissions and file types for this FileRoute
        .middleware(async ({ }) => {
            // This code runs on your server before upload
            const user = await auth();

            // If you throw, the user will not be able to upload
            if (!user.userId) throw new UploadThingError("Unauthorized");

            // Check if user is admin - admins bypass rate limits
            const isAdmin = await isUserAdmin(user.userId);

            if (!isAdmin) {
                // Check rate limit status without consuming tokens first
                // We use a direct Redis check to avoid consuming tokens in middleware
                const { Redis } = await import("@upstash/redis");
                const redis = Redis.fromEnv();

                const key = `@upstash/ratelimit/file-upload:${user.userId}`;
                const now = Date.now();
                const windowStart = now - (24 * 60 * 60 * 1000); // 24 hours ago

                try {
                    // Count current uploads in the sliding window
                    const tokensUsed = await redis.zcount(key, windowStart, now);
                    if (tokensUsed >= 40) {
                        throw new UploadThingError(`Rate limit exceeded. You can only upload 40 files per day. You have used ${tokensUsed}/40 uploads. Please try again tomorrow.`);
                    }
                } catch (error) {
                    // If Redis check fails, allow upload but it will be rate limited in onUploadComplete
                    console.warn("Rate limit check failed in middleware:", error);
                }
            }

            // Whatever is returned here is accessible in onUploadComplete as `metadata`
            return { userId: user.userId, isAdmin };
        })
        .onUploadComplete(async ({ metadata, file }) => {
            // This code RUNS ON YOUR SERVER after upload
            console.log("Upload complete for userId:", metadata.userId);

            // Only consume rate limit token for non-admin users
            if (!metadata.isAdmin) {
                await ratelimit.fileUpload.limit(metadata.userId);
            } else {
                console.log("Admin user - bypassing rate limit");
            }

            console.log("file url", file.ufsUrl);

            console.log("file key", file.key);

            // !!! Whatever is returned here is sent to the clientside `onClientUploadComplete` callback
            return { uploadedBy: metadata.userId };
        }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
