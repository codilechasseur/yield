import { test, expect } from '@playwright/test';

/**
 * Invoice detail page E2E tests.
 */

const CLIENT_NAME = `Detail-Client-${Date.now()}`;

test.describe('Invoice detail', () => {
	test.describe.configure({ mode: 'serial' });

	let invoiceUrl = '';

	test.beforeAll(async ({ browser }) => {
		const page = await browser.newPage();
		await page.goto('/clients');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: /New Client/i }).click();
		await page.getByLabel(/^Name/i).fill(CLIENT_NAME);
		await page.getByRole('button', { name: /Save Client/i }).click();
		await page.waitForURL(/\/clients\/[^?]+/);

		await page.goto('/invoices/new');
		await page.waitForLoadState('networkidle');
		await page.getByLabel('Client *', { exact: true }).selectOption({ label: CLIENT_NAME });
		await page.getByRole('button', { name: /Create Invoice/i }).click();
		await page.waitForURL(
			(url) => url.pathname.startsWith('/invoices/') && url.pathname !== '/invoices/new',
			{ timeout: 30_000 }
		);
		invoiceUrl = page.url();
		await page.close();
	});

	test('Edit is reachable directly from the toolbar', async ({ page }) => {
		await page.goto(invoiceUrl);
		await page.waitForLoadState('networkidle');
		await page.getByRole('link', { name: /^Edit$/ }).click();
		await page.waitForURL(/\/invoices\/[^/]+\/edit$/);
		await expect(page.getByRole('heading', { name: /Edit Invoice/i })).toBeVisible();
	});
});
