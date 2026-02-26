import { error, fail } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import { calcSubtotal, calcTotal } from '$lib/pocketbase.js';
import type { Client, Contact, Invoice, InvoiceItem } from '$lib/types.js';

export async function load({ params }) {
	const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');

	try {
		const [client, rawInvoices, contacts] = await Promise.all([
			pb.collection('clients').getOne<Client>(params.id),
			pb.collection('invoices').getFullList<Invoice & { expand?: { invoice_items_via_invoice?: InvoiceItem[] } }>({
				filter: `client = "${params.id}"`,
				sort: '-issue_date',
				expand: 'invoice_items_via_invoice'
			}),
			pb.collection('contacts').getFullList<Contact>({
				filter: `client = "${params.id}"`,
				sort: 'first_name,last_name'
			}).catch(() => [] as Contact[])
		]);
		const invoices = rawInvoices.map((inv) => {
			const items = inv.expand?.invoice_items_via_invoice ?? [];
			const subtotal = calcSubtotal(items);
			return { ...inv, total: calcTotal(subtotal, inv.tax_percent ?? 0) };
		});
		return { client, invoices, contacts };
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
		const default_hourly_rate = parseFloat(data.get('default_hourly_rate')?.toString() ?? '0') || 0;

		if (!name) return fail(400, { error: 'Name is required' });

		try {
			await pb.collection('clients').update(params.id, { name, email, address, currency, default_hourly_rate });
		} catch (e: unknown) {
			return fail(500, { error: 'Failed to update client' });
		}

		return { success: true };
	},

	addContact: async ({ request, params }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const data = await request.formData();

		const first_name = data.get('first_name')?.toString().trim() ?? '';
		const last_name = data.get('last_name')?.toString().trim() ?? '';
		const email = data.get('email')?.toString().trim() ?? '';
		const title = data.get('title')?.toString().trim() ?? '';
		const phone = data.get('phone')?.toString().trim() ?? '';

		if (!first_name && !last_name) return fail(400, { contactError: 'A first or last name is required' });

		try {
			await pb.collection('contacts').create({
				client: params.id,
				first_name,
				last_name,
				email,
				title,
				phone,
				harvest_id: ''
			});
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Failed to add contact';
			return fail(500, { contactError: msg });
		}

		return { contactSuccess: true };
	},

	updateContact: async ({ request, params }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const data = await request.formData();

		const contactId = data.get('contact_id')?.toString();
		if (!contactId) return fail(400, { contactError: 'Missing contact ID' });

		const first_name = data.get('first_name')?.toString().trim() ?? '';
		const last_name = data.get('last_name')?.toString().trim() ?? '';
		const email = data.get('email')?.toString().trim() ?? '';
		const title = data.get('title')?.toString().trim() ?? '';
		const phone = data.get('phone')?.toString().trim() ?? '';

		if (!first_name && !last_name) return fail(400, { contactError: 'A first or last name is required' });

		try {
			// Verify the contact belongs to this client
			const existing = await pb.collection('contacts').getOne<Contact>(contactId);
			if (existing.client !== params.id) return fail(403, { contactError: 'Contact does not belong to this client' });

			await pb.collection('contacts').update(contactId, { first_name, last_name, email, title, phone });
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Failed to update contact';
			return fail(500, { contactError: msg });
		}

		return { contactSuccess: true };
	},

	deleteContact: async ({ request, params }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const data = await request.formData();

		const contactId = data.get('contact_id')?.toString();
		if (!contactId) return fail(400, { contactError: 'Missing contact ID' });

		try {
			// Verify the contact belongs to this client
			const existing = await pb.collection('contacts').getOne<Contact>(contactId);
			if (existing.client !== params.id) return fail(403, { contactError: 'Contact does not belong to this client' });

			await pb.collection('contacts').delete(contactId);
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Failed to delete contact';
			return fail(500, { contactError: msg });
		}

		return { contactSuccess: true };
	}
};
