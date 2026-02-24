import { fail } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import type { InvoiceStatus } from '$lib/types.js';
import { getSmtpSettings, sendInvoiceEmail, DEFAULT_EMAIL_SUBJECT, DEFAULT_EMAIL_BODY, buildLogoUrl } from '$lib/mail.server.js';
import type { SmtpSettings } from '$lib/mail.server.js';
import { hashPassword, invalidatePasswordCache } from '$lib/auth.server.js';

export async function load() {
	const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
	const smtp = await getSmtpSettings(pb);
	const hasPassword = Boolean(smtp?.app_password_hash);
	const logoUrl = buildLogoUrl(env.PB_URL || 'http://localhost:8090', smtp?.id ?? '', smtp?.logo);
	let clientCount = 0;
	try {
		const r = await pb.collection('clients').getList(1, 1);
		clientCount = r.totalItems;
	} catch { /* ignore — collections may not exist yet */ }
	return { smtp, DEFAULT_EMAIL_SUBJECT, DEFAULT_EMAIL_BODY, hasPassword, clientCount, logoUrl };
}

export const actions = {
	saveTax: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const fd = await request.formData();
		const default_tax_percent = parseFloat(fd.get('default_tax_percent')?.toString() ?? '5') || 5;

		try {
			const existing = await getSmtpSettings(pb);
			if (existing?.id) {
				await pb.collection('settings').update(existing.id, { default_tax_percent });
			} else {
				await pb.collection('settings').create({ default_tax_percent });
			}
		} catch (e) {
			return fail(500, { taxError: 'Failed to save tax setting: ' + (e as Error).message });
		}

		return { taxSuccess: true };
	},

	saveSmtp: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const fd = await request.formData();

		const data: Omit<SmtpSettings, 'id'> = {
			smtp_host: fd.get('smtp_host')?.toString().trim() ?? '',
			smtp_port: parseInt(fd.get('smtp_port')?.toString() ?? '587', 10) || 587,
			smtp_user: fd.get('smtp_user')?.toString().trim() ?? '',
			smtp_pass: fd.get('smtp_pass')?.toString() ?? '',
			smtp_from_name: fd.get('smtp_from_name')?.toString().trim() ?? '',
			smtp_from_email: fd.get('smtp_from_email')?.toString().trim() ?? '',
			smtp_secure: fd.get('smtp_secure') === 'on'
		};

		try {
			const existing = await getSmtpSettings(pb);
			if (existing?.id) {
				await pb.collection('settings').update(existing.id, data);
			} else {
				await pb.collection('settings').create(data);
			}
		} catch (e) {
			return fail(500, { error: 'Failed to save settings: ' + (e as Error).message });
		}

		return { success: true };
	},

	testSmtp: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const fd = await request.formData();
		const testTo = fd.get('test_to')?.toString().trim();

		if (!testTo) return fail(400, { testError: 'Enter a recipient email for the test.' });

		// Use saved settings
		const smtp = await getSmtpSettings(pb);
		if (!smtp?.smtp_host) {
			return fail(400, { testError: 'Save SMTP settings first before sending a test.' });
		}

		try {
			const nodemailer = await import('nodemailer');
			const fromField = smtp.smtp_from_name
				? `"${smtp.smtp_from_name}" <${smtp.smtp_from_email}>`
				: smtp.smtp_from_email;
			const transporter = nodemailer.default.createTransport({
				host: smtp.smtp_host,
				port: smtp.smtp_port,
				secure: smtp.smtp_secure,
				auth: smtp.smtp_user ? { user: smtp.smtp_user, pass: smtp.smtp_pass } : undefined
			});
			await transporter.sendMail({
				from: fromField,
				to: testTo,
				subject: 'Yield – SMTP test',
				text: 'This is a test email from Yield. Your SMTP configuration is working correctly.'
			});
		} catch (e) {
			return fail(500, { testError: 'Test failed: ' + (e as Error).message });
		}

		return { testSuccess: true };
	},

	saveInvoiceDefaults: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const fd = await request.formData();
		const invoice_default_notes = fd.get('invoice_default_notes')?.toString() ?? '';
		const invoice_footer = fd.get('invoice_footer')?.toString() ?? '';
		const company_name = fd.get('company_name')?.toString() ?? '';
		const company_address = fd.get('company_address')?.toString() ?? '';

		try {
			const existing = await getSmtpSettings(pb);
			if (existing?.id) {
				await pb.collection('settings').update(existing.id, { invoice_default_notes, invoice_footer, company_name, company_address });
			} else {
				await pb.collection('settings').create({ invoice_default_notes, invoice_footer, company_name, company_address });
			}
		} catch (e) {
			return fail(500, { invoiceDefaultsError: 'Failed to save: ' + (e as Error).message });
		}

		return { invoiceDefaultsSuccess: true };
	},

	saveInvoiceNumbering: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const fd = await request.formData();
		const invoice_number_format = fd.get('invoice_number_format')?.toString().trim() || 'INV-{number}';
		const invoice_next_number = parseInt(fd.get('invoice_next_number')?.toString() ?? '1', 10) || 1;

		try {
			const existing = await getSmtpSettings(pb);
			if (existing?.id) {
				await pb.collection('settings').update(existing.id, { invoice_number_format, invoice_next_number });
			} else {
				await pb.collection('settings').create({ invoice_number_format, invoice_next_number });
			}
		} catch (e) {
			return fail(500, { invoiceNumberingError: 'Failed to save: ' + (e as Error).message });
		}

		return { invoiceNumberingSuccess: true };
	},

	saveEmailTemplate: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const fd = await request.formData();
		const email_subject = fd.get('email_subject')?.toString() ?? '';
		const email_body = fd.get('email_body')?.toString() ?? '';

		try {
			const existing = await getSmtpSettings(pb);
			if (existing?.id) {
				await pb.collection('settings').update(existing.id, { email_subject, email_body });
			} else {
				await pb.collection('settings').create({ email_subject, email_body });
			}
		} catch (e) {
			return fail(500, { emailTemplateError: 'Failed to save: ' + (e as Error).message });
		}

		return { emailTemplateSuccess: true };
	},

	saveIncomeTaxRate: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const fd = await request.formData();
		const income_tax_rate = parseFloat(fd.get('income_tax_rate')?.toString() ?? '0') || 0;

		try {
			const existing = await getSmtpSettings(pb);
			if (existing?.id) {
				await pb.collection('settings').update(existing.id, { income_tax_rate });
			} else {
				await pb.collection('settings').create({ income_tax_rate });
			}
		} catch (e) {
			return fail(500, { incomeTaxRateError: 'Failed to save: ' + (e as Error).message });
		}

		return { incomeTaxRateSuccess: true };
	},

	saveClientDefaults: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const fd = await request.formData();
		const default_currency = fd.get('default_currency')?.toString().trim() || 'CAD';

		try {
			const existing = await getSmtpSettings(pb);
			if (existing?.id) {
				await pb.collection('settings').update(existing.id, { default_currency });
			} else {
				await pb.collection('settings').create({ default_currency });
			}
		} catch (e) {
			return fail(500, { clientDefaultsError: 'Failed to save: ' + (e as Error).message });
		}

		return { clientDefaultsSuccess: true };
	},

	saveAppearance: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const fd = await request.formData();
		const brand_hue = parseFloat(fd.get('brand_hue')?.toString() ?? '250') || 250;
		const rawTheme = fd.get('brand_theme')?.toString() ?? '';
		const brand_theme = ['light', 'dark', 'system'].includes(rawTheme) ? rawTheme : undefined;

		try {
			const existing = await getSmtpSettings(pb);
			const payload: Record<string, unknown> = { brand_hue };
			if (brand_theme) payload.brand_theme = brand_theme;
			if (existing?.id) {
				await pb.collection('settings').update(existing.id, payload);
			} else {
				await pb.collection('settings').create(payload);
			}
		} catch {
			// silently ignore — appearance is cosmetic only
		}

		return {};
	},

	saveLogo: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const fd = await request.formData();
		const logoFile = fd.get('logo');

		if (!logoFile || !(logoFile instanceof File) || logoFile.size === 0) {
			return fail(400, { logoError: 'Please select an image file.' });
		}

		const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'];
		if (!allowedTypes.includes(logoFile.type)) {
			return fail(400, { logoError: 'Only JPEG, PNG, GIF, SVG, and WebP images are allowed.' });
		}

		if (logoFile.size > 5 * 1024 * 1024) {
			return fail(400, { logoError: 'Logo must be under 5 MB.' });
		}

		try {
			const existing = await getSmtpSettings(pb);
			const uploadData = new FormData();
			uploadData.append('logo', logoFile);
			if (existing?.id) {
				await pb.collection('settings').update(existing.id, uploadData);
			} else {
				await pb.collection('settings').create(uploadData);
			}
		} catch (e) {
			return fail(500, { logoError: 'Failed to save logo: ' + (e as Error).message });
		}

		return { logoSuccess: true };
	},

	removeLogo: async () => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		try {
			const existing = await getSmtpSettings(pb);
			if (existing?.id) {
				const clear = new FormData();
				clear.append('logo', '');
				await pb.collection('settings').update(existing.id, clear);
			}
		} catch (e) {
			return fail(500, { logoError: 'Failed to remove logo: ' + (e as Error).message });
		}
		return { logoRemoved: true };
	},

	saveAll: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const fd = await request.formData();

		const data = {
			// SMTP
			smtp_host: fd.get('smtp_host')?.toString().trim() ?? '',
			smtp_port: parseInt(fd.get('smtp_port')?.toString() ?? '587', 10) || 587,
			smtp_user: fd.get('smtp_user')?.toString().trim() ?? '',
			smtp_pass: fd.get('smtp_pass')?.toString() ?? '',
			smtp_from_name: fd.get('smtp_from_name')?.toString().trim() ?? '',
			smtp_from_email: fd.get('smtp_from_email')?.toString().trim() ?? '',
			smtp_secure: fd.get('smtp_secure') === 'on',
			// Email template
			email_subject: fd.get('email_subject')?.toString() ?? '',
			email_body: fd.get('email_body')?.toString() ?? '',
			// Invoice defaults
			company_name: fd.get('company_name')?.toString() ?? '',
			company_address: fd.get('company_address')?.toString() ?? '',
			invoice_default_notes: fd.get('invoice_default_notes')?.toString() ?? '',
			invoice_footer: fd.get('invoice_footer')?.toString() ?? '',
			// Invoice numbering
			invoice_number_format: fd.get('invoice_number_format')?.toString().trim() || 'INV-{number}',
			invoice_next_number: parseInt(fd.get('invoice_next_number')?.toString() ?? '1', 10) || 1,
			// Tax / rates
			default_tax_percent: parseFloat(fd.get('default_tax_percent')?.toString() ?? '5') || 5,
			income_tax_rate: parseFloat(fd.get('income_tax_rate')?.toString() ?? '0') || 0,
			// Client defaults
			default_currency: fd.get('default_currency')?.toString().trim() || 'CAD',
			// Appearance
			brand_hue: parseFloat(fd.get('brand_hue')?.toString() ?? '250') || 250,
			brand_theme: (['light', 'dark', 'system'].includes(fd.get('brand_theme')?.toString() ?? '') ? fd.get('brand_theme')!.toString() : 'system'),
			// Logo
			logo_hide_company_name: fd.get('logo_hide_company_name') === 'on',
		};

		try {
			const existing = await getSmtpSettings(pb);
			if (existing?.id) {
				await pb.collection('settings').update(existing.id, data);
			} else {
				await pb.collection('settings').create(data);
			}
		} catch (e) {
			return fail(500, { saveAllError: 'Failed to save settings: ' + (e as Error).message });
		}

		return { saveAllSuccess: true };
	},

	setPassword: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const fd = await request.formData();
		const password = fd.get('password')?.toString() ?? '';

		if (password.length < 8) {
			return fail(400, { passwordError: 'Password must be at least 8 characters.' });
		}

		try {
			const hash = await hashPassword(password);
			const existing = await getSmtpSettings(pb);
			if (existing?.id) {
				await pb.collection('settings').update(existing.id, { app_password_hash: hash });
			} else {
				await pb.collection('settings').create({ app_password_hash: hash });
			}
			invalidatePasswordCache();
		} catch (e) {
			return fail(500, { passwordError: 'Failed to save password: ' + (e as Error).message });
		}

		return { passwordSuccess: true };
	},

	removePassword: async () => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');

		try {
			const existing = await getSmtpSettings(pb);
			if (existing?.id) {
				await pb.collection('settings').update(existing.id, { app_password_hash: '' });
			}
			invalidatePasswordCache();
		} catch (e) {
			return fail(500, { passwordError: 'Failed to remove password: ' + (e as Error).message });
		}

		return { passwordRemoved: true };
	},

	harvestImport: async ({ request }) => {
		// ── Harvest API types ─────────────────────────────────────────────────────
		interface HarvestClient { id: number; name: string; currency: string; address: string; is_active: boolean; }
		interface HarvestContact { id: number; client: { id: number }; email: string; }
		interface HarvestLineItem { description: string; quantity: number; unit_price: number; amount: number; }
		interface HarvestInvoice {
			id: number; number: string; client: { id: number }; state: string;
			issue_date: string; due_date: string; tax: number; paid_amount: number;
			notes: string; line_items: HarvestLineItem[];
		}

		const fd = await request.formData();
		const accountId = fd.get('harvest_account_id')?.toString().trim() ?? '';
		const token = fd.get('harvest_token')?.toString().trim() ?? '';

		if (!accountId || !token) {
			return fail(400, { importError: 'Please provide both your Harvest Account ID and Personal Access Token.' });
		}

		const harvestHeaders = {
			'Authorization': `Bearer ${token}`,
			'Harvest-Account-Id': accountId,
			'User-Agent': 'Yield Invoicing (self-hosted)'
		};

		// ── Paginated fetch helper ────────────────────────────────────────────────
		const harvestFetchAll = async <T>(endpoint: string): Promise<T[]> => {
			const items: T[] = [];
			let page = 1;
			while (true) {
				const res = await fetch(
					`https://api.harvestapp.com/v2${endpoint}?per_page=100&page=${page}`,
					{ headers: harvestHeaders }
				);
				if (!res.ok) {
					const body = await res.text().catch(() => res.statusText);
					throw new Error(`Harvest API ${res.status}: ${body}`);
				}
				const data: Record<string, unknown> = await res.json();
				const key = Object.keys(data).find(k => Array.isArray(data[k]) && k !== 'links');
				if (!key) break;
				items.push(...(data[key] as T[]));
				if (page >= ((data['total_pages'] as number) ?? 1)) break;
				page++;
			}
			return items;
		};

		// ── Fetch from Harvest ────────────────────────────────────────────────────
		let harvestClients: HarvestClient[];
		let harvestContacts: HarvestContact[];
		let harvestInvoices: HarvestInvoice[];

		try {
			[harvestClients, harvestContacts, harvestInvoices] = await Promise.all([
				harvestFetchAll<HarvestClient>('/clients'),
				harvestFetchAll<HarvestContact>('/contacts'),
				harvestFetchAll<HarvestInvoice>('/invoices'),
			]);
		} catch (e) {
			return fail(400, { importError: (e as Error).message });
		}

		// Build contact email map: harvest client id → primary email
		const emailByClientId = new Map<number, string>();
		for (const contact of harvestContacts) {
			if (contact.email && contact.client?.id && !emailByClientId.has(contact.client.id)) {
				emailByClientId.set(contact.client.id, contact.email);
			}
		}

		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');

		try {
			await pb.health.check();
		} catch {
			const pbUrl = env.PB_URL || 'http://localhost:8090';
			return fail(503, {
				importError: `Cannot reach PocketBase at ${pbUrl}. Make sure it is running and the schema has been imported (node pb_setup.js).`
			});
		}

		// ── 1. Upsert clients ─────────────────────────────────────────────────────
		const clientIdMap = new Map<number, string>(); // harvest id → pb id
		let clientsCreated = 0, clientsSkipped = 0;
		const importErrors: string[] = [];

		for (const hc of harvestClients) {
			const email = emailByClientId.get(hc.id) ?? '';
			try {
				const existing = await pb.collection('clients').getFirstListItem(`harvest_id = "${hc.id}"`);
				clientIdMap.set(hc.id, existing.id);
				// Backfill email if the client record has none
				if (!existing.email && email) {
					await pb.collection('clients').update(existing.id, { email });
				}
				clientsSkipped++;
			} catch {
				try {
					const record = await pb.collection('clients').create({
						name: hc.name,
						email,
						address: hc.address ?? '',
						currency: hc.currency ?? 'USD',
						harvest_id: String(hc.id),
						archived: !hc.is_active
					});
					clientIdMap.set(hc.id, record.id);
					clientsCreated++;
				} catch (e) {
					importErrors.push(`Client "${hc.name}": ${(e as Error).message}`);
				}
			}
		}

		// ── 2. Upsert invoices + line items ───────────────────────────────────────
		let invCreated = 0, invFailed = 0;
		let skipMissingFields = 0, skipNoClient = 0, skipDuplicate = 0;

		const mapState = (state: string): InvoiceStatus => {
			if (state === 'paid') return 'paid';
			if (state === 'draft') return 'draft';
			if (state === 'closed') return 'written_off';
			return 'sent';
		};

		for (const hi of harvestInvoices) {
			if (!hi.number || !hi.client?.id) { skipMissingFields++; continue; }

			const pbClientId = clientIdMap.get(hi.client.id);
			if (!pbClientId) { skipNoClient++; continue; }

			try {
				await pb.collection('invoices').getFirstListItem(`number = "${hi.number}"`);
				skipDuplicate++;
				continue;
			} catch { /* not found → create */ }

			try {
				const invoice = await pb.collection('invoices').create({
					client: pbClientId,
					number: hi.number,
					issue_date: hi.issue_date ?? '',
					due_date: hi.due_date ?? '',
					status: mapState(hi.state ?? ''),
					tax_percent: hi.tax ?? 0,
					paid_amount: hi.paid_amount ?? 0,
					notes: hi.notes ?? ''
				});
				for (const li of (hi.line_items ?? [])) {
					const unitPrice = li.unit_price ?? li.amount ?? 0;
					if (!unitPrice) continue;
					await pb.collection('invoice_items').create({
						invoice: invoice.id,
						description: li.description || 'Services',
						quantity: li.quantity ?? 1,
						unit_price: unitPrice
					});
				}
				invCreated++;
			} catch (e) {
				importErrors.push(`Invoice #${hi.number}: ${(e as Error).message}`);
				invFailed++;
			}
		}

		return {
			importSuccess: true,
			importStats: {
				clientsCreated,
				clientsSkipped,
				invCreated,
				invSkipped: skipMissingFields + skipNoClient + skipDuplicate,
				invFailed,
				skipMissingFields,
				skipNoClient,
				skipDuplicate,
				errors: importErrors.slice(0, 50)
			}
		};
	},

	resetData: async () => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');

		try {
			// Delete in dependency order: items → invoices → clients
			const deleteAll = async (collection: string) => {
				let page = 1;
				while (true) {
					const res = await pb.collection(collection).getList(page, 200);
					if (res.items.length === 0) break;
					await Promise.all(res.items.map((r) => pb.collection(collection).delete(r.id)));
					if (res.items.length < 200) break;
				}
			};

			await deleteAll('invoice_items');
			await deleteAll('invoices');
			await deleteAll('clients');
		} catch (e) {
			return fail(500, { resetError: 'Reset failed: ' + (e as Error).message });
		}

		return { resetSuccess: true };
	}
};
