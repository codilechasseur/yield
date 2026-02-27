import { test, expect } from '@playwright/test';

// Backup tests run with authentication (storageState is configured in playwright.config.ts).
// When PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD are set the tests exercise the full create/download/delete flow.
// When admin credentials are not configured the page shows a helpful error message.

test.describe('Backups section on Settings', () => {
	test('Backups section is visible on the Settings page', async ({ page }) => {
		await page.goto('/settings');
		// Sidebar link
		await expect(page.getByRole('button', { name: 'Backups' })).toBeVisible();
		// Section heading
		await expect(page.getByRole('heading', { name: 'Backups' })).toBeVisible();
	});

	test('"Create backup now" button is present', async ({ page }) => {
		await page.goto('/settings');
		await expect(page.getByRole('button', { name: /Create backup now/i })).toBeVisible();
	});

	test('create backup, verify it appears, then delete it', async ({ page }) => {
		await page.goto('/settings');

		// If admin creds are missing the error message is shown instead — skip in that case.
		const errorBanner = page.locator('text=PB_ADMIN_EMAIL');
		if (await errorBanner.isVisible()) {
			test.skip(true, 'PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD not configured — skipping backup flow test');
			return;
		}

		// Create a backup
		await page.getByRole('button', { name: /Create backup now/i }).click();
		// Wait for the page to reload with the new backup in the list
		await page.waitForLoadState('networkidle');

		// There should be at least one row in the backup table
		const rows = page.locator('table tbody tr');
		await expect(rows.first()).toBeVisible();

		// Each row should have a download link and a delete button
		const downloadLink = rows.first().getByRole('link', { name: /Download/i });
		await expect(downloadLink).toBeVisible();

		const deleteButton = rows.first().getByRole('button', { name: /Delete/i });
		await expect(deleteButton).toBeVisible();

		// Delete the backup we just created
		const rowCount = await rows.count();
		await deleteButton.click();
		await page.waitForLoadState('networkidle');

		// Row count should have decreased by 1 (or the table should be gone if it was the only backup)
		const newRowCount = await rows.count();
		expect(newRowCount).toBeLessThan(rowCount);
	});

	test('backup download link points to /api/backup/...', async ({ page }) => {
		await page.goto('/settings');

		const errorBanner = page.locator('text=PB_ADMIN_EMAIL');
		if (await errorBanner.isVisible()) {
			test.skip(true, 'PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD not configured — skipping download link test');
			return;
		}

		// If there are backups the download link href should start with /api/backup/
		const downloadLinks = page.getByRole('link', { name: /Download/i });
		if (await downloadLinks.count() > 0) {
			const href = await downloadLinks.first().getAttribute('href');
			expect(href).toMatch(/^\/api\/backup\//);
		}
	});
});
