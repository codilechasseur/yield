import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import type { Client, Invoice, InvoiceItem } from '$lib/types.js';
import { getSmtpSettings } from '$lib/mail.server.js';

export interface MonthSummary {
	month: number; // 1–12
	label: string; // "January", etc.
	invoiceCount: number;
	subtotal: number; // pre-tax revenue (income tax base)
	gstCollected: number; // tax collected (GST/HST remittance)
	total: number; // invoiced total
	estimatedIncomeTax: number; // estimated income tax (subtotal × income_tax_rate)
}

export interface ClientSummary {
	clientId: string;
	clientName: string;
	invoiceCount: number;
	subtotal: number;
	total: number;
}

export interface YearSummary {
	year: number;
	invoiceCount: number;
	subtotal: number;
	gstCollected: number;
	total: number;
	estimatedIncomeTax: number;
}

export interface ReportData {
	year: number;
	allTime: boolean;
	availableYears: number[];
	months: MonthSummary[];
	years: YearSummary[];
	totals: {
		invoiceCount: number;
		subtotal: number;
		gstCollected: number;
		total: number;
		estimatedIncomeTax: number;
	};
	clientSummaries: ClientSummary[];
	basisLabel: string; // "Cash" or "Accrual"
	incomeTaxRate: number; // the configured rate, e.g. 30
}

const MONTH_NAMES = [
	'January', 'February', 'March', 'April', 'May', 'June',
	'July', 'August', 'September', 'October', 'November', 'December'
];

export async function load({ url }) {
	const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');

	const currentYear = new Date().getFullYear();
	const yearParam = url.searchParams.get('year');
	const allTime = yearParam === 'all';
	const year = allTime ? 0 : parseInt(yearParam ?? String(currentYear), 10);
	const basis = (url.searchParams.get('basis') ?? 'cash') as 'cash' | 'accrual';

	// Available years: derived from actual invoice issue_dates, always including current year
	const invoiceDates = await pb
		.collection('invoices')
		.getFullList<{ issue_date: string }>({ fields: 'issue_date' })
		.catch(() => [] as { issue_date: string }[]);
	const yearSet = new Set<number>([currentYear]);
	for (const inv of invoiceDates) {
		if (inv.issue_date) yearSet.add(new Date(inv.issue_date).getFullYear());
	}
	const availableYears = Array.from(yearSet).sort((a, b) => b - a);

	try {
		// Load income tax rate from settings
		const settings = await getSmtpSettings(pb).catch(() => null);
		const incomeTaxRate = settings?.income_tax_rate ?? 0;

		// For cash basis: use paid invoices by issue_date
		// For accrual basis: use all non-draft invoices by issue_date
		const statusFilter =
			basis === 'cash'
				? `invoice.status = "paid"`
				: `invoice.status != "draft"`;

		const dateFilter = allTime
			? null
			: `invoice.issue_date >= "${year}-01-01 00:00:00" && invoice.issue_date <= "${year}-12-31 23:59:59"`;

		// Fetch all items whose parent invoice matches our criteria, with the invoice and client expanded
		const items = await pb
			.collection('invoice_items')
			.getFullList<InvoiceItem & { expand: { invoice: Invoice & { expand?: { client?: Client } } } }>({
				filter: dateFilter ? `${statusFilter} && ${dateFilter}` : statusFilter,
				expand: 'invoice,invoice.client',
				sort: 'invoice.issue_date'
			});

		// Group items by invoice, then by month
		// invoiceMap: invoiceId -> { invoice, items[] }
		const invoiceMap = new Map<string, { invoice: Invoice & { expand?: { client?: Client } }; items: InvoiceItem[] }>();
		for (const item of items) {
			const inv = item.expand?.invoice;
			if (!inv) continue;
			if (!invoiceMap.has(inv.id)) {
				invoiceMap.set(inv.id, { invoice: inv, items: [] });
			}
			invoiceMap.get(inv.id)!.items.push(item);
		}

		// Count all non-draft invoices per month or year (independent of cash/accrual basis)
		// so the "# Invoices" column reflects all issued invoices, not just paid ones.
		const allIssuedInvoices = await pb
			.collection('invoices')
			.getFullList<Pick<Invoice, 'id' | 'issue_date'>>({
				filter: dateFilter ? `status != "draft" && ${dateFilter.replace(/invoice\./g, '')}` : `status != "draft"`,
				fields: 'id,issue_date'
			})
			.catch(() => [] as Pick<Invoice, 'id' | 'issue_date'>[]);
		const monthCountMap = new Map<number, number>();
		const yearCountMap = new Map<number, number>();
		for (const inv of allIssuedInvoices) {
			if (!inv.issue_date) continue;
			const d = new Date(inv.issue_date);
			if (allTime) {
				const y = d.getFullYear();
				yearCountMap.set(y, (yearCountMap.get(y) ?? 0) + 1);
			} else {
				const m = d.getMonth() + 1;
				monthCountMap.set(m, (monthCountMap.get(m) ?? 0) + 1);
			}
		}

		// Aggregate by month (1-indexed) or by year (for all-time view)
		const monthMap = new Map<number, MonthSummary>();
		const yearMap = new Map<number, YearSummary>();
		// Aggregate by client
		const clientMap = new Map<string, ClientSummary>();

		for (const { invoice, items: invItems } of invoiceMap.values()) {
			const issueDate = new Date(invoice.issue_date);
			const month = issueDate.getMonth() + 1; // 1–12
			const invYear = issueDate.getFullYear();

			const subtotal = invItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);
			const gst = subtotal * ((invoice.tax_percent ?? 0) / 100);
			const total = subtotal + gst;
			const estTax = subtotal * (incomeTaxRate / 100);

			if (allTime) {
				// Yearly aggregation
				if (!yearMap.has(invYear)) {
					yearMap.set(invYear, { year: invYear, invoiceCount: 0, subtotal: 0, gstCollected: 0, total: 0, estimatedIncomeTax: 0 });
				}
				const ys = yearMap.get(invYear)!;
				ys.subtotal += subtotal;
				ys.gstCollected += gst;
				ys.total += total;
				ys.estimatedIncomeTax += estTax;
			} else {
				// Monthly aggregation
				if (!monthMap.has(month)) {
					monthMap.set(month, {
						month,
						label: MONTH_NAMES[month - 1],
						invoiceCount: 0,
						subtotal: 0,
						gstCollected: 0,
						total: 0,
						estimatedIncomeTax: 0
					});
				}
				const ms = monthMap.get(month)!;
				ms.subtotal += subtotal;
				ms.gstCollected += gst;
				ms.total += total;
				ms.estimatedIncomeTax += estTax;
			}

			// Client aggregation
			const clientId = invoice.client ?? 'unknown';
			const clientName = invoice.expand?.client?.name ?? 'Unknown Client';
			if (!clientMap.has(clientId)) {
				clientMap.set(clientId, { clientId, clientName, invoiceCount: 0, subtotal: 0, total: 0 });
			}
			const cs = clientMap.get(clientId)!;
			cs.invoiceCount += 1;
			cs.subtotal += subtotal;
			cs.total += total;
		}

		// Fill in all 12 months (zero for months with no data); empty when all-time
		const months: MonthSummary[] = allTime ? [] : Array.from({ length: 12 }, (_, i) => {
			const m = i + 1;
			const invoiceCount = monthCountMap.get(m) ?? 0;
			const existing = monthMap.get(m);
			if (existing) {
				return { ...existing, invoiceCount };
			}
			return {
				month: m,
				label: MONTH_NAMES[i],
				invoiceCount,
				subtotal: 0,
				gstCollected: 0,
				total: 0,
				estimatedIncomeTax: 0
			};
		});

		// Build yearly summaries for all-time view
		const allTimeYearKeys = new Set([...yearMap.keys(), ...yearCountMap.keys()]);
		const years: YearSummary[] = allTime
			? Array.from(allTimeYearKeys)
				.sort((a, b) => a - b)
				.map((y) => {
					const ys = yearMap.get(y);
					const invoiceCount = yearCountMap.get(y) ?? 0;
					if (ys) return { ...ys, invoiceCount };
					return { year: y, invoiceCount, subtotal: 0, gstCollected: 0, total: 0, estimatedIncomeTax: 0 };
				})
			: [];

		const source = allTime ? years : months;
		const totals = source.reduce(
			(acc, row) => ({
				invoiceCount: acc.invoiceCount + row.invoiceCount,
				subtotal: acc.subtotal + row.subtotal,
				gstCollected: acc.gstCollected + row.gstCollected,
				total: acc.total + row.total,
				estimatedIncomeTax: acc.estimatedIncomeTax + row.estimatedIncomeTax
			}),
			{ invoiceCount: 0, subtotal: 0, gstCollected: 0, total: 0, estimatedIncomeTax: 0 }
		);

		// Sort clients by total revenue descending
		const clientSummaries: ClientSummary[] = Array.from(clientMap.values()).sort(
			(a, b) => b.subtotal - a.subtotal
		);

		return {
			year,
			allTime,
			availableYears,
			months,
			years,
			totals,
			clientSummaries,
			basis,
			basisLabel: basis === 'cash' ? 'Cash (paid invoices)' : 'Accrual (all non-draft invoices)',
			incomeTaxRate
		} satisfies ReportData & { basis: string };
	} catch (e) {
		console.error('Reports load error:', e);
		return {
			year,
			allTime,
			availableYears,
			months: allTime ? [] : Array.from({ length: 12 }, (_, i) => ({
				month: i + 1,
				label: MONTH_NAMES[i],
				invoiceCount: 0,
				subtotal: 0,
				gstCollected: 0,
				total: 0,
				estimatedIncomeTax: 0
			})),
			years: [],
			totals: { invoiceCount: 0, subtotal: 0, gstCollected: 0, total: 0, estimatedIncomeTax: 0 },
			clientSummaries: [],
			basis,
			basisLabel: basis === 'cash' ? 'Cash (paid invoices)' : 'Accrual (all non-draft invoices)',
			incomeTaxRate: 0
		};
	}
}
