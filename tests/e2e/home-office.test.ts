import { test, expect } from '@playwright/test';

/**
 * Business use of home E2E: set up the workspace share on the Taxes page, log
 * a home cost on Expenses at its full amount, and check the share is applied
 * there and in the Part 7 table. Serial — the setup is a shared settings value.
 */

const RUN = Date.now();
const YEAR = new Date().getFullYear();

test.describe('Business use of home', () => {
	test.describe.configure({ mode: 'serial' });

	test('sets up the workspace share on the Taxes page', async ({ page }) => {
		await page.goto(`/taxes?year=${YEAR}`);
		await page.waitForLoadState('networkidle');
		const section = page.getByRole('region', { name: `Business use of home — ${YEAR}` });

		const setUp = section.getByRole('button', { name: 'Set up home office' });
		if (await setUp.isVisible()) await setUp.click();
		else await section.getByRole('button', { name: 'Edit workspace' }).click();

		await section.getByLabel(/Area of the home/).fill('1475');
		await section.getByLabel('Area of the workspace').fill('306');
		await section.getByLabel(/Business use of workspace/).fill('100');
		await section.getByLabel(/Carried from/).fill('');
		await section.getByRole('button', { name: 'Save workspace' }).click();

		await expect(page.getByText('Home office saved')).toBeVisible();
		await expect(section).toContainText('Workspace share: 306 of 1,475 = 20.75% of home costs');
	});

	test('rejects a workspace larger than the home', async ({ page }) => {
		await page.goto(`/taxes?year=${YEAR}`);
		await page.waitForLoadState('networkidle');
		const section = page.getByRole('region', { name: `Business use of home — ${YEAR}` });
		await section.getByRole('button', { name: 'Edit workspace' }).click();
		await section.getByLabel('Area of the workspace').fill('2000');
		await section.getByRole('button', { name: 'Save workspace' }).click();
		await expect(section.getByRole('alert')).toContainText('can’t be bigger than the home');
	});

	test('applies the share to a home cost logged on Expenses', async ({ page }) => {
		const description = `Hydro ${RUN}`;
		await page.goto('/expenses');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: 'Add Expense' }).click();
		const form = page.getByRole('region', { name: 'Add an Expense' });

		await form.getByLabel('Description').fill(description);
		await form.getByLabel('Category').selectOption('home_office');
		await form.getByLabel('Home cost').selectOption('electricity');
		await form.getByLabel(/^Amount/).fill('1668');
		// The year's home share replaces the business-use % field
		await expect(form.getByLabel(/Business use \(%\)/)).toHaveCount(0);
		await expect(form).toContainText(`Uses your ${YEAR} home office share of 20.75%`);
		await expect(form).toContainText('Deductible from income: $346.04');
		await form.getByRole('button', { name: 'Save Expense' }).click();

		const row = page.getByRole('row', { name: new RegExp(description) });
		await expect(row).toContainText('Business use of home · Electricity');
		await expect(row).toContainText('$1,668.00');
		await expect(row).toContainText('$346.04');
	});

	test('shows the home cost in the Part 7 table', async ({ page }) => {
		await page.goto(`/taxes?year=${YEAR}`);
		await page.waitForLoadState('networkidle');
		const table = page.getByRole('table', { name: `Business-use-of-home expenses for ${YEAR}` });
		await expect(table.getByRole('row', { name: /^Electricity/ })).toBeVisible();
		await expect(table.getByRole('row', { name: /^Deductible this year/ })).toBeVisible();
	});
});
