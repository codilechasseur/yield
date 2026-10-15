import { describe, it, expect, vi, afterEach } from 'vitest';
import type PocketBase from 'pocketbase';
import {
	todayIso,
	isUniqueViolation,
	generateRecurringExpenses,
	generateForRecurringExpense
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
