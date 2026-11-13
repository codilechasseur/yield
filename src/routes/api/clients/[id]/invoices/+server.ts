import { json } from '@sveltejs/kit';
import type { Invoice, InvoiceItem } from '$lib/types.js';
import { RECENT_INVOICE_LIMIT, toRecentInvoice } from '$lib/recent-invoices.js';
import { getPb } from '$lib/pb.server.js';

/**
 * Returns the client's most recent invoices with their line items and totals.
 * Used by the new-invoice form to show what was billed last time.
 */
export async function GET({ params }) {
	const pb = await getPb();
	try {
		const result = await pb
			.collection('invoices')
			.getList<Invoice & { expand?: { invoice_items_via_invoice?: InvoiceItem[] } }>(1, RECENT_INVOICE_LIMIT, {
				filter: pb.filter('client = {:id}', { id: params.id }),
				sort: '-issue_date,-created',
				expand: 'invoice_items_via_invoice'
			});
		const invoices = result.items.map((inv) => toRecentInvoice(inv, inv.expand?.invoice_items_via_invoice ?? []));
		return json({ invoices });
	} catch {
		return json({ invoices: [] });
	}
}
