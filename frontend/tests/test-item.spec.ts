import { test, expect } from '@playwright/test';

test.describe('Test Item Creation', () => {

    test.use({ storageState: 'playwright/.clerk/user.json' });

    test('should create a test item successfully', async ({ page }) => {
        // Navigate to the keep page
        await page.goto('/keep');

        // Wait for the page to load completely
        await page.waitForLoadState('networkidle');

        // Wait for the test item button to be visible and clickable
        const testItemButton = page.getByRole('button', { name: /Create Test Item/i });
        await testItemButton.waitFor({ state: 'visible' });
        await testItemButton.click();

        // Wait for the item creation request to complete
        await page.waitForLoadState('networkidle');

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