import type { RecurrenceFrequency, RecurringExpense } from './types.js';

/**
 * Pure date math for recurring expenses. All dates are calendar dates as
 * "YYYY-MM-DD" strings in UTC, matching how expense_date is stored.
 */

export const FREQUENCIES: readonly { value: RecurrenceFrequency; label: string; perYear: number }[] = [
	{ value: 'monthly', label: 'Monthly', perYear: 12 },
	{ value: 'yearly', label: 'Yearly', perYear: 1 },
	{ value: 'quarterly', label: 'Every 3 months', perYear: 4 },
	{ value: 'weekly', label: 'Weekly', perYear: 52 }
];

/** Upper bound on charges produced in one call — guards against a typo'd start year. */
export const MAX_OCCURRENCES = 1000;

export function isFrequency(value: unknown): value is RecurrenceFrequency {
	return FREQUENCIES.some((f) => f.value === value);
}

export function frequencyLabel(frequency: RecurrenceFrequency): string {
	return FREQUENCIES.find((f) => f.value === frequency)?.label ?? frequency;
}

/** Normalises a PocketBase datetime ("2026-01-15 00:00:00.000Z") or ISO date to "YYYY-MM-DD"; '' when empty/invalid. */
export function toIsoDate(value: string | null | undefined): string {
	const s = (value ?? '').trim().slice(0, 10);
	return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function daysInMonth(year: number, month1: number): number {
	return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

function fmt(y: number, m1: number, d: number): string {
	return `${String(y).padStart(4, '0')}-${String(m1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Adds whole months, keeping the original day of month and clamping to the end
 * of shorter months (Jan 31 → Feb 28 → Mar 31: the anchor never drifts).
 */
export function addMonths(isoDate: string, months: number): string {
	const [y, m, d] = isoDate.split('-').map(Number);
	const total = y * 12 + (m - 1) + months;
	const ny = Math.floor(total / 12);
	const nm = (total % 12) + 1;
	return fmt(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

function addDays(isoDate: string, days: number): string {
	const [y, m, d] = isoDate.split('-').map(Number);
	const dt = new Date(Date.UTC(y, m - 1, d + days));
	return fmt(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** The n-th charge date (n = 0 is the start date). */
export function nthOccurrence(startDate: string, frequency: RecurrenceFrequency, n: number): string {
	switch (frequency) {
		case 'weekly':
			return addDays(startDate, 7 * n);
		case 'quarterly':
			return addMonths(startDate, 3 * n);
		case 'yearly':
			return addMonths(startDate, 12 * n);
		case 'monthly':
		default:
			return addMonths(startDate, n);
	}
}

type Schedule = Pick<RecurringExpense, 'frequency' | 'start_date' | 'end_date' | 'last_generated'>;

/**
 * Charge dates that are due but haven't been created yet: after
 * `last_generated`, on or before both `today` and `end_date`.
 */
export function dueOccurrences(schedule: Schedule, today: string): string[] {
	const start = toIsoDate(schedule.start_date);
	if (!start) return [];
	const end = toIsoDate(schedule.end_date);
	const through = end && end < today ? end : today;
	const after = toIsoDate(schedule.last_generated);

	const dates: string[] = [];
	for (let n = 0; n < MAX_OCCURRENCES * 10; n++) {
		const d = nthOccurrence(start, schedule.frequency, n);
		if (d > through) break;
		if (after && d <= after) continue;
		dates.push(d);
		if (dates.length >= MAX_OCCURRENCES) break;
	}
	return dates;
}

/** The next charge date after today (and after the last one created), or null once the schedule has ended. */
export function nextOccurrence(schedule: Schedule, today: string): string | null {
	const start = toIsoDate(schedule.start_date);
	if (!start) return null;
	const end = toIsoDate(schedule.end_date);
	const last = toIsoDate(schedule.last_generated);
	const floor = last > today ? last : today;

	for (let n = 0; n < MAX_OCCURRENCES * 10; n++) {
		const d = nthOccurrence(start, schedule.frequency, n);
		if (end && d > end) return null;
		if (d > floor) return d;
	}
	return null;
}

/** Whether the schedule still has charges to come. */
export function isActive(schedule: Schedule, today: string): boolean {
	return nextOccurrence(schedule, today) !== null;
}

/** Approximate cost over a year at the current amount. */
export function annualCost(amount: number, frequency: RecurrenceFrequency): number {
	const perYear = FREQUENCIES.find((f) => f.value === frequency)?.perYear ?? 12;
	return Math.round(amount * perYear * 100) / 100;
}
