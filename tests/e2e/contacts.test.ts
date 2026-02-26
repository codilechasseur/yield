import { test, expect } from '@playwright/test';

/**
 * Contacts E2E tests.
 *
 * These tests work against a clean database — they create a client via the UI
 * first, then exercise the add / edit / delete contact flows on that client's
 * detail page.
 */

const CLIENT_NAME = `ContactE2E-${Date.now()}`;

test.describe('Client Contacts', () => {
	// Run these tests serially: they share a client and build on each other's state
	test.describe.configure({ mode: 'serial' });

	let clientUrl: string;

	test.beforeAll(async ({ browser }) => {
		// Create a client once for all tests in this describe block
		const page = await browser.newPage();
		await page.goto('/clients');
		// Wait for Svelte to fully hydrate before interacting
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: /New Client/i }).click();
		await page.getByLabel(/^Name/i).fill(CLIENT_NAME);
		await page.getByRole('button', { name: /Save Client/i }).click();
		// create action now redirects to the new client's page
		await page.waitForURL(/\/clients\/[^?]+/);
		clientUrl = page.url();
		await page.close();
	});

	test('contacts section is visible on client detail page', async ({ page }) => {
		await page.goto(clientUrl);
		await page.waitForLoadState('networkidle');
		await expect(page.getByRole('heading', { name: /Contacts/i })).toBeVisible();
		await expect(page.getByRole('button', { name: /Add Contact/i })).toBeVisible();
	});

	test('can add a contact with name, email, phone, and title', async ({ page }) => {
		await page.goto(clientUrl);
		await page.waitForLoadState('networkidle');

		// Open add contact form
		await page.getByRole('button', { name: /Add Contact/i }).click();

		// Fill in contact details
		await page.getByLabel(/First Name/i).fill('Jane');
		await page.getByLabel(/Last Name/i).fill('Smith');
		await page.getByLabel(/Email/i).fill('jane.smith@corp.example');
		await page.getByLabel(/Phone/i).fill('+1 555 0100');
		await page.getByLabel(/Title/i).fill('Finance Director');

		// Submit using the last "Add Contact" button (inside the form)
		await page.getByRole('button', { name: /Add Contact/i }).last().click();

		// Contact should now appear in the list (allow time for SvelteKit data reload)
		await expect(page.getByText('Jane Smith')).toBeVisible({ timeout: 15000 });
		await expect(page.getByText('jane.smith@corp.example')).toBeVisible({ timeout: 15000 });
		await expect(page.getByText('Finance Director')).toBeVisible({ timeout: 15000 });
	});

	test('can edit an existing contact email', async ({ page }) => {
		await page.goto(clientUrl);
		await page.waitForLoadState('networkidle');

		// Add a contact
		await page.getByRole('button', { name: /Add Contact/i }).click();
		await page.getByLabel(/First Name/i).fill('Edit');
		await page.getByLabel(/Last Name/i).fill('Test');
		await page.getByLabel(/Email/i).fill('before@example.com');
		await page.getByRole('button', { name: /Add Contact/i }).last().click();
		await expect(page.getByText('before@example.com')).toBeVisible({ timeout: 15000 });

		// Reload to clear any stale Svelte reactive state before opening the edit form
		await page.reload();
		await page.waitForLoadState('networkidle');

		// Click edit button for that contact
		await page.getByRole('button', { name: /Edit contact/i }).first().click();

		// Update the email field (last Email input in the edit form)
		const emailField = page.getByLabel(/Email/i).last();
		await emailField.clear();
		await emailField.fill('after@example.com');
		await page.getByRole('button', { name: /Save/i }).last().click();

		await expect(page.getByText('after@example.com')).toBeVisible({ timeout: 15000 });
		await expect(page.getByText('before@example.com')).not.toBeVisible({ timeout: 15000 });
	});

	test('can delete a contact', async ({ page }) => {
		// Override window.confirm before the page loads so it always returns true
		await page.addInitScript(() => { window.confirm = () => true; });

		await page.goto(clientUrl);
		await page.waitForLoadState('networkidle');

		// Add a contact to delete
		await page.getByRole('button', { name: /Add Contact/i }).click();
		await page.getByLabel(/First Name/i).fill('Throwaway');
		await page.getByLabel(/Last Name/i).fill('Contact');
		await page.getByRole('button', { name: /Add Contact/i }).last().click();
		await expect(page.getByText('Throwaway Contact')).toBeVisible({ timeout: 15000 });

		// Reload page to ensure use:enhance is applied to the newly added contact's form
		await page.reload();
		await page.waitForLoadState('networkidle');

		await page.getByRole('button', { name: /Delete contact/i }).last().click();

		// The contact should be removed from the list
		await expect(page.getByText('Throwaway Contact')).not.toBeVisible({ timeout: 15000 });
	});

	test('contacts with email are selectable in invoice send panel', async ({ page }) => {
		// Configure fake SMTP via direct POST to settings action (ensures it's always saved)
		await page.goto('/settings');
		await page.waitForLoadState('networkidle');
		// Use a unique value to ensure isDirty=true regardless of current state
		const uniqueSmtpHost = `smtp-test-${Date.now()}.example.com`;
		await page.getByLabel('SMTP Host').fill(uniqueSmtpHost);
		await page.getByLabel('From Email').fill('invoices@example.com');
		// The save button text is 'Save' when dirty, 'Saved' when clean
		await expect(page.getByRole('button', { name: 'Save' }).first()).toBeEnabled({ timeout: 5000 });
		await page.getByRole('button', { name: 'Save' }).first().click();
		await page.waitForLoadState('networkidle');

		await page.goto(clientUrl);
		await page.waitForLoadState('networkidle');

		// Add a contact with email
		await page.getByRole('button', { name: /Add Contact/i }).click();
		await page.getByLabel(/First Name/i).fill('Invoice');
		await page.getByLabel(/Last Name/i).fill('Recipient');
		await page.getByLabel(/Email/i).fill('invoicereceiver@example.com');
		await page.getByRole('button', { name: /Add Contact/i }).last().click();
		await expect(page.getByText('invoicereceiver@example.com')).toBeVisible({ timeout: 15000 });

		// Extract the client ID from the URL
		const clientId = clientUrl.split('/clients/')[1].replace(/\/$/, '');

		// Create an invoice for this client (Issue Date defaults to today)
		await page.goto(`/invoices/new?client=${clientId}`);
		await page.waitForLoadState('networkidle');

		// Expand advanced options and set a unique invoice number to avoid collisions
		await page.getByRole('button', { name: /Advanced/i }).click();
		const uniqueNumber = `TEST-${Date.now()}`;
		await page.getByLabel('Invoice Number').fill(uniqueNumber);

		await page.getByRole('button', { name: /Create Invoice/i }).click();
		// Wait for redirect to the new invoice's detail page (ID is alphanumeric, not 'new')
		await page.waitForURL(/\/invoices\/(?!new)[^?]+/, { timeout: 15000 });

		// Open the send panel
		await page.getByRole('button', { name: /Send Invoice/i }).click();

		// The contact email should appear as a recipient checkbox option
		await expect(page.getByText('invoicereceiver@example.com')).toBeVisible({ timeout: 15000 });
	});
});
