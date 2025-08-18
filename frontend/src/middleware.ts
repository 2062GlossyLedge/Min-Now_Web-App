import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'


const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)'])

export default clerkMiddleware(
    async (auth, request) => {
        const { pathname } = request.nextUrl;

        // Completely skip middleware for these paths
        //CSP not applied to these routes
        if (
            pathname.startsWith('/api/') ||
            pathname.startsWith('/_next/') ||
            pathname.includes('Min-NowDarkLogoCropped.ico') ||
            pathname.includes('Min-NowDarkLogoCropped.jpg') ||
            pathname.includes('gaveBadge2.png') ||
            pathname.includes('itemCheckup4.png') ||
            pathname.includes('keepBadge.png') ||
            pathname.includes('ownedItemExpanded3.png') ||
            pathname.includes('ownedItems2.png') ||
            pathname.endsWith('.jpg')
            //pathname.includes('.') // Skip all other files with extensions
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
                    'https://sea1.ingest.uploadthing.com',
                    'https://utfs.io',
                    'https://*.ufs.sh',
                    'https://uploadthing.com',
                    'https://*.uploadthing.com'
                ],
                'img-src': [
                    'self',
                    'https://sea1.ingest.uploadthing.com',
                    'https://utfs.io',
                    'https://*.ufs.sh'
                ]
            },
        },
    }
)


export const config = {
    matcher: [
        // /*
        //     * Match all request paths except for the ones starting with:
        //     * - api (API routes)
        //     * - _next/static (static files)
        //     * - _next/image (image optimization files)
        //     * - favicon.ico (favicon file)
        //     */
        // {
        //     source: '/((?!api|_next/static|_next/image|Min-NowDarkLogoCropped.ico|Min-NowDarkLogoCropped.jpg|gaveBadge2.png|itemCheckup4.png|keepBadge.png|ownedItemExpanded3.png|ownedItems2.png).*)',
        //     // Always run for API routes
        //     missing: [
        //         { type: 'header', key: 'next-router-prefetch' },
        //         { type: 'header', key: 'purpose', value: 'prefetch' },
        //     ],
        // },
        // '/(api|trpc)(.*)',
        //above approach did not exlude the api call /api/uploadthing to run through middleware, causing csp to block uploadthing callbacks to local host
        //middleware runs on all routes
        "/(.*)",
    ]
}

//next js manual csp approach

//import { NextRequest, NextResponse } from 'next/server'

// export function middleware(request: NextRequest) {
//     // Generate a nonce for Content Security Policy (CSP)
//     const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
//     const isDev = process.env.NEXT_PUBLIC_PROD_FE !== 'true'
//     const cspHeader = `
//     default-src 'self';
//     script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${isDev ? "'unsafe-eval'" : ''};
//     style-src 'self' 'nonce-${nonce}' ${isDev ? "'unsafe-inline'" : ''};
//     img-src 'self' blob: data:;
//     font-src 'self';
//     object-src 'none';
//     base-uri 'self';
//     form-action 'self';
//     frame-ancestors 'none';
//     upgrade-insecure-requests;
// `
//     // Replace newline characters and spaces
//     const contentSecurityPolicyHeaderValue = cspHeader
//         .replace(/\s{2,}/g, ' ')
//         .trim()

//     const requestHeaders = new Headers(request.headers)
//     requestHeaders.set('x-nonce', nonce)

//     requestHeaders.set(
//         'Content-Security-Policy',
//         contentSecurityPolicyHeaderValue
//     )

//     const response = NextResponse.next({
//         request: {
//             headers: requestHeaders,
//         },
//     })
//     response.headers.set(
//         'Content-Security-Policy',
//         contentSecurityPolicyHeaderValue
//     )

//     return response
// }