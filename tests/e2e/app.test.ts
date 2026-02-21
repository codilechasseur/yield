import { test, expect } from '@playwright/test';

// These E2E tests assume:
//  - PocketBase is running with the schema applied (pb_setup.js has been run)
//  - No app password is configured, so the login page redirects to /
//  - The DB is empty (no clients, no invoices)

test.describe('Dashboard', () => {
	test('home page loads and shows stat cards', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveURL('/');

		// Stat card headings are always rendered regardless of data
		await expect(page.getByText('Outstanding')).toBeVisible();
		await expect(page.getByText('Overdue')).toBeVisible();
	});

	test('page title includes Yield', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveTitle(/Yield/i);
	});
});

test.describe('Invoices', () => {
	test('invoices page loads', async ({ page }) => {
		await page.goto('/invoices');
		await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible();
	});

	test('"New Invoice" link is visible', async ({ page }) => {
		await page.goto('/invoices');
		// Two links exist (sidebar + page header) — assert at least one is visible
		await expect(page.getByRole('link', { name: /New Invoice/i }).first()).toBeVisible();
	});

	test('navigating to New Invoice page loads the form', async ({ page }) => {
		await page.goto('/invoices/new');
		// Client selector is always visible on load (invoice number is behind "advanced" toggle)
		await expect(page.getByLabel(/Client/i)).toBeVisible();
	});
});

test.describe('Clients', () => {
	test('clients page loads', async ({ page }) => {
		await page.goto('/clients');
		// Page should have the Clients heading
		await expect(page.getByRole('heading', { name: /Clients/i })).toBeVisible();
	});
});

test.describe('Navigation', () => {
	test('nav links are present on the dashboard', async ({ page }) => {
		await page.goto('/');
		// The nav should include links for main sections
		await expect(page.getByRole('link', { name: /Invoices/i })).toBeVisible();
		await expect(page.getByRole('link', { name: /Clients/i })).toBeVisible();
	});

	test('clicking Invoices nav link navigates to /invoices', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('link', { name: /Invoices/i }).first().click();
		await expect(page).toHaveURL(/\/invoices/);
	});

	test('clicking Clients nav link navigates to /clients', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('link', { name: /Clients/i }).first().click();
		await expect(page).toHaveURL(/\/clients/);
	});
});

test.describe('Login', () => {
	test('visiting /login redirects to / when no password is configured', async ({ page }) => {
		await page.goto('/login');
		// Without a password set in settings, the load function redirects away from /login
		await expect(page).toHaveURL('/');
	});
});

test.describe('Reports and Taxes', () => {
	test('reports page loads', async ({ page }) => {
		await page.goto('/reports');
		await expect(page.getByRole('heading', { name: /Reports/i })).toBeVisible();
	});

	test('taxes page loads', async ({ page }) => {
		await page.goto('/taxes');
		await expect(page.getByRole('heading', { name: /Tax/i })).toBeVisible();
	});
});
