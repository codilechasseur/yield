import { fail, redirect } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import type { Client } from '$lib/types.js';
import { getSmtpSettings } from '$lib/mail.server.js';
import { pbErrorMessage } from '$lib/pocketbase.js';
import { suggestNextNumber, advanceCounter, createWithAutoNumber } from '$lib/numbering.server.js';

export async function load({ url }) {
	const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
	const preselectedClient = url.searchParams.get('client') || '';

	const [clients, settings] = await Promise.all([
		pb.collection('clients').getFullList<Client>({ sort: 'name', filter: 'archived = false' }).catch(() => [] as Client[]),
		getSmtpSettings(pb).catch(() => null)
	]);

	const defaultTaxPercent = settings?.default_tax_percent ?? 5;
	const defaultNotes = settings?.invoice_default_notes ?? '';

	const suggestedInvoiceNumber = await suggestNextNumber(pb, 'invoice', settings);

	return { clients, preselectedClient, defaultTaxPercent, defaultNotes, suggestedInvoiceNumber };
}

export const actions = {
	default: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const data = await request.formData();

		const client = data.get('client')?.toString();
		const number = data.get('number')?.toString().trim();
		const subject = data.get('subject')?.toString().trim() ?? '';
		const issue_date = data.get('issue_date')?.toString();
		const due_date = data.get('due_date')?.toString();
		const payment_terms = data.get('payment_terms')?.toString() || 'net_30';
		const status = data.get('status')?.toString() || 'draft';
		const tax_percent = parseFloat(data.get('tax_percent')?.toString() || '0');
		const notes = data.get('notes')?.toString() || '';

		if (!client) return fail(400, { error: 'Client is required' });
		if (!number) return fail(400, { error: 'Invoice number is required' });

		// Parse line items from formData (sent as JSON string)
		const itemsJson = data.get('items')?.toString() || '[]';
		let items: { description: string; quantity: number; unit_price: number }[] = [];
		try {
			items = JSON.parse(itemsJson);
		} catch {
			return fail(400, { error: 'Invalid line items' });
		}

		let invoiceId: string;
		try {
			// Fetch settings to auto-increment invoice number after creation
			const settingsRecord = await getSmtpSettings(pb).catch(() => null);

			const fields = { client, subject, issue_date, due_date, payment_terms, status, tax_percent, notes };
			const createInvoice = (n: string) => pb.collection('invoices').create({ ...fields, number: n });
			// An accepted suggestion may have been taken since the form loaded — take
			// the next free one. A number the user typed is used as-is.
			const { record: invoice, number: usedNumber } =
				number === data.get('suggested_number')?.toString()
					? await createWithAutoNumber(pb, 'invoice', settingsRecord, number, createInvoice)
					: { record: await createInvoice(number), number };
			invoiceId = invoice.id;

			for (const item of items) {
				await pb.collection('invoice_items').create({
					invoice: invoice.id,
					description: item.description,
					quantity: item.quantity,
					unit_price: item.unit_price
				});
			}

			await pb.collection('invoice_logs').create({
				invoice: invoice.id,
				action: 'invoice_created',
				detail: 'Invoice created',
				occurred_at: new Date().toISOString()
			}).catch(() => { /* non-critical */ });

			await advanceCounter(pb, 'invoice', settingsRecord, usedNumber);
		} catch (e: unknown) {
			return fail(500, { error: pbErrorMessage(e, 'Failed to create invoice') });
		}

		return redirect(302, `/invoices/${invoiceId}`);
	}
};
