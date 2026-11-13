import { calcSubtotal, calcTotal } from './pocketbase.js';
import { richTextToPlainText } from './rich-text.js';
import type { Invoice, InvoiceItem, RecentInvoice } from './types.js';

/** How many past invoices the new-invoice form shows for the selected client. */
export const RECENT_INVOICE_LIMIT = 3;

/** Shapes an invoice and its line items (in entry order) into a RecentInvoice. */
export function toRecentInvoice(invoice: Invoice, items: InvoiceItem[]): RecentInvoice {
	const ordered = [...items].sort((a, b) => (a.created ?? '').localeCompare(b.created ?? ''));
	return {
		id: invoice.id,
		number: invoice.number,
		subject: invoice.subject ?? '',
		issue_date: invoice.issue_date,
		status: invoice.status,
		total: calcTotal(calcSubtotal(ordered), invoice.tax_percent ?? 0),
		items: ordered.map(({ description, quantity, unit_price }) => ({ description, quantity, unit_price }))
	};
}

/**
 * True when no line item has a description yet, i.e. the form still holds only its
 * blank starting row(s). Items copied from a past invoice replace these rather than
 * being appended after them.
 */
export function hasOnlyBlankItems(items: { description: string }[]): boolean {
	return items.every((i) => richTextToPlainText(i.description).trim() === '');
}
