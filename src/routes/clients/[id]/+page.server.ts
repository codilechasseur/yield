import { error, fail } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import { calcSubtotal, calcTotal } from '$lib/pocketbase.js';
import type { Client, Invoice, InvoiceItem } from '$lib/types.js';

export async function load({ params }) {
	const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');

	try {
		const [client, rawInvoices] = await Promise.all([
			pb.collection('clients').getOne<Client>(params.id),
			pb.collection('invoices').getFullList<Invoice & { expand?: { invoice_items_via_invoice?: InvoiceItem[] } }>({
				filter: `client = "${params.id}"`,
				sort: '-issue_date',
				expand: 'invoice_items_via_invoice'
			})
		]);
		const invoices = rawInvoices.map((inv) => {
			const items = inv.expand?.invoice_items_via_invoice ?? [];
			const subtotal = calcSubtotal(items);
			return { ...inv, total: calcTotal(subtotal, inv.tax_percent ?? 0) };
		});
		return { client, invoices };
	} catch {
		throw error(404, 'Client not found');
	}
}

export const actions = {
	update: async ({ request, params }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const data = await request.formData();

		const name = data.get('name')?.toString().trim();
		const email = data.get('email')?.toString().trim() ?? '';
		const address = data.get('address')?.toString().trim() ?? '';
		const currency = data.get('currency')?.toString().trim() || 'USD';

		if (!name) return fail(400, { error: 'Name is required' });

		try {
			await pb.collection('clients').update(params.id, { name, email, address, currency });
		} catch (e: unknown) {
			return fail(500, { error: 'Failed to update client' });
		}

		return { success: true };
	}
};
