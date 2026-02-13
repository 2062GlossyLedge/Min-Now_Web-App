import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensures that Clerk setup is done before any tests run
setup.describe.configure({
    mode: "serial",
});

setup("global setup", async () => {
    await clerkSetup();
    if (
        !process.env.CLERK_USER_USERNAME ||
        !process.env.CLERK_USER_PASSWORD
    ) {
        throw new Error(
            "Please provide CLERK_USER_USERNAME and CLERK_USER_PASSWORD environment variables."
        );
    }
});

const authFile = path.join(__dirname, "../playwright/.clerk/user.json");

setup("authenticate", async ({ page }) => {
    await page.goto(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000");
    await clerk.signIn({
        page,
        signInParams: {
            strategy: "password",
            identifier: process.env.CLERK_USER_USERNAME!,
            password: process.env.CLERK_USER_PASSWORD!,
        },
    });
    // await page.goto("/protected");
    // await page.waitForSelector("h1:has-text('This is a PROTECTED page')");

    await page.context().storageState({ path: authFile });
});