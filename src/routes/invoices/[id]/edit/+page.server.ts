import { error, fail, redirect } from '@sveltejs/kit';
import type { Invoice, InvoiceItem, Client } from '$lib/types.js';
import { pbErrorMessage } from '$lib/pocketbase.js';
import { getPb } from '$lib/pb.server.js';
import { changedFields, lineItemsChanged, describeChanges, FIELD_LABELS } from '$lib/changes.js';

export async function load({ params }) {
	const pb = await getPb();
	try {
		const [invoice, items, clients] = await Promise.all([
			pb.collection('invoices').getOne<Invoice & { expand: { client: Client } }>(params.id, { expand: 'client' }),
			pb.collection('invoice_items').getFullList<InvoiceItem>({ filter: pb.filter('invoice = {:id}', { id: params.id }), sort: 'created' }),
			pb.collection('clients').getFullList<Client>({ sort: 'name', filter: 'archived = false' })
		]);
		return { invoice, items, clients };
	} catch {
		throw error(404, 'Invoice not found');
	}
}

export const actions = {
	default: async ({ request, params }) => {
		const pb = await getPb();
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

		const itemsJson = data.get('items')?.toString() || '[]';
		let items: { description: string; quantity: number; unit_price: number }[] = [];
		try { items = JSON.parse(itemsJson); } catch { return fail(400, { error: 'Invalid line items' }); }

		try {
			const fields = { client, number, subject, issue_date, due_date, payment_terms, status, tax_percent, notes };
			const [current, existing] = await Promise.all([
				pb.collection('invoices').getOne<Invoice>(params.id),
				pb.collection('invoice_items').getFullList<InvoiceItem>({ filter: pb.filter('invoice = {:id}', { id: params.id }), sort: 'created' })
			]);
			const changed = changedFields(current, fields, ['issue_date', 'due_date']);
			const itemsChanged = lineItemsChanged(existing, items);

			if (changed.length) {
				await pb.collection('invoices').update(params.id, fields);
			}

			if (itemsChanged) {
				// Delete existing items and recreate
				await Promise.all(existing.map((i) => pb.collection('invoice_items').delete(i.id)));
				for (const item of items) {
					await pb.collection('invoice_items').create({ invoice: params.id, description: item.description, quantity: item.quantity, unit_price: item.unit_price });
				}
			}

			// Log the edit only when something actually changed (non-critical)
			const changes = changed.map((key) => FIELD_LABELS[key]);
			if (itemsChanged) changes.push('line items');
			if (changes.length) {
				try {
					await pb.collection('invoice_logs').create({
						invoice: params.id,
						action: 'edited',
						detail: describeChanges(changes),
						occurred_at: new Date().toISOString()
					});
				} catch { /* ignore */ }
			}
		} catch (e: unknown) {
			return fail(500, { error: pbErrorMessage(e, 'Failed to update invoice') });
		}

		return redirect(302, `/invoices/${params.id}`);
	}
};
