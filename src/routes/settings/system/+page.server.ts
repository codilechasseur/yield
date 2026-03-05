import { fail } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import type { InvoiceStatus, Backup } from '$lib/types.js';
import { getSmtpSettings } from '$lib/mail.server.js';
import type { SmtpSettings } from '$lib/mail.server.js';
import { hashPassword, invalidatePasswordCache } from '$lib/auth.server.js';

/** Authenticate as PocketBase superuser (required for backup operations). */
async function getAdminPb(): Promise<PocketBase> {
	const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
	const email = env.PB_ADMIN_EMAIL;
	const password = env.PB_ADMIN_PASSWORD;
	if (!email || !password) throw new Error('PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD are not set');
	await pb.collection('_superusers').authWithPassword(email, password);
	return pb;
}

export async function load() {
	const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
	const smtp = await getSmtpSettings(pb);
	const hasPassword = Boolean(smtp?.app_password_hash);

	let clientCount = 0;
	try {
		const r = await pb.collection('clients').getList(1, 1);
		clientCount = r.totalItems;
	} catch { /* ignore — collections may not exist yet */ }

	let backups: Backup[] = [];
	let backupsError: string | null = null;
	let backupsMissingCreds = false;
	try {
		const adminPb = await getAdminPb();
		const raw = await adminPb.backups.getFullList();
		backups = raw
			.map((b) => ({ key: b.key, size: b.size, modified: b.modified }))
			.sort((a, b) => b.modified.localeCompare(a.modified));
	} catch (e) {
		const msg = (e as Error).message;
		if (msg.includes('PB_ADMIN_EMAIL') || msg.includes('PB_ADMIN_PASSWORD')) {
			backupsMissingCreds = true;
		} else {
			backupsError = msg;
		}
	}

	return { smtp, hasPassword, clientCount, backups, backupsError, backupsMissingCreds };
}

export const actions = {
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
			return fail(500, { smtpError: 'Failed to save settings: ' + (e as Error).message });
		}

		return { smtpSuccess: true };
	},

	testSmtp: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const fd = await request.formData();
		const testTo = fd.get('test_to')?.toString().trim();

		if (!testTo) return fail(400, { testError: 'Enter a recipient email for the test.' });

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
		interface HarvestContact {
			id: number;
			client: { id: number };
			first_name: string;
			last_name: string;
			title: string;
			email: string;
			phone_office: string;
			phone_mobile: string;
		}
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
		const clientIdMap = new Map<number, string>();
		let clientsCreated = 0, clientsSkipped = 0;
		const importErrors: string[] = [];

		for (const hc of harvestClients) {
			const email = emailByClientId.get(hc.id) ?? '';
			try {
				const existing = await pb.collection('clients').getFirstListItem(`harvest_id = "${hc.id}"`);
				clientIdMap.set(hc.id, existing.id);
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

		// ── 2. Upsert contacts ────────────────────────────────────────────────────
		let contactsCreated = 0, contactsSkipped = 0;

		for (const hc of harvestContacts) {
			if (!hc.client?.id) continue;
			const pbClientId = clientIdMap.get(hc.client.id);
			if (!pbClientId) continue;
			const phone = hc.phone_office || hc.phone_mobile || '';
			try {
				await pb.collection('contacts').getFirstListItem(`harvest_id = "${hc.id}"`);
				contactsSkipped++;
			} catch {
				try {
					await pb.collection('contacts').create({
						client: pbClientId,
						first_name: hc.first_name ?? '',
						last_name: hc.last_name ?? '',
						email: hc.email ?? '',
						title: hc.title ?? '',
						phone,
						harvest_id: String(hc.id)
					});
					contactsCreated++;
				} catch (e) {
					importErrors.push(`Contact "${hc.first_name} ${hc.last_name}" (client ${pbClientId}): ${(e as Error).message}`);
				}
			}
		}

		// ── 3. Upsert invoices + line items ───────────────────────────────────────
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
				contactsCreated,
				contactsSkipped,
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

		const deleteAll = async (collection: string) => {
			let page = 1;
			while (true) {
				const res = await pb.collection(collection).getList(page, 200);
				if (res.items.length === 0) break;
				await Promise.all(res.items.map((r) => pb.collection(collection).delete(r.id)));
				if (res.items.length < 200) break;
			}
		};

		for (const col of ['invoice_items', 'invoices', 'contacts', 'clients']) {
			try {
				await deleteAll(col);
			} catch {
				// collection may not exist on this instance — skip and continue
			}
		}

		return { resetSuccess: true };
	},

	createBackup: async () => {
		try {
			const pb = await getAdminPb();
			await pb.backups.create('');
			return { backupCreated: true };
		} catch (e) {
			return fail(500, { backupError: (e as Error).message });
		}
	},

	deleteBackup: async ({ request }) => {
		const fd = await request.formData();
		const key = fd.get('key')?.toString();
		if (!key) return fail(400, { backupError: 'Missing backup key' });
		try {
			const pb = await getAdminPb();
			await pb.backups.delete(key);
			return { backupDeleted: true };
		} catch (e) {
			return fail(500, { backupError: (e as Error).message });
		}
	}
};
