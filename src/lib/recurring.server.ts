/**
 * Turns recurring_expenses schedules into ordinary expense records as charges
 * come due. Runs from the background sweep (reminders.server.ts) and lazily
 * on page loads, so totals are current even between sweeps.
 *
 * Duplicates are prevented twice over: `last_generated` moves forward after
 * each run (so a charge you delete is never recreated), and a unique index on
 * expenses (recurring, expense_date) rejects a second copy if two runs race.
 */
import type PocketBase from 'pocketbase';
import type { RecurringExpense } from './types.js';
import { dueOccurrences } from './recurring.js';

export interface GenerateResult {
	created: number;
	errors: string[];
}

export function todayIso(): string {
	return new Date().toISOString().slice(0, 10);
}

/** True when PocketBase rejected a create because of a unique index. */
export function isUniqueViolation(e: unknown): boolean {
	const data = (e as { response?: { data?: Record<string, { code?: string }> } })?.response?.data;
	if (!data || typeof data !== 'object') return false;
	return Object.values(data).some((v) => v?.code === 'validation_not_unique');
}

async function generateForSchedule(pb: PocketBase, s: RecurringExpense, today: string, result: GenerateResult) {
	const dates = dueOccurrences(s, today);
	if (dates.length === 0) return;

	let last = '';
	try {
		for (const expense_date of dates) {
			try {
				await pb.collection('expenses').create({
					description: s.description,
					amount: s.amount,
					gst_paid: s.gst_paid ?? 0,
					category: s.category || 'other',
					business_use_percent: s.business_use_percent || 100,
					home_cost_type: s.home_cost_type ?? '',
					notes: s.notes ?? '',
					expense_date,
					recurring: s.id
				});
				result.created++;
			} catch (e) {
				// Another run created this charge first — that's the outcome we wanted.
				if (!isUniqueViolation(e)) throw e;
			}
			last = expense_date;
		}
	} catch (e) {
		result.errors.push(`${s.description}: ${(e as Error).message}`);
	} finally {
		if (last) await pb.collection('recurring_expenses').update(s.id, { last_generated: last });
	}
}

let inFlight: Promise<GenerateResult> | null = null;

/**
 * Creates every due-but-missing charge across all schedules. Concurrent calls
 * in this process share one run. Never throws for a single bad schedule —
 * failures are collected in `errors`; it does throw if the schedules can't be listed.
 */
export function generateRecurringExpenses(pb: PocketBase, today = todayIso()): Promise<GenerateResult> {
	inFlight ??= (async () => {
		const result: GenerateResult = { created: 0, errors: [] };
		const schedules = await pb.collection('recurring_expenses').getFullList<RecurringExpense>();
		for (const s of schedules) await generateForSchedule(pb, s, today, result);
		return result;
	})().finally(() => {
		inFlight = null;
	});
	return inFlight;
}

/** Creates the due charges for one schedule — used right after it's created or edited. */
export async function generateForRecurringExpense(pb: PocketBase, id: string, today = todayIso()): Promise<GenerateResult> {
	const result: GenerateResult = { created: 0, errors: [] };
	const s = await pb.collection('recurring_expenses').getOne<RecurringExpense>(id);
	await generateForSchedule(pb, s, today, result);
	return result;
}
