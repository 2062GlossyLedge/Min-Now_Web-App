// clerk with csp setup: https://clerk.com/docs/guides/secure/best-practices/csp-headers#default-configuration
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'


const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)', '/'])

export default clerkMiddleware(
    async (auth, request) => {
        const { pathname } = request.nextUrl;

        // Completely skip middleware for these paths to avoid being redirected to clerk auth domain auth checker
        //CSP not applied to these routes
        if (
            pathname.startsWith('/api/') ||
            pathname.startsWith('/_next/')
            //post hog ingest routes  
            //pathname.startsWith('/ingest/') ||
            // Static files from /public folder (images, fonts, etc)
            // pathname.includes('Min-NowDarkLogoCropped.ico') ||
            // pathname.includes('Min-NowDarkLogoCropped.jpg') ||
            // pathname.includes('gaveBadge2.png') ||
            // pathname.includes('itemCheckup4.png') ||
            // pathname.includes('keepBadge.png') ||
            // pathname.includes('ownedItemExpanded3.png') ||
            // pathname.includes('ownedItems2.png')

        ) {
            return;
        }

        if (!isPublicRoute(request)) {
            await auth.protect()
        }
    },
    {
        contentSecurityPolicy: {
            strict: true,
            directives: {
                'connect-src': [
                    'self',

                    //production domain for clerk auth handling
                    'https://accounts.min-now.store/*', 'https://sea1.ingest.uploadthing.com',
                    'https://utfs.io',
                    'https://*.ufs.sh',
                    'https://uploadthing.com',
                    'https://*.uploadthing.com',
                    'https://accounts.min-now.store', 'https://us.i.posthog.com',
                    'https://us-assets.i.posthog.com',
                    'https://app.posthog.com',
                    //clerk sign in page in dev
                    'https://teaching-sturgeon-25.accounts.dev/*',
                    //clerk sign in page in prod
                    'https://accounts.min-now.store/*'


                ],
                'img-src': [
                    'self',
                    'https://www.min-now.store/*',
                    'https://sea1.ingest.uploadthing.com',
                    'https://utfs.io',
                    'https://*.ufs.sh',
                    'https://teaching-sturgeon-25.accounts.dev',
                    'https://accounts.min-now.store/*',
                ]
            },
        },
    }
)


