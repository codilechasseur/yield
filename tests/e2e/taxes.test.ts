import { test, expect } from '@playwright/test';

/**
 * Taxes E2E tests: tax setup (province + GST filing frequency) and recording,
 * editing and deleting payments tagged with the period they pay for.
 * Runs serially because tax setup is a single shared settings record.
 */

const RUN = Date.now();
const YEAR = new Date().getFullYear();

test.describe('Taxes', () => {
	test.describe.configure({ mode: 'serial' });

	test('tax setup switches to bracket estimates and quarterly GST returns', async ({ page }) => {
		await page.goto('/taxes');
		await page.waitForLoadState('networkidle');

		// Opens automatically when unconfigured; otherwise open it
		const heading = page.getByRole('heading', { name: 'Tax setup' });
		if (!(await heading.isVisible())) await page.getByRole('button', { name: 'Tax setup' }).click();

		await page.getByLabel('Province or territory').selectOption('ON');
		await page.getByLabel(/GST\/HST filing/).selectOption('quarterly');
		await page.getByRole('button', { name: 'Save', exact: true }).click();
		await expect(page.getByText('Tax setup saved')).toBeVisible();

		await expect(page.getByText(/^Ontario · GST\/HST filed quarterly/)).toBeVisible();
		await expect(page.getByRole('heading', { name: new RegExp(`Income tax & CPP — ${YEAR}`) })).toBeVisible();

		const returns = page.getByRole('region', { name: `GST/HST returns — ${YEAR}` });
		for (const q of ['Q1', 'Q2', 'Q3', 'Q4']) {
			await expect(returns.getByRole('rowheader', { name: new RegExp(`^${q} `) })).toBeVisible();
		}
	});

	test('records, edits and deletes a payment for a GST period', async ({ page }) => {
		const note = `e2e payment ${RUN}`;
		await page.goto('/taxes');
		await page.waitForLoadState('networkidle');

		await page.getByRole('button', { name: 'Record Payment' }).click();
		await page.getByLabel('Type').selectOption('gst');
		await page.getByLabel('Pays for').selectOption(`${YEAR}-Q1`);
		await page.getByLabel('Amount').fill('123.45');
		await page.getByLabel('Payment date').fill(`${YEAR}-04-15`);
		await page.getByLabel(/Notes/).fill(note);
		await page.getByRole('button', { name: 'Save Payment' }).click();
		await expect(page.getByText('Payment recorded')).toBeVisible();

		const row = page.getByRole('row', { name: new RegExp(note) });
		await expect(row).toContainText(`Q1 (Jan–Mar) ${YEAR}`);
		await expect(row).toContainText('$123.45');

		await row.getByRole('button', { name: /^Edit payment/ }).click();
		await expect(page.getByRole('heading', { name: 'Edit Payment' })).toBeVisible();
		await page.getByLabel('Amount').fill('150');
		await page.getByRole('button', { name: 'Save Changes' }).click();
		await expect(page.getByText('Payment updated')).toBeVisible();
		await expect(page.getByRole('row', { name: new RegExp(note) })).toContainText('$150.00');

		await page.getByRole('row', { name: new RegExp(note) }).getByRole('button', { name: /^Delete payment/ }).click();
		await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
		await expect(page.getByRole('row', { name: new RegExp(note) })).toHaveCount(0);
	});

	test('income tax payments only offer tax years', async ({ page }) => {
		await page.goto('/taxes');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: 'Record Payment' }).click();
		await page.getByLabel('Type').selectOption('income_tax');
		const options = await page.getByLabel('Pays for').locator('option').allTextContents();
		expect(options).toEqual(['Not specified (counts toward the year paid)', `${YEAR} tax year`, `${YEAR - 1} tax year`]);
	});
});
