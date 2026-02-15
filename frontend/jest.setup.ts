// jest.setup.ts
// This file runs before each test file

// Mock environment variables
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8000';

// Mock fetch globally
global.fetch = jest.fn();

// Mock window.navigator for browser-specific tests
Object.defineProperty(global, 'navigator', {
    value: {
        userAgent: 'node.js',
    },
    writable: true,
});
