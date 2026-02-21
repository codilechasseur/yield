import { error, fail, redirect } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import type { Invoice, InvoiceItem, Client } from '$lib/types.js';

export async function load({ params }) {
	const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
	try {
		const [invoice, items, clients] = await Promise.all([
			pb.collection('invoices').getOne<Invoice & { expand: { client: Client } }>(params.id, { expand: 'client' }),
			pb.collection('invoice_items').getFullList<InvoiceItem>({ filter: `invoice = "${params.id}"`, sort: 'created' }),
			pb.collection('clients').getFullList<Client>({ sort: 'name', filter: 'archived = false' })
		]);
		return { invoice, items, clients };
	} catch {
		throw error(404, 'Invoice not found');
	}
}

export const actions = {
	default: async ({ request, params }) => {
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

		const itemsJson = data.get('items')?.toString() || '[]';
		let items: { description: string; quantity: number; unit_price: number }[] = [];
		try { items = JSON.parse(itemsJson); } catch { return fail(400, { error: 'Invalid line items' }); }

		try {
			await pb.collection('invoices').update(params.id, { client, number, issue_date, due_date, payment_terms, status, tax_percent, notes });

			// Delete existing items and recreate
			const existing = await pb.collection('invoice_items').getFullList({ filter: `invoice = "${params.id}"` });
			await Promise.all(existing.map((i) => pb.collection('invoice_items').delete(i.id)));
			for (const item of items) {
				await pb.collection('invoice_items').create({ invoice: params.id, description: item.description, quantity: item.quantity, unit_price: item.unit_price });
			}

			// Log the edit (non-critical)
			try {
				await pb.collection('invoice_logs').create({
					invoice: params.id,
					action: 'edited',
					detail: 'Invoice details updated',
					occurred_at: new Date().toISOString()
				});
			} catch { /* ignore */ }
		} catch (e: unknown) {
			return fail(500, { error: 'Failed to update invoice' });
		}

		return redirect(302, `/invoices/${params.id}`);
	}
};
