import { test, expect } from '@playwright/test';

/**
 * Company settings E2E tests.
 *
 * The GST/HST number is saved with the company details and printed in the
 * header of every invoice/estimate PDF (PDF rendering is unit-tested).
 */

test.describe('Company settings', () => {
	test('saves the GST/HST number and keeps it after reload', async ({ page }) => {
		const taxNumber = `123456789 RT${String(Date.now()).slice(-4)}`;

		await page.goto('/settings');
		await page.waitForLoadState('networkidle');

		const field = page.getByLabel(/GST\/HST Number/);
		await field.fill(taxNumber);
		await page
			.locator('form')
			.filter({ has: field })
			.getByRole('button', { name: 'Save' })
			.click();
		await expect(page.getByText('Company details saved')).toBeVisible();

		await page.reload();
		await page.waitForLoadState('networkidle');
		await expect(page.getByLabel(/GST\/HST Number/)).toHaveValue(taxNumber);
	});
});
