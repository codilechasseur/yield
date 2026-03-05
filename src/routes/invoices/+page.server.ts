import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import { calcSubtotal, calcTotal } from '$lib/pocketbase.js';
import type { Invoice, InvoiceItem, Client } from '$lib/types.js';

const PER_PAGE = 25;

type InvoiceExpand = { client?: Client; invoice_items_via_invoice?: InvoiceItem[] };

export async function load({ url }) {
	const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');

	const status = url.searchParams.get('status') || '';
	const clientId = url.searchParams.get('client') || '';
	const yearParam = parseInt(url.searchParams.get('year') || '0');
	const monthParam = parseInt(url.searchParams.get('month') || '0'); // 1–12
	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));

	const filters: string[] = [];
	if (status) filters.push(`status = "${status}"`);
	if (clientId) filters.push(`client = "${clientId}"`);
	if (yearParam) {
		const pad = (n: number) => String(n).padStart(2, '0');
		if (monthParam >= 1 && monthParam <= 12) {
			const start = `${yearParam}-${pad(monthParam)}-01 00:00:00`;
			const nextY = monthParam === 12 ? yearParam + 1 : yearParam;
			const nextM = monthParam === 12 ? 1 : monthParam + 1;
			filters.push(`issue_date >= "${start}" && issue_date < "${nextY}-${pad(nextM)}-01 00:00:00"`);
		} else {
			filters.push(`issue_date >= "${yearParam}-01-01 00:00:00" && issue_date < "${yearParam + 1}-01-01 00:00:00"`);
		}
	}
	const filter = filters.join(' && ');

	const [invoicesResult, clients, invoiceDates] = await Promise.all([
		pb
			.collection('invoices')
			.getList<Invoice & { expand: InvoiceExpand }>(page, PER_PAGE, {
				sort: '-issue_date',
				expand: 'client,invoice_items_via_invoice',
				filter,
				requestKey: 'invoices-list'
			})
			.catch(() => null),
		pb
			.collection('clients')
			.getFullList<Client>({ sort: 'name', requestKey: 'clients-list' })
			.catch(() => [] as Client[]),
		pb
			.collection('invoices')
			.getFullList<{ issue_date: string }>({ fields: 'issue_date', requestKey: 'invoices-dates' })
			.catch(() => [] as { issue_date: string }[])
	]);

	const currentYear = new Date().getFullYear();
	const yearSet = new Set<number>([currentYear]);
	for (const inv of invoiceDates) {
		if (inv.issue_date) yearSet.add(new Date(inv.issue_date).getFullYear());
	}
	const availableYears = Array.from(yearSet).sort((a, b) => b - a);

	const empty = {
		invoices: [] as (Invoice & { total: number })[],
		clients,
		availableYears,
		statusFilter: status,
		clientFilter: clientId,
		yearFilter: yearParam,
		monthFilter: monthParam,
		page: 1,
		totalPages: 1,
		totalItems: 0
	};

	if (!invoicesResult) return empty;

	const invoices = invoicesResult.items.map((inv) => {
		const items = inv.expand?.invoice_items_via_invoice ?? [];
		const subtotal = calcSubtotal(items);
		return { ...inv, total: calcTotal(subtotal, inv.tax_percent ?? 0) };
	});
	return {
		invoices,
		clients,
		availableYears,
		statusFilter: status,
		clientFilter: clientId,
		yearFilter: yearParam,
		monthFilter: monthParam,
		page: invoicesResult.page,
		totalPages: invoicesResult.totalPages,
		totalItems: invoicesResult.totalItems
	};
}
