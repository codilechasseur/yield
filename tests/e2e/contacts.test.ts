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
	let clientUrl: string;

	test.beforeAll(async ({ browser }) => {
		// Create a client once for all tests in this describe block
		const page = await browser.newPage();
		await page.goto('/clients');
		await page.getByRole('button', { name: /New Client/i }).click();
		await page.getByLabel(/^Name/i).fill(CLIENT_NAME);
		await page.getByRole('button', { name: /Save Client/i }).click();
		// After save the form closes; find the new client link
		await page.waitForSelector(`text=${CLIENT_NAME}`);
		await page.getByRole('link', { name: CLIENT_NAME }).click();
		await page.waitForURL(/\/clients\//);
		clientUrl = page.url();
		await page.close();
	});

	test('contacts section is visible on client detail page', async ({ page }) => {
		await page.goto(clientUrl);
		await expect(page.getByRole('heading', { name: /Contacts/i })).toBeVisible();
		await expect(page.getByRole('button', { name: /Add Contact/i })).toBeVisible();
	});

	test('can add a contact with name, email, phone, and title', async ({ page }) => {
		await page.goto(clientUrl);

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

		// Contact should now appear in the list
		await expect(page.getByText('Jane Smith')).toBeVisible();
		await expect(page.getByText('jane.smith@corp.example')).toBeVisible();
		await expect(page.getByText('Finance Director')).toBeVisible();
	});

	test('can edit an existing contact email', async ({ page }) => {
		await page.goto(clientUrl);

		// Add a contact
		await page.getByRole('button', { name: /Add Contact/i }).click();
		await page.getByLabel(/First Name/i).fill('Edit');
		await page.getByLabel(/Last Name/i).fill('Test');
		await page.getByLabel(/Email/i).fill('before@example.com');
		await page.getByRole('button', { name: /Add Contact/i }).last().click();
		await expect(page.getByText('before@example.com')).toBeVisible();

		// Click edit button for that contact
		await page.getByRole('button', { name: /Edit contact/i }).first().click();

		// Update the email field (last Email input in the edit form)
		const emailField = page.getByLabel(/Email/i).last();
		await emailField.clear();
		await emailField.fill('after@example.com');
		await page.getByRole('button', { name: /Save/i }).last().click();

		await expect(page.getByText('after@example.com')).toBeVisible();
		await expect(page.getByText('before@example.com')).not.toBeVisible();
	});

	test('can delete a contact', async ({ page }) => {
		await page.goto(clientUrl);

		// Add a contact to delete
		await page.getByRole('button', { name: /Add Contact/i }).click();
		await page.getByLabel(/First Name/i).fill('Throwaway');
		await page.getByLabel(/Last Name/i).fill('Contact');
		await page.getByRole('button', { name: /Add Contact/i }).last().click();
		await expect(page.getByText('Throwaway Contact')).toBeVisible();

		// Accept the confirm dialog and click delete
		page.on('dialog', (dialog) => dialog.accept());
		await page.getByRole('button', { name: /Delete contact/i }).first().click();

		await expect(page.getByText('Throwaway Contact')).not.toBeVisible();
	});

	test('contacts with email are selectable in invoice send panel', async ({ page }) => {
		await page.goto(clientUrl);

		// Add a contact with email
		await page.getByRole('button', { name: /Add Contact/i }).click();
		await page.getByLabel(/First Name/i).fill('Invoice');
		await page.getByLabel(/Last Name/i).fill('Recipient');
		await page.getByLabel(/Email/i).fill('invoicereceiver@example.com');
		await page.getByRole('button', { name: /Add Contact/i }).last().click();
		await expect(page.getByText('invoicereceiver@example.com')).toBeVisible();

		// Extract the client ID from the URL
		const clientId = clientUrl.split('/clients/')[1].replace(/\/$/, '');

		// Create an invoice for this client
		await page.goto(`/invoices/new?client=${clientId}`);
		await page.getByLabel('Invoice Number').fill('TEST-CONTACTS-E2E-001');
		await page.getByLabel(/Issue Date/i).fill('2026-01-01');
		await page.getByRole('button', { name: /Create Invoice/i }).click();
		await page.waitForURL(/\/invoices\//);

		// Open the send panel
		await page.getByRole('button', { name: /Send Invoice/i }).click();

		// The contact email should appear as a recipient checkbox option
		await expect(page.getByText('invoicereceiver@example.com')).toBeVisible();
	});
});
