import type { GstFilingFrequency } from './types.js';

/**
 * GST/HST reporting periods and CRA due dates for a sole proprietor with a
 * calendar fiscal year. Period keys are stored on tax_payments.period:
 *   annual    → "2026"
 *   quarterly → "2026-Q3"
 *   monthly   → "2026-07"
 */

export const GST_FREQUENCIES: readonly { value: GstFilingFrequency; label: string }[] = [
	{ value: 'annual', label: 'Annually' },
	{ value: 'quarterly', label: 'Quarterly' },
	{ value: 'monthly', label: 'Monthly' }
];

export function isGstFrequency(value: unknown): value is GstFilingFrequency {
	return GST_FREQUENCIES.some((f) => f.value === value);
}

export interface GstPeriod {
	key: string;
	label: string;
	/** First day of the period, YYYY-MM-DD. */
	start: string;
	/** Last day of the period, YYYY-MM-DD. */
	end: string;
	/** When the net tax must be paid. */
	paymentDue: string;
	/** When the return must be filed (differs from paymentDue only for annual filers). */
	filingDue: string;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
	'January', 'February', 'March', 'April', 'May', 'June',
	'July', 'August', 'September', 'October', 'November', 'December'
];

function pad(n: number): string {
	return String(n).padStart(2, '0');
}

/** Last day of a month as YYYY-MM-DD (month1 is 1–12; 13 rolls into next year). */
function endOfMonth(year: number, month1: number): string {
	const d = new Date(Date.UTC(year, month1, 0));
	return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function monthPeriod(year: number, m: number): GstPeriod {
	const due = endOfMonth(year, m + 1);
	return {
		key: `${year}-${pad(m)}`,
		label: `${MONTHS_LONG[m - 1]} ${year}`,
		start: `${year}-${pad(m)}-01`,
		end: endOfMonth(year, m),
		paymentDue: due,
		filingDue: due
	};
}

function quarterPeriod(year: number, q: number): GstPeriod {
	const firstMonth = (q - 1) * 3 + 1;
	const lastMonth = firstMonth + 2;
	const due = endOfMonth(year, lastMonth + 1);
	return {
		key: `${year}-Q${q}`,
		label: `Q${q} (${MONTHS_SHORT[firstMonth - 1]}–${MONTHS_SHORT[lastMonth - 1]}) ${year}`,
		start: `${year}-${pad(firstMonth)}-01`,
		end: endOfMonth(year, lastMonth),
		paymentDue: due,
		filingDue: due
	};
}

function annualPeriod(year: number): GstPeriod {
	// Individuals with business income and a Dec 31 year-end: pay by April 30, file by June 15.
	return {
		key: String(year),
		label: `${year} (annual)`,
		start: `${year}-01-01`,
		end: `${year}-12-31`,
		paymentDue: `${year + 1}-04-30`,
		filingDue: `${year + 1}-06-15`
	};
}

export function gstPeriods(year: number, frequency: GstFilingFrequency): GstPeriod[] {
	if (frequency === 'monthly') return Array.from({ length: 12 }, (_, i) => monthPeriod(year, i + 1));
	if (frequency === 'quarterly') return [1, 2, 3, 4].map((q) => quarterPeriod(year, q));
	return [annualPeriod(year)];
}

/** The period key a date (YYYY-MM-DD or PocketBase datetime) falls into. */
export function periodKeyForDate(date: string, frequency: GstFilingFrequency): string {
	const year = Number(date.slice(0, 4));
	const month = Number(date.slice(5, 7));
	if (frequency === 'monthly') return `${year}-${pad(month)}`;
	if (frequency === 'quarterly') return `${year}-Q${Math.ceil(month / 3)}`;
	return String(year);
}

/** Parses any period key back into a period; null when the key is malformed. */
export function parsePeriodKey(key: string): GstPeriod | null {
	let m = /^(\d{4})$/.exec(key);
	if (m) return annualPeriod(Number(m[1]));
	m = /^(\d{4})-Q([1-4])$/.exec(key);
	if (m) return quarterPeriod(Number(m[1]), Number(m[2]));
	m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(key);
	if (m) return monthPeriod(Number(m[1]), Number(m[2]));
	return null;
}

export function isPeriodKey(key: string): boolean {
	return parsePeriodKey(key) !== null;
}

/** The tax year a period key belongs to (NaN when malformed). */
export function periodYear(key: string): number {
	return /^\d{4}/.test(key) ? Number(key.slice(0, 4)) : NaN;
}

/** Human label for a stored period key, falling back to the raw key. */
export function periodLabel(key: string): string {
	return parsePeriodKey(key)?.label ?? key;
}

export interface IncomeTaxDates {
	/** Quarterly instalment dates within the tax year (only required above CRA's $3,000 threshold). */
	instalments: string[];
	/** Balance owing is due April 30 of the following year. */
	balanceDue: string;
	/** Self-employed individuals file by June 15 of the following year. */
	filingDue: string;
}

export function incomeTaxDates(year: number): IncomeTaxDates {
	return {
		instalments: [`${year}-03-15`, `${year}-06-15`, `${year}-09-15`, `${year}-12-15`],
		balanceDue: `${year + 1}-04-30`,
		filingDue: `${year + 1}-06-15`
	};
}
