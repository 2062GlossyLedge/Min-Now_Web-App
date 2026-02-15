import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    timeout: 30000,
    use: {
        baseURL: process.env.NEXT_PUBLIC_API_URL,
        trace: 'retry-on-trace',

    },

    reporter: 'html',
    projects: [
        {
            // run global setup before all tests to authenticate first
            name: "global setup",
            testMatch: /global\.setup\.ts/,
        },
        {
            name: "Test Item Tests",
            testMatch: /test-item\.spec\.ts/,
            use: {
                ...devices['Desktop Chrome'],
                storageState: 'playwright/.clerk/user.json',
            },
            dependencies: ['global setup'],
        },
        {
            name: "API Routes Tests",
            testMatch: /api-routes\.spec\.ts/,
            use: {
                ...devices['Desktop Chrome'],
                storageState: 'playwright/.clerk/user.json',
            },
            dependencies: ['global setup'],
        }
    ],
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true, // This allows tests to run with existing dev server
    },
}); 