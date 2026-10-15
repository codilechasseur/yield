import type { Expense, GstFilingFrequency, HomeOfficeConfig, TaxPayment } from './types.js';
import { claimableItc, deductibleAmount, summarizeExpenses, type ExpenseTotals } from './expenses.js';
import { homeOfficeShare, summarizeHomeOffice, type HomeOfficeSummary } from './home-office.js';
import { estimateIncomeTax, type IncomeTaxEstimate } from './income-tax.js';
import { gstPeriods, periodYear, type GstPeriod } from './gst-periods.js';

/**
 * Builds everything the Taxes page shows for one calendar year from raw
 * records. Pure, so the arithmetic is unit-tested without PocketBase.
 *
 * Revenue is recognised on the invoice issue date (accrual), matching how
 * GST/HST is reported. Foreign-currency invoices count toward income tax once
 * converted at the year's exchange rate, but never toward GST/HST collected —
 * exports to non-residents are zero-rated.
 *
 * Business-use-of-home costs are deducted last and capped at the income left
 * after every other expense (they can't create a loss); the excess carries
 * forward to next year.
 */

export interface InvoiceForTax {
	issueDate: string;
	/** Pre-tax subtotal in the invoice's currency. */
	subtotal: number;
	taxPercent: number;
	/** ISO currency code; empty means CAD. */
	currency: string;
}

export interface ForeignRevenue {
	currency: string;
	amount: number;
	/** CAD per unit for the year; null when not set yet. */
	rate: number | null;
	/** Converted amount, null when there's no rate. */
	cad: number | null;
}

export type GstPeriodStatus = 'open' | 'nothing_owed' | 'refund' | 'paid' | 'due' | 'overdue';

export interface GstPeriodRow extends GstPeriod {
	collected: number;
	itc: number;
	/** collected − itc; negative means a refund is owed to you. */
	net: number;
	paid: number;
	balance: number;
	status: GstPeriodStatus;
}

export interface TaxMonthRow {
	month: number; // 1–12
	label: string;
	/** Revenue in CAD, including converted foreign revenue. */
	revenue: number;
	/** Deductible expenses. */
	expenses: number;
	gstCollected: number;
	gstItc: number;
	netGst: number;
	/** This month's share of the year's income tax + CPP estimate; negative in loss months. */
	estIncomeTax: number;
}

export interface TaxSummary {
	year: number;
	revenue: number;
	cadRevenue: number;
	foreignRevenue: ForeignRevenue[];
	/** Foreign currencies with revenue but no exchange rate — left out of the income figures. */
	missingRates: string[];
	/** All expenses. For home costs, `deductible` is the business part before the loss limit. */
	expenses: ExpenseTotals;
	/** Deductible expenses other than business use of home. */
	otherDeductible: number;
	/** T2125 Part 7, including the loss limit and carryforward. */
	homeOffice: HomeOfficeSummary;
	/** otherDeductible + homeOffice.deductible. */
	totalDeductible: number;
	/** Phone/internet appears both as a home cost and as a "Phone & internet" expense. */
	phoneDoubleCountRisk: boolean;
	/** revenue − total deductible expenses (can be negative). */
	netIncome: number;
	incomeTax: IncomeTaxEstimate;
	incomeTaxPaid: number;
	incomeTaxBalance: number;
	gst: {
		collected: number;
		itc: number;
		net: number;
		paid: number;
		balance: number;
		frequency: GstFilingFrequency;
		periods: GstPeriodRow[];
		/** GST payments counted for the year that don't match a current period (older or untagged records). */
		unassignedPaid: number;
	};
	/** Share of every pre-tax dollar invoiced to set aside for income tax + CPP (on top of all GST/HST collected). */
	setAsideRate: number;
	months: TaxMonthRow[];
}

const MONTH_NAMES = [
	'January', 'February', 'March', 'April', 'May', 'June',
	'July', 'August', 'September', 'October', 'November', 'December'
];

// `|| 0` turns -0 into 0 so it never renders as "-$0.00"
const round2 = (n: number) => Math.round(n * 100) / 100 || 0;

/** Whether a payment counts toward `year`: tagged for that year, or untagged and paid that year. */
export function paymentAppliesToYear(p: Pick<TaxPayment, 'period' | 'payment_date'>, year: number): boolean {
	if (p.period) return periodYear(p.period) === year;
	return Number(p.payment_date.slice(0, 4)) === year;
}

function monthOf(date: string): number {
	return Number(date.slice(5, 7));
}

export function buildTaxSummary(input: {
	year: number;
	today: string;
	invoices: readonly InvoiceForTax[];
	expenses: readonly (Pick<Expense, 'amount' | 'gst_paid' | 'category' | 'business_use_percent' | 'expense_date'> &
		Partial<Pick<Expense, 'home_cost_type' | 'description'>>)[];
	payments: readonly Pick<TaxPayment, 'type' | 'amount' | 'payment_date' | 'period'>[];
	province?: string | null;
	flatRate?: number | null;
	gstFrequency?: GstFilingFrequency | '' | null;
	/** CAD per unit of each foreign currency for this year. */
	fxRates?: Record<string, number> | null;
	/** This year's business-use-of-home setup. */
	homeOffice?: HomeOfficeConfig | null;
}): TaxSummary {
	const { year, today } = input;
	const frequency: GstFilingFrequency = input.gstFrequency || 'annual';

	const monthRevenue = new Array<number>(13).fill(0);
	const monthGst = new Array<number>(13).fill(0);
	const monthExpenses = new Array<number>(13).fill(0);
	const monthItc = new Array<number>(13).fill(0);
	const foreign = new Map<string, number>();
	let cadRevenue = 0;
	let gstCollected = 0;

	// Pass 1: CAD invoices drive GST; foreign totals collected for conversion.
	for (const inv of input.invoices) {
		const currency = (inv.currency || 'CAD').toUpperCase();
		const m = monthOf(inv.issueDate);
		if (currency !== 'CAD') {
			foreign.set(currency, (foreign.get(currency) ?? 0) + inv.subtotal);
			continue;
		}
		const gst = inv.subtotal * ((inv.taxPercent ?? 0) / 100);
		cadRevenue += inv.subtotal;
		gstCollected += gst;
		monthRevenue[m] += inv.subtotal;
		monthGst[m] += gst;
	}

	// Pass 2: convert foreign revenue where a rate is known.
	const foreignRevenue: ForeignRevenue[] = [];
	const missingRates: string[] = [];
	for (const [currency, amount] of [...foreign.entries()].sort(([a], [b]) => a.localeCompare(b))) {
		const rate = input.fxRates?.[currency];
		const valid = typeof rate === 'number' && rate > 0;
		foreignRevenue.push({ currency, amount: round2(amount), rate: valid ? rate : null, cad: valid ? round2(amount * rate) : null });
		if (!valid) missingRates.push(currency);
	}
	for (const inv of input.invoices) {
		const currency = (inv.currency || 'CAD').toUpperCase();
		const rate = input.fxRates?.[currency];
		if (currency === 'CAD' || !(typeof rate === 'number' && rate > 0)) continue;
		monthRevenue[monthOf(inv.issueDate)] += inv.subtotal * rate;
	}
	const revenue = monthRevenue.reduce((s, v) => s + v, 0);

	const ctx = { homeShare: homeOfficeShare(input.homeOffice) };
	const monthHome = new Array<number>(13).fill(0);
	let otherDeductible = 0;
	for (const e of input.expenses) {
		const m = monthOf(e.expense_date);
		const deductible = deductibleAmount(e, ctx);
		if (e.category === 'home_office') {
			monthHome[m] += deductible;
		} else {
			monthExpenses[m] += deductible;
			otherDeductible += deductible;
		}
		monthItc[m] += claimableItc(e, ctx);
	}
	const expenses = summarizeExpenses(input.expenses, ctx);

	const homeExpenses = input.expenses
		.filter((e) => e.category === 'home_office')
		.map((e) => ({ ...e, home_cost_type: e.home_cost_type ?? '', description: e.description ?? '' }));
	const homeOffice = summarizeHomeOffice({
		expenses: homeExpenses,
		config: input.homeOffice ?? null,
		incomeBeforeHome: revenue - otherDeductible
	});
	// Spread the (possibly limited) home deduction over the months the costs were incurred.
	const homeScale = homeOffice.available > 0 ? homeOffice.deductible / homeOffice.available : 0;
	for (let m = 1; m <= 12; m++) monthExpenses[m] += monthHome[m] * homeScale;

	const totalDeductible = otherDeductible + homeOffice.deductible;
	const netIncome = revenue - totalDeductible;
	const incomeTax = estimateIncomeTax({ netIncome, year, province: input.province, flatRate: input.flatRate });

	const applicable = input.payments.filter((p) => paymentAppliesToYear(p, year));
	const incomeTaxPaid = applicable.filter((p) => p.type === 'income_tax').reduce((s, p) => s + p.amount, 0);
	const gstPayments = applicable.filter((p) => p.type === 'gst');
	const gstPaid = gstPayments.reduce((s, p) => s + p.amount, 0);

	// GST/HST by filing period
	const periods = gstPeriods(year, frequency).map((period): GstPeriodRow => {
		const startM = monthOf(period.start);
		const endM = monthOf(period.end);
		let collected = 0;
		let itc = 0;
		for (let m = startM; m <= endM; m++) {
			collected += monthGst[m];
			itc += monthItc[m];
		}
		const net = collected - itc;
		const paid = gstPayments.filter((p) => p.period === period.key).reduce((s, p) => s + p.amount, 0);
		const balance = Math.max(0, net - paid);

		let status: GstPeriodStatus;
		if (period.end >= today) status = 'open';
		else if (net < -0.005) status = 'refund';
		else if (net <= 0.005) status = 'nothing_owed';
		else if (balance <= 0.005) status = 'paid';
		else if (period.paymentDue < today) status = 'overdue';
		else status = 'due';

		return { ...period, collected: round2(collected), itc: round2(itc), net: round2(net), paid: round2(paid), balance: round2(balance), status };
	});
	const periodKeys = new Set(periods.map((p) => p.key));
	const unassignedPaid = gstPayments.filter((p) => !periodKeys.has(p.period)).reduce((s, p) => s + p.amount, 0);

	const gstNet = gstCollected - expenses.itc;
	const effective = netIncome > 0 ? incomeTax.total / netIncome : 0;

	const months: TaxMonthRow[] = [];
	for (let m = 1; m <= 12; m++) {
		if (!monthRevenue[m] && !monthExpenses[m] && !monthGst[m] && !monthItc[m]) continue;
		months.push({
			month: m,
			label: MONTH_NAMES[m - 1],
			revenue: round2(monthRevenue[m]),
			expenses: round2(monthExpenses[m]),
			gstCollected: round2(monthGst[m]),
			gstItc: round2(monthItc[m]),
			netGst: round2(monthGst[m] - monthItc[m]),
			estIncomeTax: round2((monthRevenue[m] - monthExpenses[m]) * effective)
		});
	}

	return {
		year,
		revenue: round2(revenue),
		cadRevenue: round2(cadRevenue),
		foreignRevenue,
		missingRates,
		expenses,
		otherDeductible: round2(otherDeductible),
		homeOffice,
		totalDeductible: round2(totalDeductible),
		phoneDoubleCountRisk: homeOffice.phoneOrInternetInOther && input.expenses.some((e) => e.category === 'telephone'),
		netIncome: round2(netIncome),
		incomeTax,
		incomeTaxPaid: round2(incomeTaxPaid),
		incomeTaxBalance: round2(Math.max(0, incomeTax.total - incomeTaxPaid)),
		gst: {
			collected: round2(gstCollected),
			itc: expenses.itc,
			net: round2(gstNet),
			paid: round2(gstPaid),
			balance: round2(Math.max(0, gstNet - gstPaid)),
			frequency,
			periods,
			unassignedPaid: round2(unassignedPaid)
		},
		setAsideRate: revenue > 0 ? incomeTax.total / revenue : 0,
		months
	};
}
