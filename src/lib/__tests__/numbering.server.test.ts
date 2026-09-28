import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	numberFormat,
	formatDocNumber,
	parseDocNumber,
	pickNextNumber,
	suggestNextNumber,
	advanceCounter,
	isNumberTaken,
	createWithAutoNumber
} from '../numbering.server.js';
import type { SmtpSettings } from '../mail.server.js';

const settings = (overrides: Partial<SmtpSettings> = {}) => ({ id: 'sett1', ...overrides }) as SmtpSettings;

/** Minimal PocketBase stand-in: `numbers` are the existing records, updates are recorded. */
function fakePb(numbers: string[], opts: { failList?: boolean } = {}) {
	const updates: { id: string; data: Record<string, unknown> }[] = [];
	const pb = {
		collection: () => ({
			getFullList: async () => {
				if (opts.failList) throw new Error('db down');
				return numbers.map((number) => ({ number }));
			},
			update: async (id: string, data: Record<string, unknown>) => {
				updates.push({ id, data });
				return {};
			}
		})
	} as unknown as import('pocketbase').default;
	return { pb, updates };
}

afterEach(() => vi.restoreAllMocks());

// ── numberFormat ─────────────────────────────────────────────────────────────

describe('numberFormat', () => {
	it('uses the configured format', () => {
		expect(numberFormat('invoice', settings({ invoice_number_format: '{number}' }))).toBe('{number}');
		expect(numberFormat('estimate', settings({ estimate_number_format: 'Q-{number}' }))).toBe('Q-{number}');
	});

	it('defaults per kind when unset, blank or settings are missing', () => {
		expect(numberFormat('invoice', null)).toBe('INV-{number}');
		expect(numberFormat('invoice', settings({ invoice_number_format: '   ' }))).toBe('INV-{number}');
		expect(numberFormat('estimate', undefined)).toBe('EST-{number}');
	});
});

// ── formatDocNumber / parseDocNumber ─────────────────────────────────────────

describe('formatDocNumber', () => {
	it('substitutes the counter', () => {
		expect(formatDocNumber('INV-{number}', 7)).toBe('INV-7');
		expect(formatDocNumber('{number}', 654)).toBe('654');
	});
});

describe('parseDocNumber', () => {
	it('extracts the counter from a matching value', () => {
		expect(parseDocNumber('INV-{number}', 'INV-42')).toBe(42);
		expect(parseDocNumber('{number}', '654')).toBe(654);
		expect(parseDocNumber('{number}/2026', '12/2026')).toBe(12);
	});

	it('treats regex characters in the format literally', () => {
		expect(parseDocNumber('A.{number}', 'A.5')).toBe(5);
		expect(parseDocNumber('A.{number}', 'AX5')).toBeNull();
	});

	it('returns null for non-matching values', () => {
		expect(parseDocNumber('{number}', 'INV-654')).toBeNull();
		expect(parseDocNumber('INV-{number}', 'INV-20260928-001')).toBeNull();
		expect(parseDocNumber('INV-{number}', '')).toBeNull();
	});

	it('returns null when the format has no placeholder', () => {
		expect(parseDocNumber('INVOICE', 'INVOICE')).toBeNull();
	});
});

// ── pickNextNumber ───────────────────────────────────────────────────────────

describe('pickNextNumber', () => {
	const base = { format: '{number}', prefix: 'INV', today: '2026-09-28' };

	it('returns the counter value when it is free', () => {
		expect(pickNextNumber(new Set(), { ...base, nextNum: 654 })).toBe('654');
	});

	it('skips numbers that are already taken', () => {
		expect(pickNextNumber(new Set(['654', '655']), { ...base, nextNum: 654 })).toBe('656');
	});

	it('falls back to a date-based number when no counter is configured', () => {
		for (const nextNum of [0, null, undefined]) {
			expect(pickNextNumber(new Set(), { ...base, nextNum })).toBe('INV-20260928-001');
		}
	});

	it('picks the next free date-based suffix', () => {
		const taken = new Set(['INV-20260928-001', 'INV-20260928-002']);
		expect(pickNextNumber(taken, { ...base, nextNum: 0 })).toBe('INV-20260928-003');
	});

	it('falls back to date-based when the format has no placeholder', () => {
		expect(pickNextNumber(new Set(), { ...base, format: 'INVOICE', nextNum: 5 })).toBe('INV-20260928-001');
	});
});

// ── suggestNextNumber ────────────────────────────────────────────────────────

describe('suggestNextNumber', () => {
	it('skips existing records', async () => {
		const { pb } = fakePb(['INV-1', 'INV-2']);
		expect(await suggestNextNumber(pb, 'invoice', settings({ invoice_next_number: 1 }))).toBe('INV-3');
	});

	it('uses the estimate format and counter for estimates', async () => {
		const { pb } = fakePb([]);
		const s = settings({ estimate_number_format: 'Q-{number}', estimate_next_number: 9 });
		expect(await suggestNextNumber(pb, 'estimate', s)).toBe('Q-9');
	});

	it('uses today for the date-based fallback', async () => {
		vi.spyOn(Date, 'now').mockReturnValue(new Date('2031-01-15T12:00:00Z').getTime());
		const { pb } = fakePb(['EST-20310115-001']);
		expect(await suggestNextNumber(pb, 'estimate', null)).toBe('EST-20310115-002');
	});

	it('still suggests a number when the lookup fails', async () => {
		const { pb } = fakePb([], { failList: true });
		expect(await suggestNextNumber(pb, 'invoice', settings({ invoice_next_number: 5 }))).toBe('INV-5');
	});
});

// ── advanceCounter ───────────────────────────────────────────────────────────

describe('advanceCounter', () => {
	it('moves the counter past the used number', async () => {
		const { pb, updates } = fakePb([]);
		await advanceCounter(pb, 'invoice', settings({ invoice_next_number: 654 }), 'INV-654');
		expect(updates).toEqual([{ id: 'sett1', data: { invoice_next_number: 655 } }]);
	});

	it('jumps past a number beyond the counter (e.g. after skipping taken ones)', async () => {
		const { pb, updates } = fakePb([]);
		await advanceCounter(pb, 'invoice', settings({ invoice_next_number: 654 }), 'INV-700');
		expect(updates[0].data).toEqual({ invoice_next_number: 701 });
	});

	it('uses the highest of several numbers', async () => {
		const { pb, updates } = fakePb([]);
		const s = settings({ invoice_number_format: '{number}', invoice_next_number: 1 });
		await advanceCounter(pb, 'invoice', s, ['12', '653', 'not-a-number', '40']);
		expect(updates[0].data).toEqual({ invoice_next_number: 654 });
	});

	it('updates the estimate counter for estimates', async () => {
		const { pb, updates } = fakePb([]);
		await advanceCounter(pb, 'estimate', settings({ estimate_next_number: 3 }), 'EST-3');
		expect(updates[0].data).toEqual({ estimate_next_number: 4 });
	});

	it('does nothing for numbers below the counter', async () => {
		const { pb, updates } = fakePb([]);
		await advanceCounter(pb, 'invoice', settings({ invoice_next_number: 654 }), 'INV-10');
		expect(updates).toEqual([]);
	});

	it('does nothing for numbers that do not match the format', async () => {
		const { pb, updates } = fakePb([]);
		await advanceCounter(pb, 'invoice', settings({ invoice_next_number: 654 }), '999');
		expect(updates).toEqual([]);
	});

	it('does nothing when no counter is configured or settings are missing', async () => {
		const { pb, updates } = fakePb([]);
		await advanceCounter(pb, 'invoice', settings({ invoice_next_number: 0 }), 'INV-5');
		await advanceCounter(pb, 'invoice', null, 'INV-5');
		await advanceCounter(pb, 'invoice', { invoice_next_number: 5 } as SmtpSettings, 'INV-5');
		expect(updates).toEqual([]);
	});

	it('does nothing for an empty list', async () => {
		const { pb, updates } = fakePb([]);
		await advanceCounter(pb, 'invoice', settings({ invoice_next_number: 1 }), []);
		expect(updates).toEqual([]);
	});
});

// ── isNumberTaken / createWithAutoNumber ─────────────────────────────────────

const takenError = () =>
	Object.assign(new Error('Failed to create record.'), {
		response: { data: { number: { code: 'validation_not_unique', message: 'Value must be unique.' } } }
	});

describe('isNumberTaken', () => {
	it('detects a unique-index clash on number', () => {
		expect(isNumberTaken(takenError())).toBe(true);
	});

	it('ignores other errors', () => {
		const other = Object.assign(new Error('x'), { response: { data: { client: { code: 'validation_required' } } } });
		expect(isNumberTaken(other)).toBe(false);
		expect(isNumberTaken(new Error('boom'))).toBe(false);
		expect(isNumberTaken(null)).toBe(false);
		expect(isNumberTaken(undefined)).toBe(false);
	});
});

describe('createWithAutoNumber', () => {
	const s = settings({ invoice_next_number: 1 });

	it('creates with the given number when it is free', async () => {
		const { pb } = fakePb([]);
		const create = vi.fn(async (n: string) => ({ id: 'r1', n }));
		const result = await createWithAutoNumber(pb, 'invoice', s, 'INV-1', create);
		expect(result).toEqual({ record: { id: 'r1', n: 'INV-1' }, number: 'INV-1' });
		expect(create).toHaveBeenCalledOnce();
	});

	it('retries with the next free number when the number was taken meanwhile', async () => {
		// INV-1 was taken by someone else between suggestion and save
		const { pb } = fakePb(['INV-1']);
		const create = vi.fn(async (n: string) => {
			if (n === 'INV-1') throw takenError();
			return { id: 'r2' };
		});
		const result = await createWithAutoNumber(pb, 'invoice', s, 'INV-1', create);
		expect(result.number).toBe('INV-2');
		expect(create.mock.calls.map((c) => c[0])).toEqual(['INV-1', 'INV-2']);
	});

	it('rethrows errors that are not number clashes without retrying', async () => {
		const { pb } = fakePb([]);
		const create = vi.fn(async () => { throw new Error('db down'); });
		await expect(createWithAutoNumber(pb, 'invoice', s, 'INV-1', create)).rejects.toThrow('db down');
		expect(create).toHaveBeenCalledOnce();
	});

	it('gives up after maxAttempts', async () => {
		const { pb } = fakePb([]);
		const create = vi.fn(async () => { throw takenError(); });
		await expect(createWithAutoNumber(pb, 'invoice', s, 'INV-1', create, 3)).rejects.toThrow();
		expect(create).toHaveBeenCalledTimes(3);
	});
});
