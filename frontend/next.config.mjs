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
}

export default config
