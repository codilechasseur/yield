import { test, expect } from '@playwright/test';

/**
 * Invoice numbering E2E tests.
 *
 * The suggested number on /invoices/new must skip numbers that already exist,
 * so accepting the suggestion twice in a row creates two invoices rather than
 * failing on the unique number index.
 */

const CLIENT_NAME = `Numbering-Client-${Date.now()}`;

test.describe('Invoice numbering', () => {
	test.describe.configure({ mode: 'serial' });

	test.beforeAll(async ({ browser }) => {
		const page = await browser.newPage();
		await page.goto('/clients');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: /New Client/i }).click();
		await page.getByLabel(/^Name/i).fill(CLIENT_NAME);
		await page.getByRole('button', { name: /Save Client/i }).click();
		await page.waitForURL(/\/clients\/[^?]+/);
		await page.close();
	});

	test('accepting the suggested number twice creates two distinct invoices', async ({ page }) => {
		test.setTimeout(60_000);
		// Accept the suggested number both times (the second suggestion is taken
		// by the time it's shown only if something else raced us; either way the
		// save must succeed with a free number).
		const ids: string[] = [];
		for (let i = 0; i < 2; i++) {
			await page.goto('/invoices/new');
			await page.waitForLoadState('networkidle');
			await page.getByLabel('Client *', { exact: true }).selectOption({ label: CLIENT_NAME });
			await page.getByRole('button', { name: /Create Invoice/i }).click();
			await page.waitForURL(
				(url) => url.pathname.startsWith('/invoices/') && url.pathname !== '/invoices/new',
				{ timeout: 30_000 }
			);
			ids.push(page.url().split('/').pop()!);
		}
		expect(ids[0]).not.toBe(ids[1]);

		// Both show up for the client, with different numbers
		await page.goto('/invoices');
		await page.waitForLoadState('networkidle');
		const rows = page.getByRole('row').filter({ hasText: CLIENT_NAME });
		await expect(rows).toHaveCount(2);
		const numbers = await rows.getByRole('link').filter({ hasNotText: 'PDF' }).allInnerTexts();
		expect(new Set(numbers).size).toBe(2);
	});
});
