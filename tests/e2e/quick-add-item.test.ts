import { test, expect } from '@playwright/test';

/**
 * Quick Add Item E2E tests.
 *
 * Creates a client and optionally a draft invoice through the app, then
 * exercises the Quick Add Item dialog from the sidebar.
 */

const CLIENT_NAME = `QAI-Client-${Date.now()}`;

test.describe('Quick Add Item', () => {
	test.describe.configure({ mode: 'serial' });

	let clientId: string;
	let invoiceId: string;

	test.beforeAll(async ({ browser }) => {
		// Create a client via the UI
		const page = await browser.newPage();
		await page.goto('/clients');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: /New Client/i }).click();
		await page.getByLabel(/^Name/i).fill(CLIENT_NAME);
		await page.getByRole('button', { name: /Save Client/i }).click();
		await page.waitForURL(/\/clients\/[^?]+/);
		clientId = page.url().split('/').pop()!;

		// Create a draft invoice via the UI
		await page.goto('/invoices/new');
		await page.waitForLoadState('networkidle');
		await page.getByLabel('Client *', { exact: true }).selectOption({ label: CLIENT_NAME });
		await page.getByRole('button', { name: /Create Invoice/i }).click();
		await page.waitForURL(/\/invoices\/[^?]+/);
		invoiceId = page.url().split('/').pop()!;

		await page.close();
	});

	test('"Quick Add Item" button is visible in the sidebar', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		await expect(page.getByRole('button', { name: /Quick Add Item/i })).toBeVisible();
	});

	test('clicking Quick Add Item opens the dialog', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: /Quick Add Item/i }).click();
		await expect(page.getByRole('dialog', { name: /Quick Add Line Item/i })).toBeVisible();
	});

	test('dialog shows the draft invoice in the selector', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: /Quick Add Item/i }).click();

		const dialog = page.getByRole('dialog', { name: /Quick Add Line Item/i });
		await expect(dialog).toBeVisible();
		// The draft invoice should be listed (client name + invoice number)
		await expect(dialog.getByLabel(/Invoice/i)).toContainText(CLIENT_NAME);
	});

	test('can add a line item to an existing draft invoice', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: /Quick Add Item/i }).click();

		const dialog = page.getByRole('dialog', { name: /Quick Add Line Item/i });
		await expect(dialog).toBeVisible({ timeout: 10000 });

		// Select our draft invoice
		await dialog.getByLabel(/Invoice/i).selectOption({ value: invoiceId });

		// Fill in the line item
		await dialog.getByLabel(/Description/i).fill('Website development work');
		await dialog.getByLabel(/Quantity/i).fill('2');
		await dialog.getByLabel(/Unit Price/i).fill('150');

		// Submit
		await dialog.getByRole('button', { name: /Add to Invoice/i }).click();

		// Dialog should close and a success toast should appear
		await expect(dialog).not.toBeVisible({ timeout: 10000 });

		// Verify the item was recorded by navigating to the invoice
		await page.goto(`/invoices/${invoiceId}`);
		await page.waitForLoadState('networkidle');
		await expect(page.getByText('Website development work')).toBeVisible({ timeout: 10000 });
	});

	test('can create a new invoice and add a line item in one step', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: /Quick Add Item/i }).click();

		const dialog = page.getByRole('dialog', { name: /Quick Add Line Item/i });
		await expect(dialog).toBeVisible({ timeout: 10000 });

		// Select "New Invoice" option
		await dialog.getByLabel(/Invoice/i).selectOption({ value: '__new__' });

		// Client selector should now be visible
		const clientSelect = dialog.getByLabel(/Client/i);
		await expect(clientSelect).toBeVisible();
		await clientSelect.selectOption({ label: CLIENT_NAME });

		// Fill in the line item
		await dialog.getByLabel(/Description/i).fill('Strategy consulting');
		await dialog.getByLabel(/Quantity/i).fill('3');
		await dialog.getByLabel(/Unit Price/i).fill('200');

		// Submit
		await dialog.getByRole('button', { name: /Add to Invoice/i }).click();

		// Dialog should close
		await expect(dialog).not.toBeVisible({ timeout: 10000 });

		// A new draft invoice should now exist — confirm on the invoices list
		await page.goto('/invoices?status=draft');
		await page.waitForLoadState('networkidle');
		await expect(page.getByText(CLIENT_NAME).first()).toBeVisible({ timeout: 10000 });
	});

	test('shows an error when submitting without a description', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: /Quick Add Item/i }).click();

		const dialog = page.getByRole('dialog', { name: /Quick Add Line Item/i });
		await expect(dialog).toBeVisible({ timeout: 10000 });

		// Wait for invoices to load and select one
		await expect(dialog.getByLabel(/Invoice/i)).not.toHaveValue('', { timeout: 10000 });

		// Submit without filling in description
		await dialog.getByRole('button', { name: /Add to Invoice/i }).click();

		// Error message should be visible inside the dialog
		await expect(dialog.getByRole('alert')).toContainText(/Description is required/i);
		// Dialog should remain open
		await expect(dialog).toBeVisible();
	});

	test('dialog can be closed with the Cancel button', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: /Quick Add Item/i }).click();

		const dialog = page.getByRole('dialog', { name: /Quick Add Line Item/i });
		await expect(dialog).toBeVisible({ timeout: 10000 });

		await dialog.getByRole('button', { name: /Cancel/i }).click();
		await expect(dialog).not.toBeVisible({ timeout: 5000 });
	});
});
