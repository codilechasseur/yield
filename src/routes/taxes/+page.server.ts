import { fail } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import type { Client, Expense, Invoice, InvoiceItem, TaxPayment } from '$lib/types.js';
import { getSmtpSettings } from '$lib/mail.server.js';

export interface TaxMonthRow {
	month: number; // 1–12
	label: string;
	revenue: number;
	expenses: number;
	gstCollected: number;
	gstItc: number;
	netGst: number;
	estIncomeTax: number; // (revenue − expenses) × rate; can be negative in expense-heavy months
}

export interface TaxPosition {
	revenue: number;
	expenses: number;
	incomeTaxBase: number;
	incomeTaxLiability: number;
	gstCollected: number;
	gstItc: number;
	gstLiability: number;
}

const MONTH_NAMES = [
	'January', 'February', 'March', 'April', 'May', 'June',
	'July', 'August', 'September', 'October', 'November', 'December'
];

export async function load({ url }) {
	const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');

	const currentYear = new Date().getFullYear();
	const year = parseInt(url.searchParams.get('year') ?? String(currentYear), 10);

	const availableYears = Array.from({ length: 8 }, (_, i) => currentYear - i);

	const empty = {
		payments: [] as TaxPayment[],
		year,
		availableYears,
		incomeTaxRate: 0,
		taxPosition: {
			revenue: 0, expenses: 0, incomeTaxBase: 0, incomeTaxLiability: 0,
			gstCollected: 0, gstItc: 0, gstLiability: 0
		} satisfies TaxPosition,
		months: [] as TaxMonthRow[],
		foreignRevenue: [] as { currency: string; amount: number }[]
	};

	try {
		const settings = await getSmtpSettings(pb).catch(() => null);
		const incomeTaxRate = settings?.income_tax_rate ?? 0;

		const dateFilter = `invoice.issue_date >= "${year}-01-01 00:00:00" && invoice.issue_date <= "${year}-12-31 23:59:59"`;

		const [payments, accrualItems, expenses] = await Promise.all([
			pb.collection('tax_payments').getFullList<TaxPayment>({
				filter: `payment_date >= "${year}-01-01 00:00:00" && payment_date <= "${year}-12-31 23:59:59"`,
				sort: '-payment_date'
			}),
			pb
				.collection('invoice_items')
				.getFullList<InvoiceItem & { expand: { invoice: Invoice & { expand?: { client?: Client } } } }>({
					filter: `invoice.status != "draft" && ${dateFilter}`,
					expand: 'invoice,invoice.client',
					sort: 'invoice.issue_date'
				}),
			pb
				.collection('expenses')
				.getFullList<Expense>({
					filter: `expense_date >= "${year}-01-01 00:00:00" && expense_date <= "${year}-12-31 23:59:59"`
				})
				.catch(() => [] as Expense[]) // collection may not exist before migrations run
		]);

		// Group items by invoice so per-invoice tax_percent applies once
		const invMap = new Map<string, { invoice: Invoice & { expand?: { client?: Client } }; subtotal: number }>();
		for (const item of accrualItems) {
			const inv = item.expand?.invoice;
			if (!inv) continue;
			if (!invMap.has(inv.id)) invMap.set(inv.id, { invoice: inv, subtotal: 0 });
			invMap.get(inv.id)!.subtotal += item.quantity * item.unit_price;
		}

		// CAD invoices (or ones with no currency set) drive the tax numbers.
		// Foreign-currency invoices are excluded — GST doesn't apply to zero-rated
		// exports, and summing mixed currencies would produce meaningless totals —
		// but they're surfaced so nothing disappears silently.
		const monthRevenue = new Map<number, number>();
		const monthGst = new Map<number, number>();
		const foreign = new Map<string, number>();
		let revenue = 0, gstCollected = 0;

		for (const { invoice: inv, subtotal: sub } of invMap.values()) {
			const currency = inv.expand?.client?.currency || 'CAD';
			if (currency !== 'CAD') {
				foreign.set(currency, (foreign.get(currency) ?? 0) + sub);
				continue;
			}
			const month = new Date(inv.issue_date).getMonth() + 1;
			const gst = sub * ((inv.tax_percent ?? 0) / 100);
			revenue += sub;
			gstCollected += gst;
			monthRevenue.set(month, (monthRevenue.get(month) ?? 0) + sub);
			monthGst.set(month, (monthGst.get(month) ?? 0) + gst);
		}

		const monthExpenses = new Map<number, number>();
		const monthItc = new Map<number, number>();
		let totalExpenses = 0, gstItc = 0;
		for (const exp of expenses) {
			const month = new Date(exp.expense_date).getMonth() + 1;
			totalExpenses += exp.amount;
			gstItc += exp.gst_paid ?? 0;
			monthExpenses.set(month, (monthExpenses.get(month) ?? 0) + exp.amount);
			monthItc.set(month, (monthItc.get(month) ?? 0) + (exp.gst_paid ?? 0));
		}

		const months: TaxMonthRow[] = Array.from({ length: 12 }, (_, i) => {
			const m = i + 1;
			const rev = monthRevenue.get(m) ?? 0;
			const exp = monthExpenses.get(m) ?? 0;
			const gst = monthGst.get(m) ?? 0;
			const itc = monthItc.get(m) ?? 0;
			return {
				month: m,
				label: MONTH_NAMES[i],
				revenue: rev,
				expenses: exp,
				gstCollected: gst,
				gstItc: itc,
				netGst: gst - itc,
				estIncomeTax: (rev - exp) * (incomeTaxRate / 100)
			};
		}).filter((r) => r.revenue !== 0 || r.expenses !== 0);

		const incomeTaxBase = Math.max(0, revenue - totalExpenses);
		const taxPosition: TaxPosition = {
			revenue,
			expenses: totalExpenses,
			incomeTaxBase,
			incomeTaxLiability: incomeTaxBase * (incomeTaxRate / 100),
			gstCollected,
			gstItc,
			gstLiability: Math.max(0, gstCollected - gstItc)
		};

		const foreignRevenue = Array.from(foreign.entries()).map(([currency, amount]) => ({ currency, amount }));

		return { ...empty, payments, incomeTaxRate, taxPosition, months, foreignRevenue, loadError: null as string | null };
	} catch (e) {
		// Never render $0 liabilities as if they were real — surface the failure instead.
		return { ...empty, loadError: 'Could not load tax data: ' + (e as Error).message };
	}
}

export const actions = {
	create: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const fd = await request.formData();

		const type = fd.get('type')?.toString();
		const amount = parseFloat(fd.get('amount')?.toString() ?? '');
		const payment_date = fd.get('payment_date')?.toString();
		const notes = fd.get('notes')?.toString() ?? '';

		if (!type || !['income_tax', 'gst'].includes(type)) {
			return fail(400, { createError: 'Select a payment type.' });
		}
		if (!amount || isNaN(amount) || amount <= 0) {
			return fail(400, { createError: 'Enter a valid amount.' });
		}
		if (!payment_date) {
			return fail(400, { createError: 'Select a payment date.' });
		}

		try {
			await pb.collection('tax_payments').create({ type, amount, payment_date, notes });
		} catch (e) {
			return fail(500, { createError: 'Failed to save: ' + (e as Error).message });
		}

		return { createSuccess: true };
	},

	delete: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const fd = await request.formData();
		const id = fd.get('id')?.toString();

		if (!id) return fail(400, { deleteError: 'Missing ID.' });

		try {
			await pb.collection('tax_payments').delete(id);
		} catch (e) {
			return fail(500, { deleteError: 'Failed to delete: ' + (e as Error).message });
		}

		return { deleteSuccess: true };
	}
};
