import { test, expect } from '@playwright/test';
import { clerk, setupClerkTestingToken } from '@clerk/testing/playwright';

test.describe('Test Item Creation', () => {

    test.use({ storageState: 'playwright/.clerk/user.json' });

    test('should create a test item successfully', async ({ page }) => {

        //prevent failure from bot detecction 
        await setupClerkTestingToken({ page });

        // Navigate to protected route - this triggers redirect to Clerk sign-in
        await page.goto('/keep');
        await page.waitForLoadState('networkidle');

        //sign in if storage state is not valid or expired
        if (page.url().includes('/sign-in')) {
            // Sign in via Clerk
            await clerk.signIn({
                page,
                signInParams: {
                    strategy: "password",
                    identifier: process.env.CLERK_USER_USERNAME!,
                    password: process.env.CLERK_USER_PASSWORD!,
                },
            });
            await page.waitForLoadState('networkidle');
        }

        // Clear onboarding completion state to force tutorial to show
        await page.evaluate(() => {
            localStorage.removeItem('onboarding_completed');
            localStorage.removeItem('onboarding_step');
        });

        // Reload to apply onboarding state reset
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Wait for and dismiss tutorial overlay - use .last() to handle duplicates - prone to errors if buttons don't render in order every time
        const skipTutorialButton = page.getByRole('button', { name: /skip tutorial/i }).last();
        await skipTutorialButton.waitFor({ state: 'visible', timeout: 5000 });
        await skipTutorialButton.click();
        await page.waitForTimeout(1500);

        // Wait for Create Test Item button to be fully interactive (not blocked by overlays)
        const testItemButton = page.getByRole('button', { name: /Create Test Item/i });

        // Scroll into view and ensure it's ready
        await testItemButton.scrollIntoViewIfNeeded();
        await testItemButton.waitFor({ state: 'visible' });

        // Wait a moment for any animations/transitions to complete
        await page.waitForTimeout(500);

        // Click without force - let Playwright ensure it's clickable
        await testItemButton.click();

        // Wait for the item creation request to complete
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        // Verify that the test item appears in the list with all its properties
        const testItemCard = page.getByText('Test Item').first();
        await expect(testItemCard).toBeVisible();

        // Verify the item type
        const itemType = page.getByText('Technology').first();
        await expect(itemType).toBeVisible();

        // Verify the status
        const status = page.getByText('Keep').first();
        await expect(status).toBeVisible();


    });
}); 