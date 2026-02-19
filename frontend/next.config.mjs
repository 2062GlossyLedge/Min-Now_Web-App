// to see build time speed up whe working with large code repo.
// Cehcks errors instead using github actions

/** @type {import("next").NextConfig} */
const config = {
  // Vercel Cron Jobs Configuration
  // Prevents Upstash Redis from auto-deactivating due to inactivity
  // see vercel.json for moved heartbeat

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.ufs.sh",
      },
      {
        protocol: "https",
        hostname: "utfs.io",
      },
    ],
    // Compress jpg and png images for faster img loads
    formats: ["image/webp", "image/avif"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    minimumCacheTTL: 60,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: "/api/:slug*",
        destination: `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/:slug*`,
      },
      {
        source: "/django-api/:slug*",
        destination: `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/django-api/:slug*`,
      },
      //proxies routes from post hog to be from this sites domain to avoid ad blockers and CORS issues.
      // {
      //     source: "/ingest/static/:path*",
      //     destination: "https://us-assets.i.posthog.com/static/:path*",
      // },
      // {
      //     source: "/ingest/:path*",
      //     destination: "https://us.i.posthog.com/:path*",
      // },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          //already set in django settings.py. caution as this could affect local development
          // {
          //     key: 'Strict-Transport-Security',
          //     value: 'max-age=63072000; includeSubDomains; preload'
          // },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Permissions-Policy",
            value:
              "accelerometer=(), autoplay=(), camera=(), cross-origin-isolated=(), display-capture=(), encrypted-media=(), fullscreen=(), geolocation=(), gyroscope=(), keyboard-map=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), sync-xhr=(), usb=(), web-share=(), xr-spatial-tracking=()",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default config;
