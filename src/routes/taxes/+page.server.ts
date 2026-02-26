import { fail } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import type { Invoice, InvoiceItem, TaxPayment } from '$lib/types.js';
import { getSmtpSettings } from '$lib/mail.server.js';

export async function load({ url }) {
	const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');

	const currentYear = new Date().getFullYear();
	const year = parseInt(url.searchParams.get('year') ?? String(currentYear), 10);

	const availableYears = Array.from({ length: 8 }, (_, i) => currentYear - i);

	const emptyTaxPosition = { gstLiability: 0, incomeTaxLiability: 0 };

	try {
		const settings = await getSmtpSettings(pb).catch(() => null);
		const incomeTaxRate = settings?.income_tax_rate ?? 0;

		const dateFilter = `invoice.issue_date >= "${year}-01-01 00:00:00" && invoice.issue_date <= "${year}-12-31 23:59:59"`;

		const [payments, accrualItems] = await Promise.all([
			pb.collection('tax_payments').getFullList<TaxPayment>({
				filter: `payment_date >= "${year}-01-01 00:00:00" && payment_date <= "${year}-12-31 23:59:59"`,
				sort: '-payment_date'
			}),
			pb
				.collection('invoice_items')
				.getFullList<InvoiceItem & { expand: { invoice: Invoice } }>({
					filter: `invoice.status != "draft" && ${dateFilter}`,
					expand: 'invoice',
					sort: 'invoice.issue_date'
				})
		]);

		function aggregateTax(
			itemList: (InvoiceItem & { expand: { invoice: Invoice } })[]
		): { gst: number; incomeTax: number } {
			const invMap = new Map<string, { invoice: Invoice; subtotal: number }>();
			for (const item of itemList) {
				const inv = item.expand?.invoice;
				if (!inv) continue;
				if (!invMap.has(inv.id)) invMap.set(inv.id, { invoice: inv, subtotal: 0 });
				invMap.get(inv.id)!.subtotal += item.quantity * item.unit_price;
			}
			let gst = 0, incomeTax = 0;
			for (const { invoice: inv, subtotal: sub } of invMap.values()) {
				gst += sub * ((inv.tax_percent ?? 0) / 100);
				incomeTax += sub * (incomeTaxRate / 100);
			}
			return { gst, incomeTax };
		}

		const accrualTax = aggregateTax(accrualItems);

		const taxPosition = {
			gstLiability: accrualTax.gst,
			incomeTaxLiability: accrualTax.incomeTax
		};

		return { payments, year, availableYears, incomeTaxRate, taxPosition };
	} catch {
		return { payments: [] as TaxPayment[], year, availableYears, incomeTaxRate: 0, taxPosition: emptyTaxPosition };
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
