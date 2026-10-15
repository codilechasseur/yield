import { describe, it, expect } from 'vitest';
import { buildTaxSummary, paymentAppliesToYear, type InvoiceForTax } from '../tax-summary.js';
import type { ExpenseCategory, TaxPaymentType } from '../types.js';

const inv = (issueDate: string, subtotal: number, taxPercent = 13, currency = 'CAD'): InvoiceForTax => ({
	issueDate,
	subtotal,
	taxPercent,
	currency
});
const exp = (expense_date: string, amount: number, gst_paid: number, category: ExpenseCategory = 'software', business_use_percent = 100) => ({
	expense_date,
	amount,
	gst_paid,
	category,
	business_use_percent
});
const pay = (type: TaxPaymentType, amount: number, payment_date: string, period = '') => ({ type, amount, payment_date, period });

const base = { year: 2026, today: '2026-10-15', invoices: [], expenses: [], payments: [] };

describe('paymentAppliesToYear', () => {
	it('uses the period when set, otherwise the payment date', () => {
		expect(paymentAppliesToYear({ period: '2025', payment_date: '2026-04-30' }, 2025)).toBe(true);
		expect(paymentAppliesToYear({ period: '2025', payment_date: '2026-04-30' }, 2026)).toBe(false);
		expect(paymentAppliesToYear({ period: '2026-Q3', payment_date: '2026-10-31' }, 2026)).toBe(true);
		expect(paymentAppliesToYear({ period: '', payment_date: '2026-04-30 00:00:00.000Z' }, 2026)).toBe(true);
	});
});

describe('buildTaxSummary', () => {
	it('returns an empty, unconfigured summary for no data', () => {
		const s = buildTaxSummary(base);
		expect(s.revenue).toBe(0);
		expect(s.netIncome).toBe(0);
		expect(s.incomeTax.method).toBe('none');
		expect(s.gst.frequency).toBe('annual');
		expect(s.gst.periods).toHaveLength(1);
		expect(s.gst.periods[0].status).toBe('open');
		expect(s.months).toEqual([]);
		expect(s.setAsideRate).toBe(0);
	});

	it('computes GST and income tax from CAD invoices and deductible expenses', () => {
		const s = buildTaxSummary({
			...base,
			invoices: [inv('2026-01-10', 10_000), inv('2026-02-10', 5_000, 5)],
			expenses: [exp('2026-01-20', 1_000, 130), exp('2026-02-05', 400, 52, 'meals')],
			flatRate: 20
		});
		expect(s.revenue).toBe(15_000);
		expect(s.gst.collected).toBe(1_550);
		expect(s.expenses.deductible).toBe(1_200);
		expect(s.gst.itc).toBe(156);
		expect(s.gst.net).toBe(1_394);
		expect(s.netIncome).toBe(13_800);
		expect(s.incomeTax.total).toBe(2_760);
		expect(s.incomeTaxBalance).toBe(2_760);
		expect(s.setAsideRate).toBeCloseTo(2_760 / 15_000);
	});

	it('leaves foreign revenue out until a rate is set, and never adds GST on it', () => {
		const invoices = [inv('2026-03-01', 1_000), inv('2026-03-15', 2_000, 0, 'USD')];
		const without = buildTaxSummary({ ...base, invoices });
		expect(without.revenue).toBe(1_000);
		expect(without.missingRates).toEqual(['USD']);
		expect(without.foreignRevenue).toEqual([{ currency: 'USD', amount: 2_000, rate: null, cad: null }]);

		const withRate = buildTaxSummary({ ...base, invoices, fxRates: { USD: 1.4 } });
		expect(withRate.revenue).toBe(3_800);
		expect(withRate.cadRevenue).toBe(1_000);
		expect(withRate.missingRates).toEqual([]);
		expect(withRate.foreignRevenue[0].cad).toBe(2_800);
		expect(withRate.gst.collected).toBe(130);
		expect(withRate.months[0]).toMatchObject({ month: 3, revenue: 3_800, gstCollected: 130 });
	});

	it('ignores zero or negative exchange rates', () => {
		const s = buildTaxSummary({ ...base, invoices: [inv('2026-03-15', 100, 0, 'EUR')], fxRates: { EUR: 0 } });
		expect(s.missingRates).toEqual(['EUR']);
		expect(s.revenue).toBe(0);
	});

	it('reports a GST refund as a negative net with no balance', () => {
		const s = buildTaxSummary({ ...base, invoices: [inv('2026-01-10', 100)], expenses: [exp('2026-01-11', 1_000, 130)] });
		expect(s.gst.net).toBe(-117);
		expect(s.gst.balance).toBe(0);
	});

	it('splits GST by quarter and works out each status', () => {
		const s = buildTaxSummary({
			...base,
			gstFrequency: 'quarterly',
			invoices: [inv('2026-02-01', 1_000), inv('2026-05-01', 1_000), inv('2026-08-01', 1_000), inv('2026-11-01', 1_000)],
			expenses: [exp('2026-02-15', 100, 13)],
			payments: [pay('gst', 117, '2026-04-20', '2026-Q1'), pay('gst', 50, '2026-07-20', '2026-Q2')]
		});
		const [q1, q2, q3, q4] = s.gst.periods;
		expect(q1).toMatchObject({ key: '2026-Q1', collected: 130, itc: 13, net: 117, paid: 117, balance: 0, status: 'paid' });
		expect(q2).toMatchObject({ net: 130, paid: 50, balance: 80, status: 'overdue' }); // due Jul 31
		expect(q3).toMatchObject({ net: 130, balance: 130, status: 'due' }); // due Oct 31, today Oct 15
		expect(q4.status).toBe('open');
		expect(s.gst.paid).toBe(167);
		expect(s.gst.unassignedPaid).toBe(0);
	});

	it('marks ended periods with more credits than tax collected as refunds, and never returns -0', () => {
		const s = buildTaxSummary({ ...base, gstFrequency: 'quarterly', expenses: [exp('2026-02-10', 125, 16.25)], flatRate: 20 });
		expect(s.gst.periods[0]).toMatchObject({ net: -16.25, balance: 0, status: 'refund' });
		expect(Object.is(s.months[0].estIncomeTax, -0)).toBe(false);
	});

	it('marks ended periods with nothing collected as nothing owed', () => {
		const s = buildTaxSummary({ ...base, gstFrequency: 'monthly' });
		expect(s.gst.periods[0].status).toBe('nothing_owed');
		expect(s.gst.periods[9].status).toBe('open');
	});

	it('counts untagged and mismatched GST payments toward the year but not a period', () => {
		const s = buildTaxSummary({
			...base,
			gstFrequency: 'quarterly',
			invoices: [inv('2026-02-01', 1_000)],
			payments: [pay('gst', 60, '2026-04-01'), pay('gst', 40, '2026-05-01', '2026-03'), pay('gst', 999, '2026-04-01', '2025-Q4')]
		});
		expect(s.gst.paid).toBe(100);
		expect(s.gst.unassignedPaid).toBe(100);
		expect(s.gst.periods[0].paid).toBe(0);
	});

	it('applies income tax payments for the year, including ones paid the next spring', () => {
		const s = buildTaxSummary({
			...base,
			year: 2025,
			today: '2026-10-15',
			invoices: [inv('2025-06-01', 10_000)],
			flatRate: 10,
			payments: [pay('income_tax', 400, '2026-04-30', '2025'), pay('income_tax', 300, '2025-09-15'), pay('income_tax', 5_000, '2026-03-15', '2026')]
		});
		expect(s.incomeTaxPaid).toBe(700);
		expect(s.incomeTaxBalance).toBe(300);
	});

	it('uses bracket estimates when a province is set', () => {
		const s = buildTaxSummary({ ...base, invoices: [inv('2026-01-10', 80_000)], province: 'ON' });
		expect(s.incomeTax.method).toBe('brackets');
		expect(s.incomeTax.total).toBe(22126.47);
	});

	it('spreads the income tax estimate over months by profit', () => {
		const s = buildTaxSummary({
			...base,
			invoices: [inv('2026-01-10', 6_000), inv('2026-03-10', 4_000)],
			expenses: [exp('2026-02-10', 1_000, 0)],
			flatRate: 30
		});
		expect(s.months.map((m) => [m.month, m.revenue, m.expenses, m.estIncomeTax])).toEqual([
			[1, 6_000, 0, 1_800],
			[2, 0, 1_000, -300],
			[3, 4_000, 0, 1_200]
		]);
		expect(s.months.reduce((t, m) => t + m.estIncomeTax, 0)).toBeCloseTo(s.incomeTax.total);
	});
});
