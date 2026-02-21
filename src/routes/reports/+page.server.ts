import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import type { Invoice, InvoiceItem } from '$lib/types.js';
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

export interface ReportData {
	year: number;
	availableYears: number[];
	months: MonthSummary[];
	totals: {
		invoiceCount: number;
		subtotal: number;
		gstCollected: number;
		total: number;
		estimatedIncomeTax: number;
	};
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
	const year = parseInt(url.searchParams.get('year') ?? String(currentYear), 10);
	const basis = (url.searchParams.get('basis') ?? 'cash') as 'cash' | 'accrual';

	// Available years: current year back 7 years
	const availableYears = Array.from({ length: 8 }, (_, i) => currentYear - i);

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

		const dateFilter = `invoice.issue_date >= "${year}-01-01 00:00:00" && invoice.issue_date <= "${year}-12-31 23:59:59"`;

		// Fetch all items whose parent invoice matches our criteria, with the invoice expanded
		const items = await pb
			.collection('invoice_items')
			.getFullList<InvoiceItem & { expand: { invoice: Invoice } }>({
				filter: `${statusFilter} && ${dateFilter}`,
				expand: 'invoice',
				sort: 'invoice.issue_date'
			});

		// Group items by invoice, then by month
		// invoiceMap: invoiceId -> { invoice, items[] }
		const invoiceMap = new Map<string, { invoice: Invoice; items: InvoiceItem[] }>();
		for (const item of items) {
			const inv = item.expand?.invoice;
			if (!inv) continue;
			if (!invoiceMap.has(inv.id)) {
				invoiceMap.set(inv.id, { invoice: inv, items: [] });
			}
			invoiceMap.get(inv.id)!.items.push(item);
		}

		// Aggregate by month (1-indexed)
		const monthMap = new Map<number, MonthSummary>();

		for (const { invoice, items: invItems } of invoiceMap.values()) {
			const issueDate = new Date(invoice.issue_date);
			const month = issueDate.getMonth() + 1; // 1–12

			const subtotal = invItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);
			const gst = subtotal * ((invoice.tax_percent ?? 0) / 100);
			const total = subtotal + gst;

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
			ms.invoiceCount += 1;
			ms.subtotal += subtotal;
			ms.gstCollected += gst;
			ms.total += total;
			ms.estimatedIncomeTax += subtotal * (incomeTaxRate / 100);
		}

		// Fill in all 12 months (zero for months with no data)
		const months: MonthSummary[] = Array.from({ length: 12 }, (_, i) => {
			const m = i + 1;
			return monthMap.get(m) ?? {
				month: m,
				label: MONTH_NAMES[i],
				invoiceCount: 0,
				subtotal: 0,
				gstCollected: 0,
				total: 0,
				estimatedIncomeTax: 0
			};
		});

		const totals = months.reduce(
			(acc, m) => ({
				invoiceCount: acc.invoiceCount + m.invoiceCount,
				subtotal: acc.subtotal + m.subtotal,
				gstCollected: acc.gstCollected + m.gstCollected,
				total: acc.total + m.total,
				estimatedIncomeTax: acc.estimatedIncomeTax + m.estimatedIncomeTax
			}),
			{ invoiceCount: 0, subtotal: 0, gstCollected: 0, total: 0, estimatedIncomeTax: 0 }
		);

		return {
			year,
			availableYears,
			months,
			totals,
			basis,
			basisLabel: basis === 'cash' ? 'Cash (paid invoices)' : 'Accrual (all non-draft invoices)',
			incomeTaxRate
		} satisfies ReportData & { basis: string };
	} catch (e) {
		console.error('Reports load error:', e);
		return {
			year,
			availableYears,
			months: Array.from({ length: 12 }, (_, i) => ({
				month: i + 1,
				label: MONTH_NAMES[i],
				invoiceCount: 0,
				subtotal: 0,
				gstCollected: 0,
				total: 0,
				estimatedIncomeTax: 0
			})),
			totals: { invoiceCount: 0, subtotal: 0, gstCollected: 0, total: 0, estimatedIncomeTax: 0 },
			basis,
			basisLabel: basis === 'cash' ? 'Cash (paid invoices)' : 'Accrual (all non-draft invoices)',
			incomeTaxRate: 0
		};
	}
}
