import { test as setup, expect } from '@playwright/test';

export const AUTH_FILE = 'tests/e2e/.auth/user.json';

const TEST_PASSWORD = process.env.APP_PASSWORD || 'testpassword123';

setup('authenticate', async ({ page }) => {
	await page.goto('/');

	// Case 1: redirected to /setup — no password configured yet
	if (page.url().includes('/setup')) {
		await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD);
		await page.getByLabel('Confirm password').fill(TEST_PASSWORD);
		await page.getByRole('button', { name: /Set password/i }).click();
		// After setup we're redirected to /login
		await expect(page).toHaveURL(/\/login/);
	}

	// Case 2: redirected to /login — password already configured, just log in
	if (page.url().includes('/login')) {
		await page.getByLabel(/Password/i).fill(TEST_PASSWORD);
		await page.getByRole('button', { name: /Sign in/i }).click();
		await expect(page).toHaveURL('/');
	}

	// Save the authenticated browser state
	await page.context().storageState({ path: AUTH_FILE });
});
