import { error, fail, redirect } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import type { Estimate, EstimateItem, Client, EstimateLog, Contact } from '$lib/types.js';
import { sendEstimateEmail, getSmtpSettings, interpolateEmailTemplate, DEFAULT_ESTIMATE_EMAIL_SUBJECT, DEFAULT_ESTIMATE_EMAIL_BODY } from '$lib/mail.server.js';

export async function load({ params }) {
	const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');

	try {
		const [estimate, items, logs, smtp] = await Promise.all([
			pb.collection('estimates').getOne<Estimate & { expand: { client: Client } }>(params.id, { expand: 'client' }),
			pb.collection('estimate_items').getFullList<EstimateItem>({
				filter: `estimate = "${params.id}"`,
				sort: 'created'
			}),
			pb.collection('estimate_logs').getFullList<EstimateLog>({
				filter: `estimate = "${params.id}"`,
				sort: 'occurred_at,created'
			}),
			getSmtpSettings(pb)
		]);

		const client = estimate.expand?.client ?? null;
		const currency = client?.currency ?? 'USD';

		const contacts = client
			? await pb.collection('contacts').getFullList<Contact>({
					filter: `client = "${client.id}"`,
					sort: 'first_name,last_name'
				}).catch(() => [] as Contact[])
			: [] as Contact[];

		const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
		const total = subtotal * (1 + estimate.tax_percent / 100);
		const fmtCurrency = (n: number) =>
			new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
		const fmtDate = (d: string) =>
			d ? new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—';

		const vars: Record<string, string> = {
			estimate_number: estimate.number,
			client_name: client?.name ?? '',
			total: fmtCurrency(total),
			expiry_date: fmtDate(estimate.expiry_date),
			issue_date: fmtDate(estimate.issue_date),
			company_name: smtp?.company_name || smtp?.smtp_from_name || '',
			expiry_date_line: estimate.expiry_date ? `Valid until: ${fmtDate(estimate.expiry_date)}\n\n` : ''
		};

		const emailSubject = interpolateEmailTemplate(DEFAULT_ESTIMATE_EMAIL_SUBJECT, vars);
		const emailBody = interpolateEmailTemplate(DEFAULT_ESTIMATE_EMAIL_BODY, vars);

		return {
			estimate,
			items,
			logs,
			contacts,
			emailSubject,
			emailBody,
			smtpConfigured: !!(smtp?.smtp_host && smtp?.smtp_from_email)
		};
	} catch {
		throw error(404, 'Estimate not found');
	}
}

export const actions = {
	updateStatus: async ({ request, params }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const data = await request.formData();
		const status = data.get('status')?.toString();

		if (!['draft', 'accepted', 'declined'].includes(status ?? '')) {
			return fail(400, { error: 'Invalid status' });
		}

		try {
			const current = await pb.collection('estimates').getOne(params.id, { fields: 'status' });
			const prevStatus = current.status;
			await pb.collection('estimates').update(params.id, { status });
			if (prevStatus !== status) {
				await pb.collection('estimate_logs').create({
					estimate: params.id,
					action: 'status_changed',
					detail: `${prevStatus} → ${status}`,
					occurred_at: new Date().toISOString()
				});
			}
		} catch {
			return fail(500, { error: 'Failed to update status' });
		}

		return { success: true };
	},

	addNote: async ({ request, params }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const data = await request.formData();
		const note = data.get('note')?.toString().trim();
		if (!note) return fail(400, { error: 'Note cannot be empty' });
		try {
			await pb.collection('estimate_logs').create({
				estimate: params.id,
				action: 'note',
				detail: note,
				occurred_at: new Date().toISOString()
			});
		} catch {
			return fail(500, { error: 'Failed to add note' });
		}
		return { success: true };
	},

	sendEstimate: async ({ request, params }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const fd = await request.formData();
		const message = fd.get('message')?.toString().trim() || undefined;
		const extraRecipientsRaw = fd.get('extra_recipients')?.toString().trim() || '';
		const contactIdsRaw = fd.getAll('contact_ids').map((v) => v.toString()).filter(Boolean);

		const extraEmails = extraRecipientsRaw
			.split(',')
			.map((e) => e.trim())
			.filter((e) => e.includes('@'));

		let clientEmail = '';
		let clientId = '';
		let toName = '';
		try {
			const est = await pb
				.collection('estimates')
				.getOne<Estimate & { expand: { client: Client } }>(params.id, { expand: 'client' });
			clientEmail = est.expand?.client?.email ?? '';
			clientId = est.expand?.client?.id ?? '';
			toName = est.expand?.client?.name ?? '';
		} catch {
			return fail(404, { sendError: 'Estimate not found.' });
		}

		const contactEmails: string[] = [];
		if (contactIdsRaw.length > 0 && clientId) {
			try {
				const contacts = await pb.collection('contacts').getFullList<Contact>({
					filter: `client = "${clientId}"`,
					fields: 'id,email'
				});
				const contactMap = new Map(contacts.map((c) => [c.id, c.email]));
				for (const id of contactIdsRaw) {
					const email = contactMap.get(id);
					if (email) contactEmails.push(email);
				}
			} catch { /* Non-critical */ }
		}

		const primaryEmails = contactEmails.length > 0 ? contactEmails : (clientEmail ? [clientEmail] : []);
		const allEmails = [...new Set([...primaryEmails, ...extraEmails])].filter(Boolean);

		if (allEmails.length === 0) {
			return fail(400, { sendError: 'No recipients specified. Add a contact with an email address or enter additional recipients below.' });
		}

		const toEmail = allEmails.length === 1 ? allEmails[0] : allEmails;

		try {
			await sendEstimateEmail({ pb, estimateId: params.id, toEmail, toName, message });

			await pb.collection('estimate_logs').create({
				estimate: params.id,
				action: 'email_sent',
				detail: `Estimate emailed to ${allEmails.join(', ')}`,
				occurred_at: new Date().toISOString()
			});

			// Auto-advance draft → sent
			const current = await pb.collection('estimates').getOne(params.id, { fields: 'status' });
			if (current.status === 'draft') {
				await pb.collection('estimates').update(params.id, { status: 'sent' });
				await pb.collection('estimate_logs').create({
					estimate: params.id,
					action: 'status_changed',
					detail: 'draft → sent',
					occurred_at: new Date().toISOString()
				});
			}
		} catch (e) {
			return fail(500, { sendError: (e as Error).message });
		}

		return { sendSuccess: true };
	},

	convertToInvoice: async ({ params }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');

		try {
			const [estimate, items, settings] = await Promise.all([
				pb.collection('estimates').getOne<Estimate>(params.id),
				pb.collection('estimate_items').getFullList<EstimateItem>({
					filter: `estimate = "${params.id}"`,
					sort: 'created'
				}),
				getSmtpSettings(pb).catch(() => null)
			]);

			// Build invoice number
			const format = settings?.invoice_number_format?.trim() || 'INV-{number}';
			const nextNum = settings?.invoice_next_number ?? null;
			let invoiceNumber: string;
			if (nextNum !== null && nextNum > 0) {
				invoiceNumber = format.replace('{number}', String(nextNum));
			} else {
				const today = new Date().toISOString().split('T')[0];
				invoiceNumber = `INV-${today.replace(/-/g, '')}-001`;
			}

			const today = new Date().toISOString().split('T')[0];
			const defaultDue = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

			const invoice = await pb.collection('invoices').create({
				client: estimate.client,
				number: invoiceNumber,
				issue_date: today,
				due_date: defaultDue,
				payment_terms: 'net_30',
				status: 'draft',
				tax_percent: estimate.tax_percent,
				notes: estimate.notes
			});

			for (const item of items) {
				await pb.collection('invoice_items').create({
					invoice: invoice.id,
					description: item.description,
					quantity: item.quantity,
					unit_price: item.unit_price
				});
			}

			// Log the invoice creation
			await pb.collection('invoice_logs').create({
				invoice: invoice.id,
				action: 'invoice_created',
				detail: `Created from estimate ${estimate.number}`,
				occurred_at: new Date().toISOString()
			}).catch(() => { /* non-critical */ });

			// Mark estimate as accepted + link to invoice
			await pb.collection('estimates').update(params.id, {
				status: 'accepted',
				invoice: invoice.id
			});

			await pb.collection('estimate_logs').create({
				estimate: params.id,
				action: 'converted_to_invoice',
				detail: `Converted to invoice ${invoiceNumber}`,
				occurred_at: new Date().toISOString()
			}).catch(() => { /* non-critical */ });

			// Auto-increment invoice number
			if (settings?.id && settings.invoice_next_number) {
				const fmt = settings.invoice_number_format?.trim() || 'INV-{number}';
				const expectedNumber = fmt.replace('{number}', String(settings.invoice_next_number));
				if (invoiceNumber === expectedNumber) {
					await pb.collection('settings').update(settings.id, {
						invoice_next_number: settings.invoice_next_number + 1
					}).catch(() => { /* non-critical */ });
				}
			}

			return redirect(302, `/invoices/${invoice.id}`);
		} catch (e) {
			if (e instanceof Response) throw e; // re-throw redirects
			return fail(500, { error: 'Failed to convert estimate to invoice' });
		}
	},

	delete: async ({ params }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		try {
			await pb.collection('estimates').delete(params.id);
		} catch {
			return fail(500, { error: 'Failed to delete estimate' });
		}
		return redirect(302, '/estimates');
	}
};
