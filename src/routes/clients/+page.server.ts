import { fail } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import { getSmtpSettings } from '$lib/mail.server.js';
import type { Client } from '$lib/types.js';

const PER_PAGE = 20;

type ClientTotals = Record<string, { total: number; paid: number; outstanding: number; invoiceCount: number }>;

export async function load({ url }) {
	const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
	const showArchived = url.searchParams.get('archived') === '1';

	try {
		const result = await pb.collection('clients').getList<Client>(page, PER_PAGE, {
			sort: 'name',
			filter: showArchived ? 'archived = true' : 'archived = false || archived = null'
		});

		const clientTotals: ClientTotals = {};
		const clientIds = result.items.map((c) => c.id);
		for (const id of clientIds) {
			clientTotals[id] = { total: 0, paid: 0, outstanding: 0, invoiceCount: 0 };
		}

		if (clientIds.length > 0) {
			try {
				const itemFilter = clientIds.map((id) => `invoice.client="${id}"`).join(' || ');
				const items = await pb.collection('invoice_items').getFullList({
					filter: itemFilter,
					expand: 'invoice',
					fields: 'invoice,quantity,unit_price,expand.invoice.client,expand.invoice.status,expand.invoice.tax_percent'
				});

				// Group items by invoice to compute subtotals, then apply tax
				const invoiceData: Record<string, { client: string; status: string; taxPercent: number; subtotal: number }> = {};
				for (const item of items) {
					const inv = item.expand?.invoice;
					if (!inv) continue;
					if (!invoiceData[item.invoice]) {
						invoiceData[item.invoice] = {
							client: inv.client,
							status: inv.status,
							taxPercent: inv.tax_percent || 0,
							subtotal: 0
						};
					}
					invoiceData[item.invoice].subtotal += item.quantity * item.unit_price;
				}

				for (const inv of Object.values(invoiceData)) {
					const total = inv.subtotal * (1 + inv.taxPercent / 100);
					const ct = clientTotals[inv.client];
					if (!ct) continue;
					ct.invoiceCount++;
					ct.total += total;
					if (inv.status === 'paid') ct.paid += total;
					else if (inv.status === 'sent' || inv.status === 'overdue') ct.outstanding += total;
				}
			} catch {
				// totals unavailable — cards still render without them
			}
		}

		const settings = await getSmtpSettings(pb).catch(() => null);
		const defaultCurrency = settings?.default_currency || 'CAD';

		return {
			clients: result.items,
			page: result.page,
			totalPages: result.totalPages,
			totalItems: result.totalItems,
			showArchived,
			clientTotals,
			defaultCurrency
		};
	} catch {
		return { clients: [], page: 1, totalPages: 1, totalItems: 0, showArchived, clientTotals: {} as ClientTotals, defaultCurrency: 'CAD' };
	}
}

export const actions = {
	create: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const data = await request.formData();

		const name = data.get('name')?.toString().trim();
		const email = data.get('email')?.toString().trim() ?? '';
		const address = data.get('address')?.toString().trim() ?? '';
		const currency = data.get('currency')?.toString().trim() || 'USD';
		const harvest_id = data.get('harvest_id')?.toString().trim() ?? '';

		if (!name) return fail(400, { error: 'Name is required' });

		try {
			await pb.collection('clients').create({ name, email, address, currency, harvest_id, archived: false });
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Failed to create client';
			return fail(500, { error: msg });
		}

		return { success: true };
	},

	archive: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const data = await request.formData();
		const id = data.get('id')?.toString();
		if (!id) return fail(400, { error: 'Missing ID' });
		try {
			await pb.collection('clients').update(id, { archived: true });
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Failed to archive client';
			return fail(500, { error: msg });
		}
		return { success: true };
	},

	unarchive: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const data = await request.formData();
		const id = data.get('id')?.toString();
		if (!id) return fail(400, { error: 'Missing ID' });
		try {
			await pb.collection('clients').update(id, { archived: false });
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Failed to unarchive client';
			return fail(500, { error: msg });
		}
		return { success: true };
	},

	delete: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const data = await request.formData();
		const id = data.get('id')?.toString();
		if (!id) return fail(400, { error: 'Missing ID' });

		try {
			await pb.collection('clients').delete(id);
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Failed to delete client';
			return fail(500, { error: msg });
		}

		return { success: true };
	},

	bulkArchive: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const data = await request.formData();
		const bulkAll = data.get('bulkAll') === '1';
		let ids: string[];
		if (bulkAll) {
			try {
				const all = await pb.collection('clients').getFullList<{ id: string }>({ filter: 'archived = false || archived = null', fields: 'id' });
				ids = all.map((c) => c.id);
			} catch (e: unknown) {
				const msg = e instanceof Error ? e.message : 'Failed to fetch clients';
				return fail(500, { error: msg });
			}
		} else {
			ids = data.getAll('ids[]').map((v) => v.toString()).filter(Boolean);
		}
		if (!ids.length) return fail(400, { error: 'No clients selected' });
		try {
			await Promise.all(ids.map((id) => pb.collection('clients').update(id, { archived: true })));
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Failed to archive clients';
			return fail(500, { error: msg });
		}
		return { success: true };
	},

	bulkUnarchive: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const data = await request.formData();
		const bulkAll = data.get('bulkAll') === '1';
		let ids: string[];
		if (bulkAll) {
			try {
				const all = await pb.collection('clients').getFullList<{ id: string }>({ filter: 'archived = true', fields: 'id' });
				ids = all.map((c) => c.id);
			} catch (e: unknown) {
				const msg = e instanceof Error ? e.message : 'Failed to fetch clients';
				return fail(500, { error: msg });
			}
		} else {
			ids = data.getAll('ids[]').map((v) => v.toString()).filter(Boolean);
		}
		if (!ids.length) return fail(400, { error: 'No clients selected' });
		try {
			await Promise.all(ids.map((id) => pb.collection('clients').update(id, { archived: false })));
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Failed to restore clients';
			return fail(500, { error: msg });
		}
		return { success: true };
	}
};
