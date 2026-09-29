import { test, expect, type Locator } from '@playwright/test';

/**
 * Rich-text line item descriptions.
 *
 * Pasted HTML (e.g. from a chat app) is reduced to plain lists/emphasis with no inline
 * styles, pasted markdown-ish plain text becomes lists, "- " starts a list while typing,
 * and the saved invoice renders the lists.
 */

const CLIENT_NAME = `RichText-Client-${Date.now()}`;

/** Dispatches a paste event carrying the given clipboard flavours. */
async function paste(target: Locator, data: Record<string, string>) {
	await target.click();
	await target.evaluate((el, data) => {
		const dt = new DataTransfer();
		for (const [type, value] of Object.entries(data)) dt.setData(type, value);
		el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
	}, data);
}

test.describe('Rich-text line item descriptions', () => {
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

	test('pasted HTML is cleaned and lists render on the invoice', async ({ page }) => {
		test.setTimeout(60_000);
		await page.goto('/invoices/new');
		await page.waitForLoadState('networkidle');
		await page.getByLabel('Client *', { exact: true }).selectOption({ label: CLIENT_NAME });

		const editor = page.getByRole('textbox', { name: 'Item description' }).first();
		await paste(editor, {
			'text/html':
				'<div style="background:#262624;color:#ccc"><h3 class="font-bold">August</h3>' +
				'<ul class="list-disc"><li style="white-space:normal">Modal polish</li>' +
				'<li>Gallery block<img src=x onerror="window.__xss=1"></li></ul></div>',
			'text/plain': 'August\nModal polish\nGallery block'
		});

		await expect(editor.getByRole('listitem')).toHaveText(['Modal polish', 'Gallery block']);
		const html = await editor.innerHTML();
		expect(html).not.toMatch(/style=|class=|<img|onerror/);

		// Typing "- " on a new line starts another list
		await editor.press('Control+End');
		await editor.press('Enter');
		await editor.press('Enter');
		await editor.pressSequentially('- Typed item');
		await expect(editor.getByRole('listitem').filter({ hasText: 'Typed item' })).toHaveCount(1);

		await page.getByRole('button', { name: /Create Invoice/i }).click();
		await page.waitForURL(
			(url) => url.pathname.startsWith('/invoices/') && url.pathname !== '/invoices/new',
			{ timeout: 30_000 }
		);

		const cell = page.getByRole('cell').filter({ hasText: 'Modal polish' });
		await expect(cell.getByRole('listitem')).toHaveText(['Modal polish', 'Gallery block', 'Typed item']);
		await expect(cell.getByText('August')).toBeVisible();
		expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
	});

	test('pasted markdown plain text becomes a nested list', async ({ page }) => {
		await page.goto('/invoices/new');
		await page.waitForLoadState('networkidle');

		const editor = page.getByRole('textbox', { name: 'Item description' }).first();
		await paste(editor, { 'text/plain': '- Photo galleries:\n  - Sub-category tiles\n- Captions' });

		await expect(editor.locator('ul ul > li')).toHaveText(['Sub-category tiles']);
		await expect(editor.locator(':scope > ul > li')).toHaveCount(2);
	});
});
