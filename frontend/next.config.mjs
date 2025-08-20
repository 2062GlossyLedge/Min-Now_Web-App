/** @type {import('next').NextConfig} */
// const nextConfig = {
//     distDir: './dist', // Changes the build output directory to `./dist/`.
// }


// to see build time speed up whe working with large code repo. 
// Cehcks errors instead using github actions

/** @type {import("next").NextConfig} */
const config = {

    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**.ufs.sh',
            },
            {
                protocol: 'https',
                hostname: 'utfs.io',
            },
        ],
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
    async rewrites() {
        return [
            {
                source: '/api/:slug*',
                destination: `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/:slug*`,
            },
            {
                source: '/django-api/:slug*',
                destination: `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/django-api/:slug*`,
            },

        ]
    },
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'X-DNS-Prefetch-Control',
                        value: 'on'
                    },
                    //already set in django settings.py. caution as this could affect local development
                    // {
                    //     key: 'Strict-Transport-Security',
                    //     value: 'max-age=63072000; includeSubDomains; preload'
                    // },
                    {
                        key: 'X-Frame-Options',
                        value: 'SAMEORIGIN'
                    },
                    {
                        key: 'Permissions-Policy',
                        value: 'accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), camera=(), cross-origin-isolated=(), display-capture=(), document-domain=(), encrypted-media=(), execution-while-not-rendered=(), execution-while-out-of-viewport=(), fullscreen=(), geolocation=(), gyroscope=(), keyboard-map=(), magnetometer=(), microphone=(), midi=(), navigation-override=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), sync-xhr=(), usb=(), web-share=(), xr-spatial-tracking=()'
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff'
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'origin-when-cross-origin'
                    },




                ],
            },
        ]
    }
}

// module.exports = {
// }

export default config
