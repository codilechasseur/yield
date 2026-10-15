import { test, expect, type Page } from '@playwright/test';

/**
 * Expenses E2E tests: one-off expenses (create / edit / filter / delete) and
 * recurring expenses (create with backfill / stop / delete). Every test
 * creates its own uniquely named records, so they work on an empty database.
 */

const RUN = Date.now();

function isoDate(d: Date): string {
	return d.toISOString().slice(0, 10);
}

/** The 1st of the month `monthsAgo` months back — the 1st always exists, so no end-of-month clamping. */
function firstOfMonth(monthsAgo: number): string {
	const now = new Date();
	return isoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 1)));
}

/** Opens the add form and returns it, so field lookups can't hit the filter bar's selects. */
async function openAddForm(page: Page) {
	await page.goto('/expenses');
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Add Expense' }).click();
	const form = page.getByRole('region', { name: 'Add an Expense' });
	await expect(form).toBeVisible();
	return form;
}

test.describe('Expenses', () => {
	test('adds a meals expense and shows only half as deductible', async ({ page }) => {
		const description = `Client lunch ${RUN}`;
		const form = await openAddForm(page);

		await form.getByLabel('Description').fill(description);
		await form.getByLabel('Category').selectOption('meals');
		await form.getByLabel(/^Amount/).fill('80');
		await form.getByLabel(/GST\/HST paid/).fill('10.40');
		await expect(form.getByText('Meals and entertainment are only 50% deductible.')).toBeVisible();
		await form.getByRole('button', { name: 'Save Expense' }).click();

		const row = page.getByRole('row', { name: new RegExp(description) });
		await expect(row).toBeVisible();
		await expect(row).toContainText('Meals & entertainment');
		await expect(row).toContainText('$80.00');
		await expect(row).toContainText('$40.00');
	});

	test('rejects a business-use percentage over 100', async ({ page }) => {
		const form = await openAddForm(page);
		await form.getByLabel('Description').fill(`Bad business use ${RUN}`);
		await form.getByLabel(/^Amount/).fill('10');
		const businessUse = form.getByLabel(/Business use/);
		await businessUse.fill('150');
		await form.getByRole('button', { name: 'Save Expense' }).click();
		// Browser validation blocks the submit
		expect(await businessUse.evaluate((el: HTMLInputElement) => el.validity.rangeOverflow)).toBe(true);
		await expect(form).toBeVisible();
	});

	test('edits an expense', async ({ page }) => {
		const description = `Phone plan ${RUN}`;
		const form = await openAddForm(page);
		await form.getByLabel('Description').fill(description);
		await form.getByLabel('Category').selectOption('telephone');
		await form.getByLabel(/^Amount/).fill('90');
		await form.getByRole('button', { name: 'Save Expense' }).click();
		await expect(page.getByRole('row', { name: new RegExp(description) })).toBeVisible();

		await page.getByRole('button', { name: `Edit expense ${description}` }).click();
		const editForm = page.getByRole('region', { name: 'Edit Expense' });
		await expect(editForm).toBeVisible();
		await editForm.getByLabel(/Business use/).fill('60');
		await editForm.getByLabel('Description').fill(`${description} (edited)`);
		await editForm.getByRole('button', { name: 'Save Changes' }).click();

		const row = page.getByRole('row', { name: new RegExp(`${description} \\(edited\\)`) });
		await expect(row).toBeVisible();
		await expect(row).toContainText('60% business');
		await expect(row).toContainText('$54.00');
	});

	test('filters by search and category, then deletes', async ({ page }) => {
		const description = `Searchable ad ${RUN}`;
		const form = await openAddForm(page);
		await form.getByLabel('Description').fill(description);
		await form.getByLabel('Category').selectOption('advertising');
		await form.getByLabel(/^Amount/).fill('25');
		await form.getByRole('button', { name: 'Save Expense' }).click();
		await expect(page.getByRole('row', { name: new RegExp(description) })).toBeVisible();

		await page.getByRole('searchbox', { name: 'Search' }).fill(`Searchable ad ${RUN}`);
		await page.getByRole('button', { name: 'Search', exact: true }).click();
		await expect(page).toHaveURL(/q=Searchable/);
		await expect(page.getByRole('row', { name: new RegExp(description) })).toBeVisible();
		await expect(page.getByText(/1 matching expense/)).toBeVisible();

		await page.getByLabel('Category', { exact: true }).selectOption('software');
		await expect(page).toHaveURL(/category=software/);
		await expect(page.getByText('No expenses match these filters')).toBeVisible();

		await page.getByRole('link', { name: 'Clear filters' }).first().click();
		await page.getByRole('button', { name: `Delete expense ${description}` }).click();
		await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
		await expect(page.getByRole('row', { name: new RegExp(description) })).toHaveCount(0);
	});
});

test.describe('Recurring expenses', () => {
	test.describe.configure({ mode: 'serial' });

	const description = `Anthropic subscription ${RUN}`;

	test('creating one with a past start date logs every charge since', async ({ page }) => {
		const form = await openAddForm(page);
		await form.getByLabel('Description').fill(description);
		await form.getByLabel('Category').selectOption('software');
		await form.getByLabel(/^Amount/).fill('20');
		await form.getByLabel(/GST\/HST paid/).fill('2.60');
		await form.getByLabel(/This repeats/).check();
		await form.getByLabel('First charge date').fill(firstOfMonth(2));
		await form.getByLabel('How often').selectOption('monthly');
		await form.getByRole('button', { name: 'Save Expense' }).click();

		await expect(page.getByText('Recurring expense added — 3 past charges logged')).toBeVisible();
		const recurring = page.getByRole('region', { name: 'Recurring expenses' });
		const row = recurring.getByRole('row', { name: new RegExp(description) });
		await expect(row).toContainText('3 charges logged');
		await expect(row).toContainText('$240.00'); // per year
		await expect(row).toContainText(new Date(firstOfMonth(-1) + 'T00:00:00Z').toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }));
	});

	test('reloading does not log duplicates', async ({ page }) => {
		await page.goto('/expenses');
		await page.reload();
		const row = page.getByRole('region', { name: 'Recurring expenses' }).getByRole('row', { name: new RegExp(description) });
		await expect(row).toContainText('3 charges logged');
	});

	test('editing the schedule changes future charges', async ({ page }) => {
		await page.goto('/expenses');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: `Edit recurring expense ${description}` }).click();
		const editForm = page.getByRole('region', { name: 'Edit Recurring Expense' });
		await expect(editForm).toBeVisible();
		await editForm.getByLabel(/^Amount/).fill('25');
		await editForm.getByRole('button', { name: 'Save Recurring Expense' }).click();
		const row = page.getByRole('region', { name: 'Recurring expenses' }).getByRole('row', { name: new RegExp(description) });
		await expect(row).toContainText('$300.00');
		await expect(row).toContainText('3 charges logged');
	});

	test('stopping it ends future charges', async ({ page }) => {
		await page.goto('/expenses');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: `Stop recurring expense ${description}` }).click();
		const row = page.getByRole('region', { name: 'Recurring expenses' }).getByRole('row', { name: new RegExp(description) });
		await expect(row).toContainText('Ended');
	});

	test('deleting it can also remove the charges it logged', async ({ page }) => {
		await page.goto('/expenses');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: `Delete recurring expense ${description}` }).click();
		const dialog = page.getByRole('alertdialog');
		await dialog.getByLabel(/Also delete the 3 expenses/).check();
		await dialog.getByRole('button', { name: 'Delete' }).click();

		await expect(page.getByText('Recurring expense deleted')).toBeVisible();
		await expect(page.getByRole('row', { name: new RegExp(description) })).toHaveCount(0);
	});
});

test.describe('Recurring expense start date correction', () => {
	test('moving the start date earlier fills in the missed months', async ({ page }) => {
		const description = `Late start ${RUN}`;
		const form = await openAddForm(page);
		await form.getByLabel('Description').fill(description);
		await form.getByLabel('Category').selectOption('software');
		await form.getByLabel(/^Amount/).fill('15');
		await form.getByLabel(/This repeats/).check();
		await form.getByLabel('First charge date').fill(firstOfMonth(0));
		await form.getByRole('button', { name: 'Save Expense' }).click();

		const row = page.getByRole('region', { name: 'Recurring expenses' }).getByRole('row', { name: new RegExp(description) });
		await expect(row).toContainText('1 charge logged');

		await page.getByRole('button', { name: `Edit recurring expense ${description}` }).click();
		const editForm = page.getByRole('region', { name: 'Edit Recurring Expense' });
		await editForm.getByLabel('First charge date').fill(firstOfMonth(2));
		await editForm.getByRole('button', { name: 'Save Recurring Expense' }).click();

		await expect(page.getByText('Recurring expense updated — 2 charges added')).toBeVisible();
		await expect(row).toContainText('3 charges logged');
	});
});
