import type { Expense, HomeCostType, HomeOfficeConfig } from './types.js';
import { businessUseFraction } from './expenses.js';

/**
 * Business use of home — CRA form T2125 Part 7 (line 9945).
 *
 * The home's running costs are logged in full as 'home_office' expenses; the
 * business part is the workspace's share of the home (by area or rooms) times
 * the share of time it's used for business. The deduction can't create or
 * increase a business loss: anything over net income (before this deduction)
 * is carried forward to the next year.
 */

export const HOME_COST_TYPES: readonly { value: HomeCostType; label: string; hint: string }[] = [
	{ value: 'heat', label: 'Heat', hint: 'Gas, oil or other heating' },
	{ value: 'electricity', label: 'Electricity', hint: 'Hydro bills' },
	{ value: 'insurance', label: 'Insurance', hint: 'Home insurance' },
	{ value: 'maintenance', label: 'Maintenance', hint: 'Repairs and upkeep for the whole home' },
	{ value: 'mortgage_interest', label: 'Mortgage interest', hint: 'The interest only — not principal repayments' },
	{ value: 'property_taxes', label: 'Property taxes', hint: 'Municipal property tax' },
	{ value: 'rent', label: 'Rent', hint: 'If you rent your home' },
	{ value: 'other', label: 'Other expenses', hint: 'e.g. water, condo fees — add a description' }
];

const TYPE_LABELS = new Map(HOME_COST_TYPES.map((t) => [t.value, t.label]));

export function isHomeCostType(value: unknown): value is HomeCostType {
	return typeof value === 'string' && TYPE_LABELS.has(value as HomeCostType);
}

/** Label for a home cost type; empty or unknown (older records) is "Other expenses". */
export function homeCostLabel(type: string | null | undefined): string {
	return TYPE_LABELS.get(type as HomeCostType) ?? 'Other expenses';
}

/** Validates a stored or submitted setup. Returns null unless the areas and time share make sense. */
export function parseHomeOfficeConfig(raw: unknown): HomeOfficeConfig | null {
	if (!raw || typeof raw !== 'object') return null;
	const r = raw as Record<string, unknown>;
	const home_area = Number(r.home_area);
	const workspace_area = Number(r.workspace_area);
	const business_time_percent = r.business_time_percent === undefined || r.business_time_percent === '' ? 100 : Number(r.business_time_percent);
	const carryforward = r.carryforward === undefined || r.carryforward === '' || r.carryforward === null ? 0 : Number(r.carryforward);

	if (!(home_area > 0) || !(workspace_area > 0) || workspace_area > home_area) return null;
	if (!(business_time_percent > 0) || business_time_percent > 100) return null;
	if (!Number.isFinite(carryforward) || carryforward < 0) return null;
	return { home_area, workspace_area, business_time_percent, carryforward };
}

/** The setup for one year from settings.home_office, or null when it's missing or invalid. */
export function homeConfigForYear(all: Record<string, unknown> | null | undefined, year: number): HomeOfficeConfig | null {
	return parseHomeOfficeConfig(all?.[String(year)]);
}

/** Business share of home costs: workspace ÷ home × business time. Null without a valid setup. */
export function homeOfficeShare(config: HomeOfficeConfig | null | undefined): number | null {
	const c = parseHomeOfficeConfig(config);
	if (!c) return null;
	return (c.workspace_area / c.home_area) * (c.business_time_percent / 100);
}

export interface HomeOfficeLine {
	type: HomeCostType;
	label: string;
	/** Full cost for the year, before the business share. */
	amount: number;
	/** Descriptions of the expenses on this line (shown for "Other expenses", like the CRA form). */
	descriptions: string[];
}

export interface HomeOfficeSummary {
	config: HomeOfficeConfig | null;
	/** Business share as a fraction; null when not set up (each expense's business-use % is used instead). */
	share: number | null;
	count: number;
	/** Every Part 7 line in form order, including zero lines. */
	lines: HomeOfficeLine[];
	subtotal: number;
	personalPart: number;
	businessPart: number;
	carryforwardIn: number;
	/** businessPart + carryforwardIn. */
	available: number;
	/** Net income before this deduction — the most that can be deducted. */
	limit: number;
	/** What comes off income this year (T2125 line 9945). */
	deductible: number;
	/** Unused amount to carry into next year. */
	carriedForward: number;
	/** Home costs described like phone/internet — risk of double-counting with "Phone & internet" expenses. */
	phoneOrInternetInOther: boolean;
}

type HomeExpense = Pick<Expense, 'amount' | 'business_use_percent' | 'home_cost_type' | 'description'>;

const PHONE_OR_INTERNET = /internet|phone|cell|mobile|wi-?fi/i;
const round2 = (n: number) => Math.round(n * 100) / 100 || 0;

export function summarizeHomeOffice(input: {
	/** Only expenses in the 'home_office' category. */
	expenses: readonly HomeExpense[];
	config: HomeOfficeConfig | null;
	/** Net business income before the home office deduction. */
	incomeBeforeHome: number;
}): HomeOfficeSummary {
	const config = parseHomeOfficeConfig(input.config);
	const share = homeOfficeShare(config);

	const lines: HomeOfficeLine[] = HOME_COST_TYPES.map((t) => ({ type: t.value, label: t.label, amount: 0, descriptions: [] }));
	const byType = new Map(lines.map((l) => [l.type, l]));
	let subtotal = 0;
	let businessPart = 0;
	let phoneOrInternetInOther = false;

	for (const e of input.expenses) {
		const type: HomeCostType = isHomeCostType(e.home_cost_type) ? e.home_cost_type : 'other';
		const line = byType.get(type)!;
		line.amount += e.amount ?? 0;
		if (e.description && !line.descriptions.includes(e.description)) line.descriptions.push(e.description);
		if (type === 'other' && PHONE_OR_INTERNET.test(e.description ?? '')) phoneOrInternetInOther = true;
		subtotal += e.amount ?? 0;
		// Without a setup, fall back to each expense's own business-use percentage.
		if (share === null) businessPart += (e.amount ?? 0) * businessUseFraction(e.business_use_percent);
	}
	if (share !== null) businessPart = subtotal * share;

	const carryforwardIn = config?.carryforward ?? 0;
	const available = businessPart + carryforwardIn;
	const limit = Math.max(0, input.incomeBeforeHome);
	const deductible = Math.min(available, limit);

	return {
		config,
		share,
		count: input.expenses.length,
		lines: lines.map((l) => ({ ...l, amount: round2(l.amount) })),
		subtotal: round2(subtotal),
		personalPart: round2(subtotal - round2(businessPart)),
		businessPart: round2(businessPart),
		carryforwardIn: round2(carryforwardIn),
		available: round2(available),
		limit: round2(limit),
		deductible: round2(deductible),
		carriedForward: round2(available - deductible),
		phoneOrInternetInOther
	};
}
