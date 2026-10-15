import { describe, it, expect, vi, afterEach } from 'vitest';
import type PocketBase from 'pocketbase';
import {
	todayIso,
	isUniqueViolation,
	generateRecurringExpenses,
	generateForRecurringExpense,
	timingChanged,
	rescheduleRecurringExpense
} from '../recurring.server.js';
import type { RecurringExpense } from '../types.js';

const uniqueError = () =>
	Object.assign(new Error('Failed to create record.'), {
		response: { data: { expense_date: { code: 'validation_not_unique', message: 'Value must be unique.' } } }
	});

function schedule(overrides: Partial<RecurringExpense> = {}): RecurringExpense {
	return {
		id: 'rec1',
		description: 'Anthropic',
		amount: 20,
		gst_paid: 2.6,
		category: 'software',
		business_use_percent: 100,
		home_cost_type: '',
		notes: '',
		frequency: 'monthly',
		start_date: '2026-08-15 00:00:00.000Z',
		end_date: '',
		last_generated: '',
		created: '',
		updated: '',
		...overrides
	};
}

/**
 * Minimal PocketBase stand-in. `existing` holds "recurring|date" keys that
 * already exist (create throws a unique violation for them); `failOn` dates
 * throw a generic error.
 */
function fakePb(schedules: RecurringExpense[], opts: { existing?: string[]; failOn?: string[] } = {}) {
	const created: Record<string, unknown>[] = [];
	const updates: { id: string; data: Record<string, unknown> }[] = [];
	const existing = new Set(opts.existing ?? []);
	const listCalls = { count: 0 };

	const pb = {
		collection: (name: string) => {
			if (name === 'recurring_expenses') {
				return {
					getFullList: async () => {
						listCalls.count++;
						return schedules;
					},
					getOne: async (id: string) => {
						const s = schedules.find((x) => x.id === id);
						if (!s) throw new Error('not found');
						return s;
					},
					update: async (id: string, data: Record<string, unknown>) => {
						updates.push({ id, data });
						return {};
					}
				};
			}
			return {
				create: async (data: Record<string, unknown>) => {
					const key = `${data.recurring}|${data.expense_date}`;
					if (opts.failOn?.includes(data.expense_date as string)) throw new Error('disk full');
					if (existing.has(key)) throw uniqueError();
					existing.add(key);
					created.push(data);
					return data;
				}
			};
		}
	} as unknown as PocketBase;

	return { pb, created, updates, listCalls };
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('todayIso', () => {
	it('formats the current UTC date', () => {
		vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 9, 15, 23, 30));
		expect(todayIso()).toBe('2026-10-15');
	});
});

describe('isUniqueViolation', () => {
	it('detects PocketBase unique-index errors', () => {
		expect(isUniqueViolation(uniqueError())).toBe(true);
	});

	it('ignores other errors and non-errors', () => {
		expect(isUniqueViolation(new Error('boom'))).toBe(false);
		expect(isUniqueViolation({ response: { data: { amount: { code: 'validation_required' } } } })).toBe(false);
		expect(isUniqueViolation(null)).toBe(false);
		expect(isUniqueViolation(undefined)).toBe(false);
	});
});

describe('generateRecurringExpenses', () => {
	it('creates each due charge as an expense and records the last one', async () => {
		const { pb, created, updates } = fakePb([schedule()]);
		const result = await generateRecurringExpenses(pb, '2026-10-15');

		expect(result).toEqual({ created: 3, errors: [] });
		expect(created.map((c) => c.expense_date)).toEqual(['2026-08-15', '2026-09-15', '2026-10-15']);
		expect(created[0]).toMatchObject({
			description: 'Anthropic',
			amount: 20,
			gst_paid: 2.6,
			category: 'software',
			business_use_percent: 100,
			recurring: 'rec1'
		});
		expect(updates).toEqual([{ id: 'rec1', data: { last_generated: '2026-10-15' } }]);
	});

	it('does nothing when no charge is due', async () => {
		const { pb, created, updates } = fakePb([schedule({ last_generated: '2026-10-15' })]);
		expect(await generateRecurringExpenses(pb, '2026-10-20')).toEqual({ created: 0, errors: [] });
		expect(created).toEqual([]);
		expect(updates).toEqual([]);
	});

	it('copies the home cost line onto each charge', async () => {
		const { pb, created } = fakePb([schedule({ category: 'home_office', home_cost_type: 'electricity', start_date: '2026-10-15' })]);
		await generateRecurringExpenses(pb, '2026-10-15');
		expect(created[0]).toMatchObject({ category: 'home_office', home_cost_type: 'electricity' });
	});

	it('defaults a missing category and business use on older schedules', async () => {
		const { pb, created } = fakePb([schedule({ category: '', business_use_percent: 0, start_date: '2026-10-15' })]);
		await generateRecurringExpenses(pb, '2026-10-15');
		expect(created[0]).toMatchObject({ category: 'other', business_use_percent: 100 });
	});

	it('treats a charge another run already created as done', async () => {
		const { pb, created, updates } = fakePb([schedule()], { existing: ['rec1|2026-09-15'] });
		const result = await generateRecurringExpenses(pb, '2026-10-15');
		expect(result).toEqual({ created: 2, errors: [] });
		expect(created.map((c) => c.expense_date)).toEqual(['2026-08-15', '2026-10-15']);
		expect(updates[0].data).toEqual({ last_generated: '2026-10-15' });
	});

	it('records failures, keeps progress, and carries on with other schedules', async () => {
		const other = schedule({ id: 'rec2', description: 'Hosting', start_date: '2026-10-01' });
		const { pb, created, updates } = fakePb([schedule(), other], { failOn: ['2026-09-15'] });
		const result = await generateRecurringExpenses(pb, '2026-10-15');

		expect(result.created).toBe(2); // Aug for rec1, Oct 1 for rec2
		expect(result.errors).toEqual(['Anthropic: disk full']);
		expect(updates).toEqual([
			{ id: 'rec1', data: { last_generated: '2026-08-15' } },
			{ id: 'rec2', data: { last_generated: '2026-10-01' } }
		]);
		expect(created.map((c) => `${c.recurring} ${c.expense_date}`)).toEqual(['rec1 2026-08-15', 'rec2 2026-10-01']);
	});

	it('shares one run between concurrent callers', async () => {
		const { pb, listCalls } = fakePb([schedule()]);
		const [a, b] = await Promise.all([generateRecurringExpenses(pb, '2026-10-15'), generateRecurringExpenses(pb, '2026-10-15')]);
		expect(a).toBe(b);
		expect(listCalls.count).toBe(1);
	});

	it('rejects when schedules cannot be listed', async () => {
		const pb = {
			collection: () => ({
				getFullList: async () => {
					throw new Error('db down');
				}
			})
		} as unknown as PocketBase;
		await expect(generateRecurringExpenses(pb, '2026-10-15')).rejects.toThrow('db down');
	});
});

describe('generateForRecurringExpense', () => {
	it('only generates for the given schedule', async () => {
		const { pb, created } = fakePb([schedule(), schedule({ id: 'rec2', start_date: '2026-10-01' })]);
		const result = await generateForRecurringExpense(pb, 'rec2', '2026-10-15');
		expect(result).toEqual({ created: 1, errors: [] });
		expect(created.map((c) => c.recurring)).toEqual(['rec2']);
	});
});

describe('timingChanged', () => {
	const t = { start_date: '2026-01-15 00:00:00.000Z', frequency: 'monthly' as const, end_date: '' };

	it('ignores formatting differences', () => {
		expect(timingChanged(t, { ...t, start_date: '2026-01-15' })).toBe(false);
	});

	it('detects a new start date, frequency or end date', () => {
		expect(timingChanged(t, { ...t, start_date: '2026-01-01' })).toBe(true);
		expect(timingChanged(t, { ...t, frequency: 'yearly' })).toBe(true);
		expect(timingChanged(t, { ...t, end_date: '2026-12-31' })).toBe(true);
	});
});

describe('rescheduleRecurringExpense', () => {
	type Charge = { id: string; expense_date: string; receipt: string; created: string; updated: string; recurring: string };

	/** Fake PocketBase holding one schedule and its charges, enforcing the (recurring, date) unique index. */
	function store(s: RecurringExpense, charges: Partial<Charge>[]) {
		let n = 0;
		const rows: Charge[] = charges.map((c) => ({
			id: `c${n++}`, receipt: '', created: 't0', updated: 't0', recurring: s.id, expense_date: '', ...c
		}));
		const pb = {
			filter: (q: string) => q,
			collection: (name: string) =>
				name === 'recurring_expenses'
					? {
							getOne: async () => s,
							update: async (_id: string, data: Partial<RecurringExpense>) => Object.assign(s, data)
						}
					: {
							getFullList: async () => rows.map((r) => ({ ...r })),
							delete: async (id: string) => {
								rows.splice(rows.findIndex((r) => r.id === id), 1);
							},
							create: async (data: { expense_date: string; recurring: string }) => {
								if (rows.some((r) => r.recurring === data.recurring && r.expense_date.slice(0, 10) === data.expense_date)) throw uniqueError();
								rows.push({ id: `c${n++}`, receipt: '', created: 'new', updated: 'new', ...data });
							}
						}
		} as unknown as PocketBase;
		const dates = () => rows.map((r) => r.expense_date.slice(0, 10)).sort();
		return { pb, rows, dates };
	}

	it('fills in the months before an earlier start date', async () => {
		// Created starting Oct 15, then corrected to Jul 15
		const s = schedule({ start_date: '2026-07-15', last_generated: '2026-10-15' });
		const { pb, dates } = store(s, [{ expense_date: '2026-10-15 00:00:00.000Z' }]);
		const result = await rescheduleRecurringExpense(pb, s.id, '2026-10-20');
		expect(result).toEqual({ created: 3, errors: [], removed: 0, keptOffSchedule: 0 });
		expect(dates()).toEqual(['2026-07-15', '2026-08-15', '2026-09-15', '2026-10-15']);
		expect(s.last_generated).toBe('2026-10-15');
	});

	it('moves untouched charges when the day of month changes', async () => {
		const s = schedule({ start_date: '2026-09-01' });
		const { pb, dates } = store(s, [{ expense_date: '2026-10-15' }]);
		const result = await rescheduleRecurringExpense(pb, s.id, '2026-10-20');
		expect(result).toMatchObject({ created: 2, removed: 1, keptOffSchedule: 0 });
		expect(dates()).toEqual(['2026-09-01', '2026-10-01']);
	});

	it('keeps charges that were edited or have a receipt', async () => {
		const s = schedule({ start_date: '2026-10-01' });
		const { pb, dates } = store(s, [
			{ expense_date: '2026-09-15', updated: 't1' },
			{ expense_date: '2026-10-15', receipt: 'bill.pdf' }
		]);
		const result = await rescheduleRecurringExpense(pb, s.id, '2026-10-20');
		expect(result).toMatchObject({ created: 1, removed: 0, keptOffSchedule: 2 });
		expect(dates()).toEqual(['2026-09-15', '2026-10-01', '2026-10-15']);
	});

	it('removes untouched charges past a new end date', async () => {
		const s = schedule({ start_date: '2026-08-15', end_date: '2026-09-30' });
		const { pb, dates } = store(s, [{ expense_date: '2026-08-15' }, { expense_date: '2026-09-15' }, { expense_date: '2026-10-15' }]);
		const result = await rescheduleRecurringExpense(pb, s.id, '2026-10-20');
		expect(result).toMatchObject({ created: 0, removed: 1 });
		expect(dates()).toEqual(['2026-08-15', '2026-09-15']);
	});
});

