import { error, fail, redirect } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import type { Invoice, InvoiceItem, Client, InvoiceLog } from '$lib/types.js';
import { sendInvoiceEmail, getSmtpSettings, DEFAULT_EMAIL_SUBJECT, DEFAULT_EMAIL_BODY, interpolateEmailTemplate } from '$lib/mail.server.js';

export async function load({ params }) {
	const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');

	try {
		const [invoice, items, logs, smtp] = await Promise.all([
			pb.collection('invoices').getOne<Invoice & { expand: { client: Client } }>(params.id, { expand: 'client' }),
			pb.collection('invoice_items').getFullList<InvoiceItem>({
				filter: `invoice = "${params.id}"`,
				sort: 'created'
			}),
			pb.collection('invoice_logs').getFullList<InvoiceLog>({
				filter: `invoice = "${params.id}"`,
				sort: 'occurred_at,created'
			}),
			getSmtpSettings(pb)
		]);

		const client = invoice.expand?.client ?? null;
		const currency = client?.currency ?? 'USD';
		const subtotal = items.reduce((s: number, i: InvoiceItem) => s + i.quantity * i.unit_price, 0);
		const total = subtotal * (1 + invoice.tax_percent / 100);
		const fmtCurrency = (n: number) =>
			new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
		const fmtDate = (d: string) =>
			d ? new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—';

		const vars: Record<string, string> = {
			invoice_number: invoice.number,
			client_name: client?.name ?? '',
			total: fmtCurrency(total),
			due_date: fmtDate(invoice.due_date),
			issue_date: fmtDate(invoice.issue_date),
			company_name: smtp?.company_name || smtp?.smtp_from_name || '',
			due_date_line: invoice.due_date ? `Due date: ${fmtDate(invoice.due_date)}\n\n` : ''
		};

		const emailSubject = interpolateEmailTemplate(
			smtp?.email_subject?.trim() || DEFAULT_EMAIL_SUBJECT, vars
		);
		const emailBody = interpolateEmailTemplate(
			smtp?.email_body?.trim() || DEFAULT_EMAIL_BODY, vars
		);

		return { invoice, items, logs, emailSubject, emailBody };
	} catch {
		throw error(404, 'Invoice not found');
	}
}

export const actions = {
	updateStatus: async ({ request, params }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const data = await request.formData();
		const status = data.get('status')?.toString();

		if (!['draft', 'sent', 'paid', 'overdue'].includes(status ?? '')) {
			return fail(400, { error: 'Invalid status' });
		}

		try {
			const current = await pb.collection('invoices').getOne(params.id, { fields: 'status' });
			const prevStatus = current.status;
			await pb.collection('invoices').update(params.id, { status });
			if (prevStatus !== status) {
				await pb.collection('invoice_logs').create({
					invoice: params.id,
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
			await pb.collection('invoice_logs').create({
				invoice: params.id,
				action: 'note',
				detail: note,
				occurred_at: new Date().toISOString()
			});
		} catch {
			return fail(500, { error: 'Failed to add note' });
		}
		return { success: true };
	},

	recordPayment: async ({ request, params }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const data = await request.formData();
		const amount = parseFloat(data.get('amount')?.toString() || '0');
		const note = data.get('note')?.toString().trim() || '';

		if (isNaN(amount) || amount <= 0) return fail(400, { error: 'Enter a valid payment amount' });

		try {
			const [inv, items] = await Promise.all([
				pb.collection('invoices').getOne(params.id, { fields: 'paid_amount,tax_percent,status,expand' }),
				pb.collection('invoice_items').getFullList({ filter: `invoice = "${params.id}"`, fields: 'quantity,unit_price' })
			]);

			const subtotal = (items as unknown as Array<{ quantity: number; unit_price: number }>).reduce((s, i) => s + i.quantity * i.unit_price, 0);
			const total = Math.round(subtotal * (1 + (inv.tax_percent as number) / 100) * 100) / 100;
			const currentPaid = Math.round((inv.paid_amount ?? 0) * 100) / 100;
			const balance = Math.round((total - currentPaid) * 100) / 100;

			if (amount > balance + 0.001) {
				return fail(400, { error: `Payment amount exceeds remaining balance` });
			}

			const newPaid = Math.round((currentPaid + amount) * 100) / 100;
			const newStatus = newPaid >= total - 0.001 ? 'paid' : inv.status;

			await pb.collection('invoices').update(params.id, { paid_amount: newPaid, status: newStatus });

			const logDetail = note ? `Payment of ${amount} recorded — ${note}` : `Payment of ${amount} recorded`;
			await pb.collection('invoice_logs').create({
				invoice: params.id,
				action: 'payment_recorded',
				detail: logDetail,
				occurred_at: new Date().toISOString()
			});

			if (newStatus === 'paid' && inv.status !== 'paid') {
				await pb.collection('invoice_logs').create({
					invoice: params.id,
					action: 'status_changed',
					detail: `${inv.status} → paid`,
					occurred_at: new Date().toISOString()
				});
			}
		} catch {
			return fail(500, { error: 'Failed to record payment' });
		}
		return { success: true };
	},

	delete: async ({ params }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		try {
			await pb.collection('invoices').delete(params.id);
		} catch {
			return fail(500, { error: 'Failed to delete invoice' });
		}
		return redirect(302, '/invoices');
	},

	sendInvoice: async ({ request, params }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const fd = await request.formData();
		const message = fd.get('message')?.toString().trim() || undefined;

		// Load client email
		let toEmail = '';
		let toName = '';
		try {
			const inv = await pb
				.collection('invoices')
				.getOne<Invoice & { expand: { client: Client } }>(params.id, { expand: 'client' });
			toEmail = inv.expand?.client?.email ?? '';
			toName = inv.expand?.client?.name ?? '';
		} catch {
			return fail(404, { sendError: 'Invoice not found.' });
		}

		if (!toEmail) {
			return fail(400, { sendError: 'This client has no email address on file.' });
		}

		try {
			await sendInvoiceEmail({ pb, invoiceId: params.id, toEmail, toName, message });

			// Log the send
			await pb.collection('invoice_logs').create({
				invoice: params.id,
				action: 'email_sent',
				detail: `Invoice emailed to ${toEmail}`,
				occurred_at: new Date().toISOString()
			});
		} catch (e) {
			return fail(500, { sendError: (e as Error).message });
		}

		return { sendSuccess: true };
	}
};
