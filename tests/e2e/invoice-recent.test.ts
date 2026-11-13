import { test, expect } from '@playwright/test';

/**
 * Previous invoices on the new-invoice form.
 *
 * Picking a client shows their most recent invoices (served by
 * /api/clients/[id]/invoices), with the last one's line items and a button
 * to copy those items into the new invoice.
 */

const CLIENT_NAME = `Recent-Client-${Date.now()}`;
const ITEM_DESCRIPTION = `Monthly maintenance ${Date.now()}`;

test.describe('Previous invoices on new invoice form', () => {
	test.describe.configure({ mode: 'serial' });

	let clientId: string;

	test.beforeAll(async ({ browser }) => {
		const page = await browser.newPage();
		await page.goto('/clients');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: /New Client/i }).click();
		await page.getByLabel(/^Name/i).fill(CLIENT_NAME);
		await page.getByRole('button', { name: /Save Client/i }).click();
		await page.waitForURL(/\/clients\/[^?]+/);
		clientId = new URL(page.url()).pathname.split('/').pop()!;
		await page.close();
	});

	test('API returns an empty list for a client with no invoices', async ({ page }) => {
		const res = await page.request.get(`/api/clients/${clientId}/invoices`);
		expect(res.ok()).toBe(true);
		expect(await res.json()).toEqual({ invoices: [] });
	});

	test('API returns an empty list for an unknown client', async ({ page }) => {
		const res = await page.request.get('/api/clients/doesnotexist123/invoices');
		expect(res.ok()).toBe(true);
		expect(await res.json()).toEqual({ invoices: [] });
	});

	test('form says when the client has no previous invoices', async ({ page }) => {
		await page.goto('/invoices/new');
		await page.waitForLoadState('networkidle');
		await expect(page.getByRole('region', { name: 'Previous invoices' })).toHaveCount(0);

		await page.getByLabel('Client *', { exact: true }).selectOption({ label: CLIENT_NAME });
		const panel = page.getByRole('region', { name: 'Previous invoices' });
		await expect(panel.getByText(`No previous invoices for ${CLIENT_NAME}.`)).toBeVisible();
	});

	test('API returns the invoice with its line items and total', async ({ page }) => {
		test.setTimeout(60_000);
		await page.goto('/invoices/new');
		await page.waitForLoadState('networkidle');
		await page.getByLabel('Client *', { exact: true }).selectOption({ label: CLIENT_NAME });
		await page.getByRole('textbox', { name: 'Item description' }).first().fill(ITEM_DESCRIPTION);
		await page.getByRole('spinbutton', { name: 'Hours', exact: true }).first().fill('3');
		await page.getByRole('spinbutton', { name: 'Rate', exact: true }).first().fill('150');
		await page.getByRole('button', { name: /Create Invoice/i }).click();
		await page.waitForURL(
			(url) => url.pathname.startsWith('/invoices/') && url.pathname !== '/invoices/new',
			{ timeout: 30_000 }
		);

		const res = await page.request.get(`/api/clients/${clientId}/invoices`);
		const { invoices } = await res.json();
		expect(invoices).toHaveLength(1);
		expect(invoices[0].items).toEqual([
			expect.objectContaining({ quantity: 3, unit_price: 150 })
		]);
		expect(invoices[0].items[0].description).toContain(ITEM_DESCRIPTION);
		expect(invoices[0].total).toBeGreaterThanOrEqual(450);
	});

	test('form shows the last invoice and copies its line items', async ({ page }) => {
		await page.goto(`/invoices/new?client=${clientId}`);
		await page.waitForLoadState('networkidle');

		const panel = page.getByRole('region', { name: 'Previous invoices' });
		const last = panel.getByRole('article', { name: /^Last invoice/ });
		await expect(last).toBeVisible();
		await expect(last.getByText(ITEM_DESCRIPTION)).toBeVisible();
		await expect(last.getByText('Draft')).toBeVisible();

		await last.getByRole('button', { name: 'Copy line items' }).click();

		// The blank starting row is replaced, not appended to
		const descriptions = page.getByRole('textbox', { name: 'Item description' });
		await expect(descriptions).toHaveCount(1);
		await expect(descriptions.first()).toContainText(ITEM_DESCRIPTION);
		await expect(page.getByRole('spinbutton', { name: 'Hours', exact: true }).first()).toHaveValue('3');
		await expect(page.getByRole('spinbutton', { name: 'Rate', exact: true }).first()).toHaveValue('150');

		// Copying again appends, since the form now has content
		await last.getByRole('button', { name: 'Copy line items' }).click();
		await expect(descriptions).toHaveCount(2);
	});
});
