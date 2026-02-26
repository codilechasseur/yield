import { fail, redirect } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import type { Client } from '$lib/types.js';
import { getSmtpSettings } from '$lib/mail.server.js';

export async function load({ url }) {
	const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
	const preselectedClient = url.searchParams.get('client') || '';

	const [clients, settings] = await Promise.all([
		pb.collection('clients').getFullList<Client>({ sort: 'name', filter: 'archived = false' }).catch(() => [] as Client[]),
		getSmtpSettings(pb).catch(() => null)
	]);

	const defaultTaxPercent = settings?.default_tax_percent ?? 5;
	const defaultNotes = settings?.invoice_default_notes ?? '';

	// Build the suggested invoice number from settings
	const format = settings?.invoice_number_format?.trim() || 'INV-{number}';
	const nextNum = settings?.invoice_next_number ?? null;
	let suggestedInvoiceNumber: string;
	if (nextNum !== null && nextNum > 0) {
		suggestedInvoiceNumber = format.replace('{number}', String(nextNum));
	} else {
		// Fall back to date-based number
		const today = new Date().toISOString().split('T')[0];
		suggestedInvoiceNumber = `INV-${today.replace(/-/g, '')}-001`;
	}

	return { clients, preselectedClient, defaultTaxPercent, defaultNotes, suggestedInvoiceNumber };
}

export const actions = {
	default: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const data = await request.formData();

		const client = data.get('client')?.toString();
		const number = data.get('number')?.toString().trim();
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

			const invoice = await pb.collection('invoices').create({
				client,
				number,
				issue_date,
				due_date,
				payment_terms,
				status,
				tax_percent,
				notes
			});
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

			// Auto-increment the next invoice number in settings if the user used the suggested number
			if (settingsRecord?.id && settingsRecord.invoice_next_number) {
				const fmt = settingsRecord.invoice_number_format?.trim() || 'INV-{number}';
				const expectedNumber = fmt.replace('{number}', String(settingsRecord.invoice_next_number));
				if (number === expectedNumber) {
					await pb.collection('settings').update(settingsRecord.id, {
						invoice_next_number: settingsRecord.invoice_next_number + 1
					}).catch(() => { /* non-critical */ });
				}
			}
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Failed to create invoice';
			return fail(500, { error: msg });
		}

		return redirect(302, `/invoices/${invoiceId}`);
	}
};
