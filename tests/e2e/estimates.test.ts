import { test, expect } from '@playwright/test';

/**
 * Estimates E2E tests.
 *
 * Works against a clean database — creates a client first, then exercises
 * create / view / edit / status-change flows for estimates.
 */

const CLIENT_NAME = `EstimateE2E-${Date.now()}`;
let estimateUrl = '';

test.describe('Estimates', () => {
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

	test('estimates list page is accessible from nav', async ({ page }) => {
		await page.goto('/estimates');
		await page.waitForLoadState('networkidle');
		await expect(page).toHaveTitle(/Estimates/i);
	});

	test('can create a new estimate', async ({ page }) => {
		await page.goto('/estimates/new');
		await page.waitForLoadState('networkidle');

		// Pick the client
		await page.getByLabel(/Client/i).selectOption({ label: CLIENT_NAME });

		// Add a line item description
		await page.getByLabel(/Item description/i).first().fill('Web design services');

		// Submit
		await page.getByRole('button', { name: /Create Estimate/i }).click();

		// Should redirect to the estimate detail page
		await page.waitForURL(/\/estimates\/[^/]+$/);
		estimateUrl = page.url();

		await expect(page.getByText(CLIENT_NAME)).toBeVisible();
		await expect(page.getByText('Web design services')).toBeVisible();
	});

	test('estimate detail page shows status badge', async ({ page }) => {
		await page.goto(estimateUrl);
		await page.waitForLoadState('networkidle');
		await expect(page.getByText(/Draft/i).first()).toBeVisible();
	});

	test('can mark estimate as accepted', async ({ page }) => {
		await page.goto(estimateUrl);
		await page.waitForLoadState('networkidle');

		// Open the action menu and mark accepted
		await page.getByLabel(/More actions/i).click();
		await page.getByRole('button', { name: /Mark Accepted/i }).first().click();

		await page.waitForLoadState('networkidle');
		await expect(page.getByText(/Accepted/i).first()).toBeVisible({ timeout: 10000 });
	});

	test('can mark estimate as declined', async ({ page }) => {
		// Start from accepted; mark declined via menu
		await page.goto(estimateUrl);
		await page.waitForLoadState('networkidle');

		await page.getByLabel(/More actions/i).click();
		await page.getByRole('button', { name: /Mark Declined/i }).first().click();

		await page.waitForLoadState('networkidle');
		await expect(page.getByText(/Declined/i).first()).toBeVisible({ timeout: 10000 });
	});

	test('can move estimate back to draft', async ({ page }) => {
		await page.goto(estimateUrl);
		await page.waitForLoadState('networkidle');

		await page.getByLabel(/More actions/i).click();
		await page.getByRole('button', { name: /Mark as Draft/i }).first().click();

		await page.waitForLoadState('networkidle');
		await expect(page.getByText(/Draft/i).first()).toBeVisible({ timeout: 10000 });
	});

	test('can edit the estimate', async ({ page }) => {
		await page.goto(estimateUrl + '/edit');
		await page.waitForLoadState('networkidle');

		await expect(page.getByRole('heading', { name: /Edit Estimate/i })).toBeVisible();

		// Change tax percentage
		await page.getByLabel(/Tax/i).fill('10');

		await page.getByRole('button', { name: /Save Changes/i }).click();
		await page.waitForURL(/\/estimates\/[^/]+$/);
	});

	test('estimates list shows created estimate', async ({ page }) => {
		await page.goto('/estimates');
		await page.waitForLoadState('networkidle');
		await expect(page.getByText(CLIENT_NAME)).toBeVisible({ timeout: 10000 });
	});

	test('can add an internal note', async ({ page }) => {
		await page.goto(estimateUrl);
		await page.waitForLoadState('networkidle');

		await page.getByLabel(/Add note/i).fill('Internal review required');
		await page.getByRole('button', { name: /Add Note/i }).click();

		await page.waitForLoadState('networkidle');
		await expect(page.getByText('Internal review required')).toBeVisible({ timeout: 10000 });
	});

	test('convert to invoice flow', async ({ page }) => {
		// Accept the estimate first, then convert
		await page.goto(estimateUrl);
		await page.waitForLoadState('networkidle');

		// Mark accepted
		await page.getByLabel(/More actions/i).click();
		await page.getByRole('button', { name: /Mark Accepted/i }).first().click();
		await page.waitForLoadState('networkidle');

		// Convert to invoice
		await page.getByRole('button', { name: /Create Invoice/i }).first().click();

		// Should redirect to new invoice
		await page.waitForURL(/\/invoices\/[^/]+$/, { timeout: 20000 });
		await expect(page).toHaveURL(/\/invoices\//);
		await expect(page.getByText('Web design services')).toBeVisible({ timeout: 10000 });
	});
});
