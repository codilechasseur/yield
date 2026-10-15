import type { Expense, ExpenseCategory } from './types.js';

export interface ExpenseCategoryInfo {
	value: ExpenseCategory;
	label: string;
	/** CRA form T2125 line the category is reported on. */
	t2125Line: string;
	/** Share of the cost that's deductible (and claimable as an ITC). */
	deductibleShare: number;
	hint: string;
}

/**
 * Expense categories, ordered for the picker. Lines follow CRA form T2125
 * (Statement of Business or Professional Activities). Capital purchases such
 * as computers are deliberately absent — they're depreciated through capital
 * cost allowance, not deducted in full, so they need an accountant's input.
 */
export const EXPENSE_CATEGORIES: readonly ExpenseCategoryInfo[] = [
	{ value: 'software', label: 'Software & subscriptions', t2125Line: '8810', deductibleShare: 1, hint: 'SaaS tools, hosting, domains, AI subscriptions' },
	{ value: 'office', label: 'Office expenses', t2125Line: '8810', deductibleShare: 1, hint: 'Small items used up within a year' },
	{ value: 'supplies', label: 'Supplies', t2125Line: '8811', deductibleShare: 1, hint: 'Stationery, printer ink, postage' },
	{ value: 'telephone', label: 'Phone & internet', t2125Line: '9220', deductibleShare: 1, hint: 'Usually part personal — set business use %' },
	{ value: 'professional', label: 'Professional fees', t2125Line: '8860', deductibleShare: 1, hint: 'Accounting, legal, bookkeeping' },
	{ value: 'fees', label: 'Licences, dues & memberships', t2125Line: '8760', deductibleShare: 1, hint: 'Professional associations, business licences' },
	{ value: 'advertising', label: 'Advertising', t2125Line: '8521', deductibleShare: 1, hint: 'Ads, sponsorships, promotional material' },
	{ value: 'meals', label: 'Meals & entertainment', t2125Line: '8523', deductibleShare: 0.5, hint: 'Only 50% is deductible — applied automatically' },
	{ value: 'travel', label: 'Travel', t2125Line: '9200', deductibleShare: 1, hint: 'Transit, flights, hotels for business trips' },
	{ value: 'vehicle', label: 'Vehicle', t2125Line: '9281', deductibleShare: 1, hint: 'Fuel, insurance, repairs — set business use %' },
	{ value: 'home_office', label: 'Business use of home', t2125Line: '9945', deductibleShare: 1, hint: 'Share of rent, utilities — set business use %' },
	{ value: 'rent', label: 'Rent (business premises)', t2125Line: '8910', deductibleShare: 1, hint: 'Office or co-working space' },
	{ value: 'insurance', label: 'Insurance', t2125Line: '8690', deductibleShare: 1, hint: 'Liability and business insurance' },
	{ value: 'interest', label: 'Interest & bank charges', t2125Line: '8710', deductibleShare: 1, hint: 'Business account fees, card fees, loan interest' },
	{ value: 'repairs', label: 'Repairs & maintenance', t2125Line: '8960', deductibleShare: 1, hint: 'Repairs to business equipment or premises' },
	{ value: 'other', label: 'Other', t2125Line: '9270', deductibleShare: 1, hint: 'Anything that fits nowhere else' }
];

const CATEGORY_MAP = new Map(EXPENSE_CATEGORIES.map((c) => [c.value, c]));

export function isExpenseCategory(value: unknown): value is ExpenseCategory {
	return typeof value === 'string' && CATEGORY_MAP.has(value as ExpenseCategory);
}

/** Category metadata; empty or unknown values (older expenses) fall back to "Other". */
export function categoryInfo(category: string | null | undefined): ExpenseCategoryInfo {
	return CATEGORY_MAP.get(category as ExpenseCategory) ?? CATEGORY_MAP.get('other')!;
}

type ExpenseLike = Pick<Expense, 'amount' | 'gst_paid' | 'category' | 'business_use_percent'>;

/** Business-use share as a fraction. Missing/0 means fully business — expenses predating the field. */
export function businessUseFraction(percent: number | null | undefined): number {
	if (!percent || percent <= 0) return 1;
	return Math.min(percent, 100) / 100;
}

/** Fraction of the expense (and of its GST) that can be claimed. */
export function claimableFraction(e: Pick<ExpenseLike, 'category' | 'business_use_percent'>): number {
	return businessUseFraction(e.business_use_percent) * categoryInfo(e.category).deductibleShare;
}

/** The part of the pre-tax amount that reduces taxable income. */
export function deductibleAmount(e: ExpenseLike): number {
	return round2((e.amount ?? 0) * claimableFraction(e));
}

/** The part of the GST/HST paid that can be claimed back as an input tax credit. */
export function claimableItc(e: ExpenseLike): number {
	return round2((e.gst_paid ?? 0) * claimableFraction(e));
}

export interface CategoryTotal {
	category: ExpenseCategory;
	label: string;
	t2125Line: string;
	count: number;
	spent: number;
	deductible: number;
	itc: number;
}

export interface ExpenseTotals {
	count: number;
	/** Pre-tax amount actually spent. */
	spent: number;
	/** Amount that reduces taxable income (business use % and the meals 50% rule applied). */
	deductible: number;
	gstPaid: number;
	/** GST/HST claimable as input tax credits. */
	itc: number;
	/** Per-category totals, largest deductible first. */
	byCategory: CategoryTotal[];
}

export function summarizeExpenses(expenses: readonly ExpenseLike[]): ExpenseTotals {
	const byCat = new Map<ExpenseCategory, CategoryTotal>();
	const totals: ExpenseTotals = { count: 0, spent: 0, deductible: 0, gstPaid: 0, itc: 0, byCategory: [] };

	for (const e of expenses) {
		const info = categoryInfo(e.category);
		const deductible = deductibleAmount(e);
		const itc = claimableItc(e);
		totals.count++;
		totals.spent += e.amount ?? 0;
		totals.deductible += deductible;
		totals.gstPaid += e.gst_paid ?? 0;
		totals.itc += itc;

		let row = byCat.get(info.value);
		if (!row) {
			row = { category: info.value, label: info.label, t2125Line: info.t2125Line, count: 0, spent: 0, deductible: 0, itc: 0 };
			byCat.set(info.value, row);
		}
		row.count++;
		row.spent += e.amount ?? 0;
		row.deductible += deductible;
		row.itc += itc;
	}

	totals.spent = round2(totals.spent);
	totals.deductible = round2(totals.deductible);
	totals.gstPaid = round2(totals.gstPaid);
	totals.itc = round2(totals.itc);
	totals.byCategory = [...byCat.values()]
		.map((r) => ({ ...r, spent: round2(r.spent), deductible: round2(r.deductible), itc: round2(r.itc) }))
		.sort((a, b) => b.deductible - a.deductible || a.label.localeCompare(b.label));
	return totals;
}

/**
 * Parses a business-use percentage from form input. Blank means 100.
 * Returns null when the value is outside 1–100 (0% business use isn't an expense).
 */
export function parseBusinessUse(raw: string | null | undefined): number | null {
	const s = (raw ?? '').trim();
	if (s === '') return 100;
	const n = Number(s);
	if (!Number.isFinite(n) || n < 1 || n > 100) return null;
	return Math.round(n * 100) / 100;
}

function round2(n: number): number {
	return Math.round(n * 100) / 100;
}
