import { TAX_DATA, type Bracket, type Jurisdiction, type PensionPlan, type TaxYearData } from './tax-data.js';

/**
 * Estimates personal income tax plus CPP/QPP for a self-employed sole
 * proprietor from net business income. It's a planning estimate, not a
 * return: it applies federal and provincial brackets, the basic personal
 * amount, the CPP/QPP deduction + credit and Ontario's surtax and Health
 * Premium. It ignores other credits, deductions and income sources, BPA
 * clawbacks at high incomes, low-income reductions, and Quebec's FSS/QPIP.
 */

export type ProvinceCode = keyof TaxYearData['provinces'];

export const PROVINCES: readonly { value: ProvinceCode; label: string }[] = [
	{ value: 'AB', label: 'Alberta' },
	{ value: 'BC', label: 'British Columbia' },
	{ value: 'MB', label: 'Manitoba' },
	{ value: 'NB', label: 'New Brunswick' },
	{ value: 'NL', label: 'Newfoundland and Labrador' },
	{ value: 'NS', label: 'Nova Scotia' },
	{ value: 'NT', label: 'Northwest Territories' },
	{ value: 'NU', label: 'Nunavut' },
	{ value: 'ON', label: 'Ontario' },
	{ value: 'PE', label: 'Prince Edward Island' },
	{ value: 'QC', label: 'Quebec' },
	{ value: 'SK', label: 'Saskatchewan' },
	{ value: 'YT', label: 'Yukon' }
];

export function isProvince(value: unknown): value is ProvinceCode {
	return PROVINCES.some((p) => p.value === value);
}

export function provinceLabel(code: string): string {
	return PROVINCES.find((p) => p.value === code)?.label ?? code;
}

/** Years with tax tables, ascending. */
export const TAX_TABLE_YEARS: readonly number[] = Object.keys(TAX_DATA).map(Number).sort((a, b) => a - b);

/** The tax table year used for `year`: an exact match, else the nearest available year. */
export function tableYearFor(year: number): number {
	const years = TAX_TABLE_YEARS;
	if (years.includes(year)) return year;
	if (year > years[years.length - 1]) return years[years.length - 1];
	return years[0];
}

/** Tax on `income` across progressive brackets. */
export function bracketTax(income: number, brackets: readonly Bracket[]): number {
	let tax = 0;
	let lower = 0;
	for (const b of brackets) {
		const upper = b.upTo ?? Infinity;
		if (income <= lower) break;
		tax += (Math.min(income, upper) - lower) * b.rate;
		lower = upper;
	}
	return tax;
}

export interface PensionContribution {
	/** Total contributions — a self-employed person pays both the employee and employer halves. */
	total: number;
	/** Deductible from income: the employer half plus the employee's enhanced portions. */
	deduction: number;
	/** The employee base portion, which earns a non-refundable credit instead. */
	creditBase: number;
}

/** CPP/QPP owed on net self-employment income. */
export function selfEmployedPension(netIncome: number, plan: PensionPlan): PensionContribution {
	const net = Math.max(0, netIncome);
	const pensionable = net > plan.basicExemption ? Math.min(net, plan.ympe) - plan.basicExemption : 0;
	const secondTier = Math.max(0, Math.min(net, plan.yampe) - plan.ympe);

	const employeeBase = pensionable * plan.baseRate;
	const employeeEnhanced = pensionable * plan.firstEnhancedRate;
	const employeeSecond = secondTier * plan.secondRate;
	const employeeHalf = employeeBase + employeeEnhanced + employeeSecond;

	return {
		total: employeeHalf * 2,
		deduction: employeeHalf + employeeEnhanced + employeeSecond,
		creditBase: employeeBase
	};
}

function jurisdictionTax(taxable: number, j: Jurisdiction, pensionCreditBase: number): number {
	const credits = j.lowestRate * (j.basicPersonalAmount + pensionCreditBase);
	const basic = Math.max(0, bracketTax(taxable, j.brackets) - credits);
	const surtax = (j.surtax ?? []).reduce((sum, t) => sum + Math.max(0, basic - t.threshold) * t.rate, 0);
	return basic + surtax;
}

/** Ontario Health Premium — a fixed schedule on taxable income, unchanged since 2004, capped at $900. */
export function ontarioHealthPremium(taxable: number): number {
	const tiers: [over: number, base: number, rate: number, cap: number][] = [
		[200_000, 750, 0.25, 900],
		[72_000, 600, 0.25, 750],
		[48_000, 450, 0.25, 600],
		[36_000, 300, 0.06, 450],
		[20_000, 0, 0.06, 300]
	];
	for (const [over, base, rate, cap] of tiers) {
		if (taxable > over) return Math.min(cap, base + (taxable - over) * rate);
	}
	return 0;
}

export type EstimateMethod = 'brackets' | 'flat' | 'none';

export interface IncomeTaxEstimate {
	method: EstimateMethod;
	/** Net self-employment income the estimate is based on (never negative). */
	netIncome: number;
	pensionPlan: 'CPP' | 'QPP' | null;
	/** CPP/QPP contributions, both halves. */
	pension: number;
	pensionDeduction: number;
	taxableIncome: number;
	federalTax: number;
	provincialTax: number;
	/** Federal + provincial income tax. */
	incomeTax: number;
	/** Income tax + CPP/QPP — what to plan to pay. */
	total: number;
	/** total ÷ net income. */
	effectiveRate: number;
	/** Share of the next dollar of profit that goes to tax + CPP/QPP. */
	marginalRate: number;
	/** Tax table year used — may differ from the year asked for when tables aren't published yet. */
	tableYear: number | null;
	province: ProvinceCode | null;
}

interface Core {
	pension: PensionContribution;
	taxable: number;
	federal: number;
	provincial: number;
}

function computeBrackets(net: number, data: TaxYearData, province: ProvinceCode): Core {
	const plan = province === 'QC' ? data.qpp : data.cpp;
	const pension = selfEmployedPension(net, plan);
	const taxable = Math.max(0, net - pension.deduction);

	let federal = jurisdictionTax(taxable, data.federal, pension.creditBase);
	// Quebec residents get a refundable abatement off basic federal tax.
	if (province === 'QC') federal *= 1 - data.quebecAbatement;
	let provincial = jurisdictionTax(taxable, data.provinces[province], pension.creditBase);
	if (province === 'ON') provincial += ontarioHealthPremium(taxable);

	return { pension, taxable, federal, provincial };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function estimateIncomeTax(opts: {
	netIncome: number;
	year: number;
	province?: string | null;
	/** Flat rate in percent, used when no province is set. */
	flatRate?: number | null;
}): IncomeTaxEstimate {
	const net = Math.max(0, opts.netIncome);
	const base = { netIncome: round2(net), province: null, tableYear: null, pensionPlan: null, pension: 0, pensionDeduction: 0 } as const;

	if (isProvince(opts.province)) {
		const province = opts.province;
		const tableYear = tableYearFor(opts.year);
		const data = TAX_DATA[tableYear];
		const core = computeBrackets(net, data, province);
		const next = computeBrackets(net + 100, data, province);
		const total = core.federal + core.provincial + core.pension.total;
		const nextTotal = next.federal + next.provincial + next.pension.total;
		return {
			method: 'brackets',
			netIncome: round2(net),
			pensionPlan: province === 'QC' ? 'QPP' : 'CPP',
			pension: round2(core.pension.total),
			pensionDeduction: round2(core.pension.deduction),
			taxableIncome: round2(core.taxable),
			federalTax: round2(core.federal),
			provincialTax: round2(core.provincial),
			incomeTax: round2(core.federal + core.provincial),
			total: round2(total),
			effectiveRate: net > 0 ? total / net : 0,
			marginalRate: (nextTotal - total) / 100,
			tableYear,
			province
		};
	}

	const rate = Math.max(0, opts.flatRate ?? 0) / 100;
	if (rate > 0) {
		const tax = net * rate;
		return {
			...base,
			method: 'flat',
			taxableIncome: round2(net),
			federalTax: 0,
			provincialTax: 0,
			incomeTax: round2(tax),
			total: round2(tax),
			effectiveRate: rate,
			marginalRate: rate
		};
	}

	return {
		...base,
		method: 'none',
		taxableIncome: round2(net),
		federalTax: 0,
		provincialTax: 0,
		incomeTax: 0,
		total: 0,
		effectiveRate: 0,
		marginalRate: 0
	};
}
