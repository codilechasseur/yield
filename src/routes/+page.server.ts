import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import { calcSubtotal, calcTotal } from '$lib/pocketbase.js';
import type { Client, Invoice, InvoiceItem, ChartPeriod } from '$lib/types.js';

interface ItemWithInvoice extends InvoiceItem {
	expand?: { invoice?: Invoice };
}

/** Sum invoice items (one per invoice), applying per-invoice tax. */
function sumWithTax(items: ItemWithInvoice[]): number {
	// Items already include expand.invoice so we can read tax_percent directly.
	// One item per invoice in this dataset, but group defensively.
	const byInvoice = new Map<string, { subtotal: number; tax: number }>();
	for (const item of items) {
		const id = item.invoice as string;
		const tax = item.expand?.invoice?.tax_percent ?? 0;
		const e = byInvoice.get(id) ?? { subtotal: 0, tax };
		e.subtotal += item.quantity * item.unit_price;
		byInvoice.set(id, e);
	}
	let total = 0;
	for (const { subtotal, tax } of byInvoice.values()) total += subtotal * (1 + tax / 100);
	return total;
}

export async function load() {
	const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
	// Prevent the SDK from auto-cancelling concurrent requests to the same collection.
	pb.autoCancellation(false);

	try {
		const now = new Date();
		const thisYear = now.getFullYear();
		const monthStart = `${thisYear}-${String(now.getMonth() + 1).padStart(2, '0')}-01 00:00:00`;
		const yearStart = `${thisYear}-01-01 00:00:00`;

		// Single fetch for ALL invoice_items + their invoices — used for charts + financial stats.
		// Separate lightweight fetches for the list widgets.
		type InvoiceWithItems = Invoice & { expand: { client: Client; invoice_items_via_invoice?: InvoiceItem[] } };
		const [allItems, recentRes, overdueRes] = await Promise.all([
			pb.collection('invoice_items').getFullList<ItemWithInvoice>({ expand: 'invoice' }),
			pb.collection('invoices').getList<InvoiceWithItems>(1, 5, {
				sort: '-issue_date',
				expand: 'client,invoice_items_via_invoice'
			}),
			pb.collection('invoices').getList<InvoiceWithItems>(1, 5, {
				filter: 'status = "overdue"',
				sort: 'due_date',
				expand: 'client,invoice_items_via_invoice'
			})
		]);
		const addTotal = (inv: InvoiceWithItems) => {
			const items = inv.expand?.invoice_items_via_invoice ?? [];
			return { ...inv, total: calcTotal(calcSubtotal(items), inv.tax_percent ?? 0) };
		};

		// Partition items for financial stat cards
		const outstandingItems = allItems.filter(
			(i) => i.expand?.invoice?.status === 'sent' || i.expand?.invoice?.status === 'overdue'
		);
		const overdueItems = allItems.filter((i) => i.expand?.invoice?.status === 'overdue');
		const paidMonthItems = allItems.filter(
			(i) =>
				i.expand?.invoice?.status === 'paid' &&
				(i.expand?.invoice?.issue_date ?? '') >= monthStart
		);
		const paidYTDItems = allItems.filter(
			(i) =>
				i.expand?.invoice?.status === 'paid' &&
				(i.expand?.invoice?.issue_date ?? '') >= yearStart
		);

		// Build yearly chart data
		const yearMap = new Map<string, { invoiced: number; paid: number }>();
		const monthMap = new Map<string, { invoiced: number; paid: number }>();
		for (const item of allItems) {
			const inv = item.expand?.invoice;
			if (!inv?.issue_date) continue;
			const year = inv.issue_date.slice(0, 4);
			const month = inv.issue_date.slice(0, 7); // "YYYY-MM"
			const amount = item.quantity * item.unit_price * (1 + (inv.tax_percent ?? 0) / 100);
			const isPaid = inv.status === 'paid';

			const ye = yearMap.get(year) ?? { invoiced: 0, paid: 0 };
			ye.invoiced += amount;
			if (isPaid) ye.paid += amount;
			yearMap.set(year, ye);

			const me = monthMap.get(month) ?? { invoiced: 0, paid: 0 };
			me.invoiced += amount;
			if (isPaid) me.paid += amount;
			monthMap.set(month, me);
		}
		const chartData: ChartPeriod[] = Array.from(yearMap.entries())
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([period, { invoiced, paid }]) => ({ period, invoiced, paid }));
		const chartDataByMonth: ChartPeriod[] = Array.from(monthMap.entries())
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([period, { invoiced, paid }]) => ({ period, invoiced, paid }));

		return {
			hasData: allItems.length > 0,
			stats: {
				outstanding: sumWithTax(outstandingItems),
				overdueTotal: sumWithTax(overdueItems),
				paidThisMonth: sumWithTax(paidMonthItems),
				paidYTD: sumWithTax(paidYTDItems),
				recentInvoices: recentRes.items.map(addTotal),
				overdueInvoices: overdueRes.items.map(addTotal),
				chartData,
				chartDataByMonth
			}
		};
	} catch (e) {
		console.error('Dashboard load error:', e);
		return {
			hasData: false,
			stats: {
				outstanding: 0,
				overdueTotal: 0,
				paidThisMonth: 0,
				paidYTD: 0,
				recentInvoices: [],
				overdueInvoices: [],
				chartData: [],
				chartDataByMonth: []
			}
		};
	}
}
