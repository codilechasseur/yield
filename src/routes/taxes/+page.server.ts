import { fail } from '@sveltejs/kit';
import type { Client, Expense, Invoice, InvoiceItem, TaxPayment } from '$lib/types.js';
import { getSmtpSettings } from '$lib/mail.server.js';
import { getPb } from '$lib/pb.server.js';
import { generateRecurringExpenses, todayIso } from '$lib/recurring.server.js';
import { buildTaxSummary, type InvoiceForTax } from '$lib/tax-summary.js';
import { isGstFrequency, isPeriodKey } from '$lib/gst-periods.js';
import { isProvince } from '$lib/income-tax.js';

export async function load({ url }) {
	const pb = await getPb();
	// Several queries on the same collection run in parallel — don't let the SDK cancel them as duplicates.
	pb.autoCancellation(false);
	const today = todayIso();

	const currentYear = new Date().getFullYear();
	const year = parseInt(url.searchParams.get('year') ?? String(currentYear), 10) || currentYear;
	const availableYears = Array.from({ length: 8 }, (_, i) => currentYear - i);

	const settings = await getSmtpSettings(pb).catch(() => null);
	const taxSettings = {
		province: settings?.tax_province ?? '',
		flatRate: settings?.income_tax_rate ?? 0,
		gstFrequency: settings?.gst_filing_frequency || 'annual',
		fxRates: settings?.fx_rates?.[String(year)] ?? {}
	};
	const base = {
		year,
		availableYears,
		today,
		taxSettings,
		defaultTaxPercent: settings?.default_tax_percent ?? 5,
		payments: [] as TaxPayment[]
	};

	try {
		await generateRecurringExpenses(pb, today).catch(() => null); // best effort — expenses page surfaces errors

		const range = { from: `${year}-01-01 00:00:00`, to: `${year}-12-31 23:59:59` };
		const [payments, items, expenses] = await Promise.all([
			pb.collection('tax_payments').getFullList<TaxPayment>({
				// Tagged for this year's periods, or untagged and paid this year
				filter: pb.filter(
					"(period = {:y} || period ~ {:yp}) || (period = '' && payment_date >= {:from} && payment_date <= {:to})",
					{ y: String(year), yp: `${year}-%`, ...range }
				),
				sort: '-payment_date'
			}),
			pb.collection('invoice_items').getFullList<InvoiceItem & { expand: { invoice: Invoice & { expand?: { client?: Client } } } }>({
				filter: pb.filter("invoice.status != 'draft' && invoice.issue_date >= {:from} && invoice.issue_date <= {:to}", range),
				expand: 'invoice,invoice.client'
			}),
			pb
				.collection('expenses')
				.getFullList<Expense>({
					filter: pb.filter('expense_date >= {:from} && expense_date <= {:to}', range),
					fields: 'amount,gst_paid,category,business_use_percent,expense_date'
				})
				.catch(() => [] as Expense[]) // collection may not exist before migrations run
		]);

		// Group items by invoice so per-invoice tax_percent applies once
		const invoices = new Map<string, InvoiceForTax>();
		for (const item of items) {
			const inv = item.expand?.invoice;
			if (!inv) continue;
			let row = invoices.get(inv.id);
			if (!row) {
				row = {
					issueDate: inv.issue_date,
					subtotal: 0,
					taxPercent: inv.tax_percent ?? 0,
					currency: inv.expand?.client?.currency || 'CAD'
				};
				invoices.set(inv.id, row);
			}
			row.subtotal += item.quantity * item.unit_price;
		}

		const summary = buildTaxSummary({
			year,
			today,
			invoices: [...invoices.values()],
			expenses,
			payments,
			province: taxSettings.province,
			flatRate: taxSettings.flatRate,
			gstFrequency: taxSettings.gstFrequency,
			fxRates: taxSettings.fxRates
		});

		return { ...base, payments, summary, loadError: null as string | null };
	} catch (e) {
		// Never render $0 liabilities as if they were real — surface the failure instead.
		return { ...base, summary: null, loadError: 'Could not load tax data: ' + (e as Error).message };
	}
}

/** Validates a payment form. Returns an error message or the record fields. */
function parsePayment(fd: FormData) {
	const type = fd.get('type')?.toString();
	const amount = parseFloat(fd.get('amount')?.toString() ?? '');
	const payment_date = fd.get('payment_date')?.toString() ?? '';
	const period = fd.get('period')?.toString().trim() ?? '';
	const notes = fd.get('notes')?.toString().trim() ?? '';

	if (type !== 'income_tax' && type !== 'gst') return 'Select a payment type.';
	if (!Number.isFinite(amount) || amount <= 0) return 'Enter a valid amount.';
	if (!/^\d{4}-\d{2}-\d{2}$/.test(payment_date)) return 'Select a payment date.';
	if (period && !isPeriodKey(period)) return 'Choose which period this payment is for.';
	if (type === 'income_tax' && period && !/^\d{4}$/.test(period)) return 'Income tax payments apply to a tax year.';

	return { type, amount: Math.round(amount * 100) / 100, payment_date, period, notes };
}

export const actions = {
	create: async ({ request }) => {
		const pb = await getPb();
		const fields = parsePayment(await request.formData());
		if (typeof fields === 'string') return fail(400, { createError: fields });

		try {
			await pb.collection('tax_payments').create(fields);
		} catch (e) {
			return fail(500, { createError: 'Failed to save: ' + (e as Error).message });
		}
		return { createSuccess: true };
	},

	update: async ({ request }) => {
		const pb = await getPb();
		const fd = await request.formData();
		const id = fd.get('id')?.toString();
		if (!id) return fail(400, { updateError: 'Missing ID.' });
		const fields = parsePayment(fd);
		if (typeof fields === 'string') return fail(400, { updateError: fields });

		try {
			await pb.collection('tax_payments').update(id, fields);
		} catch (e) {
			return fail(500, { updateError: 'Failed to save: ' + (e as Error).message });
		}
		return { updateSuccess: true };
	},

	delete: async ({ request }) => {
		const pb = await getPb();
		const fd = await request.formData();
		const id = fd.get('id')?.toString();

		if (!id) return fail(400, { deleteError: 'Missing ID.' });

		try {
			await pb.collection('tax_payments').delete(id);
		} catch (e) {
			return fail(500, { deleteError: 'Failed to delete: ' + (e as Error).message });
		}

		return { deleteSuccess: true };
	},

	saveSettings: async ({ request }) => {
		const pb = await getPb();
		const fd = await request.formData();
		const tax_province = fd.get('tax_province')?.toString() ?? '';
		const gst_filing_frequency = fd.get('gst_filing_frequency')?.toString() ?? 'annual';
		const rateRaw = fd.get('income_tax_rate')?.toString().trim() ?? '';
		const income_tax_rate = rateRaw === '' ? 0 : parseFloat(rateRaw);

		if (tax_province && !isProvince(tax_province)) return fail(400, { settingsError: 'Choose a province or territory.' });
		if (!isGstFrequency(gst_filing_frequency)) return fail(400, { settingsError: 'Choose how often you file GST/HST.' });
		if (!Number.isFinite(income_tax_rate) || income_tax_rate < 0 || income_tax_rate > 100) {
			return fail(400, { settingsError: 'The flat rate must be between 0 and 100%.' });
		}

		const data = { tax_province, gst_filing_frequency, income_tax_rate };
		try {
			const existing = await getSmtpSettings(pb);
			if (existing?.id) {
				await pb.collection('settings').update(existing.id, data);
			} else {
				await pb.collection('settings').create(data);
			}
		} catch (e) {
			return fail(500, { settingsError: 'Failed to save: ' + (e as Error).message });
		}
		return { settingsSuccess: true };
	},

	/** Saves the average exchange rate to CAD for one currency and year. Blank clears it. */
	saveFxRate: async ({ request }) => {
		const pb = await getPb();
		const fd = await request.formData();
		const year = fd.get('year')?.toString() ?? '';
		const currency = fd.get('currency')?.toString().toUpperCase() ?? '';
		const rateRaw = fd.get('rate')?.toString().trim() ?? '';
		const rate = rateRaw === '' ? null : parseFloat(rateRaw);

		if (!/^\d{4}$/.test(year)) return fail(400, { fxError: 'Missing year.' });
		if (!/^[A-Z]{3}$/.test(currency) || currency === 'CAD') return fail(400, { fxError: 'Invalid currency.' });
		if (rate !== null && (!Number.isFinite(rate) || rate <= 0 || rate > 10000)) {
			return fail(400, { fxError: 'Enter how many Canadian dollars one unit is worth, e.g. 1.37.' });
		}

		try {
			const existing = await getSmtpSettings(pb);
			const all = { ...(existing?.fx_rates ?? {}) };
			const forYear = { ...(all[year] ?? {}) };
			if (rate === null) delete forYear[currency];
			else forYear[currency] = rate;
			all[year] = forYear;

			if (existing?.id) {
				await pb.collection('settings').update(existing.id, { fx_rates: all });
			} else {
				await pb.collection('settings').create({ fx_rates: all });
			}
		} catch (e) {
			return fail(500, { fxError: 'Failed to save: ' + (e as Error).message });
		}
		return { fxSuccess: true };
	}
};
