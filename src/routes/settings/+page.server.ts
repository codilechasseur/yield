import { fail } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import Papa from 'papaparse';
import { env } from '$env/dynamic/private';
import { getSmtpSettings, sendInvoiceEmail, DEFAULT_EMAIL_SUBJECT, DEFAULT_EMAIL_BODY } from '$lib/mail.server.js';
import type { SmtpSettings } from '$lib/mail.server.js';
import { hashPassword, invalidatePasswordCache } from '$lib/auth.server.js';

export async function load() {
	const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
	const smtp = await getSmtpSettings(pb);
	const hasPassword = Boolean(smtp?.app_password_hash);
	let clientCount = 0;
	try {
		const r = await pb.collection('clients').getList(1, 1);
		clientCount = r.totalItems;
	} catch { /* ignore — collections may not exist yet */ }
	return { smtp, DEFAULT_EMAIL_SUBJECT, DEFAULT_EMAIL_BODY, hasPassword, clientCount };
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

		try {
			const existing = await getSmtpSettings(pb);
			if (existing?.id) {
				await pb.collection('settings').update(existing.id, { brand_hue });
			} else {
				await pb.collection('settings').create({ brand_hue });
			}
		} catch {
			// silently ignore — hue is cosmetic only
		}

		return {};
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
		const fd = await request.formData();
		const file = fd.get('csv');

		if (!(file instanceof File) || !file.name.endsWith('.csv')) {
			return fail(400, { importError: 'Please select a Harvest CSV export file (.csv).' });
		}

		let text: string;
		try {
			text = await file.text();
		} catch {
			return fail(400, { importError: 'Could not read the uploaded file.' });
		}

		const parsed = Papa.parse<Record<string, string>>(text, {
			header: true,
			skipEmptyLines: true
		});

		const rows = parsed.data;
		if (rows.length === 0) {
			return fail(400, { importError: 'The CSV file is empty or could not be parsed.' });
		}

		const firstRow = rows[0];
		if (!('Client' in firstRow) || !('ID' in firstRow) || !('Issue Date' in firstRow)) {
			return fail(400, {
				importError:
					"This doesn't look like a Harvest invoice report. Expected columns: Client, ID, Issue Date, Subtotal, etc."
			});
		}

		// ── Helpers (mirrored from migrate.js) ───────────────────────────────────
		const parseNum = (val: string | undefined) =>
			parseFloat(String(val ?? '').replace(/,/g, '')) || 0;

		const parseCurrency = (val: string | undefined) => {
			if (!val) return 'USD';
			const m = String(val).match(/[-\u2013]\s*([A-Z]{3})\s*$/);
			return m ? m[1] : String(val).trim().slice(0, 10);
		};

		const deriveStatus = (balance: string | undefined, issueDate: string | undefined) => {
			if (parseNum(balance) === 0) return 'paid';
			if (issueDate && new Date(issueDate) > new Date()) return 'draft';
			return 'sent';
		};

		const toIso = (d: string | undefined) => {
			if (!d) return '';
			try { return new Date(d).toISOString().split('T')[0]; } catch { return ''; }
		};

		const addDays = (iso: string, n: number) => {
			if (!iso) return '';
			try {
				const d = new Date(iso);
				d.setUTCDate(d.getUTCDate() + n);
				return d.toISOString().split('T')[0];
			} catch { return ''; }
		};

		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');

		// ── 0. Verify PocketBase is reachable ────────────────────────────────────
		try {
			await pb.health.check();
		} catch {
			const pbUrl = env.PB_URL || 'http://localhost:8090';
			return fail(503, {
				importError: `Cannot reach PocketBase at ${pbUrl}. Make sure it is running and the schema has been imported (node pb_setup.js).`
			});
		}

		// ── 1. Deduplicate & upsert clients ──────────────────────────────────────
		const clientIdMap = new Map<string, string>();
		const uniqueClients = new Map<string, Record<string, string>>();
		for (const row of rows) {
			const name = (row['Client'] || '').trim();
			if (name && !uniqueClients.has(name)) uniqueClients.set(name, row);
		}

		let clientsCreated = 0, clientsSkipped = 0;
		const importErrors: string[] = [];

		for (const [name, row] of uniqueClients) {
			try {
				const existing = await pb
					.collection('clients')
					.getFirstListItem(`name = "${name.replace(/"/g, '\\"')}"`);
				clientIdMap.set(name, existing.id);
				clientsSkipped++;
				continue;
			} catch { /* not found → create */ }

			try {
				const record = await pb.collection('clients').create({
					name,
					address: (row['Client Address'] || '').trim(),
					currency: parseCurrency(row['Currency'])
				});
				clientIdMap.set(name, record.id);
				clientsCreated++;
			} catch (e) {
				importErrors.push(`Client "${name}": ${(e as Error).message}`);
			}
		}

		// ── 2. Create invoices + line items ──────────────────────────────────────
		let invCreated = 0, invFailed = 0;
		let skipMissingFields = 0, skipNoClient = 0, skipDuplicate = 0;

		for (const row of rows) {
			const harvestId = (row['ID'] || '').trim();
			const clientName = (row['Client'] || '').trim();
			const subject = (row['Subject'] || '').trim();
			const issueDate = toIso(row['Issue Date']);
			const subtotal = parseNum(row['Subtotal']);
			const tax = parseNum(row['Tax']);
			const status = deriveStatus(row['Balance'], row['Issue Date']);
			const number = harvestId;

			if (!harvestId || !clientName) { skipMissingFields++; continue; }

			const pbClientId = clientIdMap.get(clientName);
			if (!pbClientId) {
				if (skipNoClient < 5) {
					importErrors.push(`Invoice #${number}: no client found for "${clientName}"`);
				}
				skipNoClient++;
				continue;
			}

			try {
				await pb.collection('invoices').getFirstListItem(`number = "${number}"`);
				skipDuplicate++;
				continue;
			} catch { /* not found → create */ }

			const taxPercent = subtotal > 0 ? Math.round((tax / subtotal) * 10000) / 100 : 0;

			try {
				const invoice = await pb.collection('invoices').create({
					client: pbClientId,
					number,
					issue_date: issueDate,
					due_date: addDays(issueDate, 30),
					status,
					tax_percent: taxPercent,
					notes: (row['PO Number'] || '').trim()
				});
				if (subtotal > 0) {
					await pb.collection('invoice_items').create({
						invoice: invoice.id,
						description: subject || 'Services',
						quantity: 1,
						unit_price: subtotal
					});
				}
				invCreated++;
			} catch (e) {
				importErrors.push(`Invoice #${number}: ${(e as Error).message}`);
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
