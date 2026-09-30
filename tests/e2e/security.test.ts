import { test, expect } from '@playwright/test';

// Regression tests for the security hardening. auth.setup.ts has already set a
// password, so /setup must stay closed from here on.

const TEST_PASSWORD = process.env.APP_PASSWORD || 'testpassword123';
const signedOut = { cookies: [], origins: [] };

test.describe('Setup route once a password exists', () => {
	test.use({ storageState: signedOut });

	test('GET /setup redirects to /login', async ({ page }) => {
		await page.goto('/setup');
		await expect(page).toHaveURL(/\/login/);
	});

	test('POSTing the setup action cannot replace the password', async ({ page, request, baseURL }) => {
		// SvelteKit answers action POSTs with a JSON envelope, and a successful
		// setup also redirects to /login — so the proof is that the original
		// password still works afterwards.
		await request.post('/setup?/setup', {
			form: { password: 'attacker-password', confirm: 'attacker-password' },
			headers: { Origin: new URL(baseURL!).origin },
			maxRedirects: 0
		});

		await page.goto('/login');
		await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD);
		await page.getByRole('button', { name: /Sign in/i }).click();
		await expect(page).toHaveURL('/');
	});
});

test.describe('Login redirect target', () => {
	test.use({ storageState: signedOut });

	test('an external next= URL is ignored after signing in', async ({ page }) => {
		await page.goto('/login?next=' + encodeURIComponent('https://evil.example/phish'));
		await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD);
		await page.getByRole('button', { name: /Sign in/i }).click();
		await expect(page).toHaveURL('/');
	});

	test('a same-origin next= path is honoured', async ({ page }) => {
		await page.goto('/login?next=' + encodeURIComponent('/clients'));
		await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD);
		await page.getByRole('button', { name: /Sign in/i }).click();
		await expect(page).toHaveURL('/clients');
	});

	test('protected pages redirect to login when signed out', async ({ page }) => {
		await page.goto('/invoices?page=2');
		await expect(page).toHaveURL(/\/login\?next=%2Finvoices%3Fpage%3D2/);
	});
});

test.describe('Security headers', () => {
	test('pages send CSP, framing and sniffing protections', async ({ request }) => {
		const res = await request.get('/');
		expect(res.status()).toBe(200);
		const headers = res.headers();
		expect(headers['x-frame-options']).toBe('DENY');
		expect(headers['x-content-type-options']).toBe('nosniff');
		expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
		expect(headers['content-security-policy']).toContain("object-src 'none'");
	});

	test('the app renders without CSP violations', async ({ page }) => {
		const violations: string[] = [];
		page.on('console', (msg) => {
			if (/Content Security Policy/i.test(msg.text())) violations.push(msg.text());
		});
		await page.goto('/');
		await expect(page.getByText('Outstanding').first()).toBeVisible();
		await page.goto('/settings/system');
		await expect(page.getByRole('heading', { name: 'Password Protection' })).toBeVisible();
		expect(violations).toEqual([]);
	});
});

test.describe('Changing the password', () => {
	test('requires the current password', async ({ page }) => {
		await page.goto('/settings/system');
		await page.getByLabel('Current password').fill('definitely-not-the-password');
		await page.getByLabel('New password').fill('another-password-123');
		await page.getByRole('button', { name: 'Update password' }).click();
		await expect(page.getByText('Current password is incorrect.')).toBeVisible();

		// Still signed in with the original password (nothing changed).
		await page.goto('/');
		await expect(page).toHaveURL('/');
	});

	test('the remove-password option is gone', async ({ page }) => {
		await page.goto('/settings/system');
		await expect(page.getByRole('heading', { name: 'Password Protection' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Remove password' })).toHaveCount(0);
	});
});

test.describe('PocketBase API rules', () => {
	test('collections refuse unauthenticated access', async ({ request }) => {
		const pbUrl = process.env.PB_URL || 'http://localhost:8090';
		for (const collection of ['settings', 'clients', 'invoices']) {
			const res = await request.get(`${pbUrl}/api/collections/${collection}/records`);
			expect(res.status(), collection).toBe(403);
		}
		const create = await request.post(`${pbUrl}/api/collections/clients/records`, {
			data: { name: 'Anonymous' }
		});
		expect(create.status()).toBe(403);
	});
});
