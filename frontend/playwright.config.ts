import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    timeout: 10000,
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
        // {
        //     name: "chromium",
        //     use: { ...devices['Desktop Chrome'] },
        // },
        {
            name: "Main Tests",
            testMatch: /test-item\.spec\.ts/,
            use: {
                ...devices['Desktop Chrome'],
                // Update the path to match where we're saving it
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