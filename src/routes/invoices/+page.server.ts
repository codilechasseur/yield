import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import { calcSubtotal, calcTotal } from '$lib/pocketbase.js';
import type { Invoice, InvoiceItem, Client } from '$lib/types.js';

const PER_PAGE = 25;

type InvoiceExpand = { client?: Client; invoice_items_via_invoice?: InvoiceItem[] };

export async function load({ url }) {
	const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');

	const status = url.searchParams.get('status') || '';
	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
	const filter = status ? `status = "${status}"` : '';

	try {
		const result = await pb
			.collection('invoices')
			.getList<Invoice & { expand: InvoiceExpand }>(page, PER_PAGE, {
				sort: '-issue_date',
				expand: 'client,invoice_items_via_invoice',
				filter
			});
		const invoices = result.items.map((inv) => {
			const items = inv.expand?.invoice_items_via_invoice ?? [];
			const subtotal = calcSubtotal(items);
			return { ...inv, total: calcTotal(subtotal, inv.tax_percent ?? 0) };
		});
		return {
			invoices,
			statusFilter: status,
			page: result.page,
			totalPages: result.totalPages,
			totalItems: result.totalItems
		};
	} catch {
		return { invoices: [], statusFilter: status, page: 1, totalPages: 1, totalItems: 0 };
	}
}
