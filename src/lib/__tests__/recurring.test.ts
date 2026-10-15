import { describe, it, expect } from 'vitest';
import {
	FREQUENCIES,
	MAX_OCCURRENCES,
	isFrequency,
	frequencyLabel,
	toIsoDate,
	addMonths,
	nthOccurrence,
	dueOccurrences,
	nextOccurrence,
	isActive,
	annualCost
} from '../recurring.js';
import type { RecurrenceFrequency } from '../types.js';

const schedule = (start_date: string, frequency: RecurrenceFrequency = 'monthly', extra: { end_date?: string; last_generated?: string } = {}) => ({
	start_date,
	frequency,
	end_date: extra.end_date ?? '',
	last_generated: extra.last_generated ?? ''
});

describe('isFrequency / frequencyLabel', () => {
	it('accepts known frequencies only', () => {
		for (const f of FREQUENCIES) expect(isFrequency(f.value)).toBe(true);
		expect(isFrequency('daily')).toBe(false);
		expect(isFrequency(undefined)).toBe(false);
	});

	it('labels frequencies', () => {
		expect(frequencyLabel('quarterly')).toBe('Every 3 months');
	});
});

describe('toIsoDate', () => {
	it('normalises PocketBase datetimes and ISO dates', () => {
		expect(toIsoDate('2026-01-15 00:00:00.000Z')).toBe('2026-01-15');
		expect(toIsoDate('2026-01-15')).toBe('2026-01-15');
	});

	it('returns empty for empty or invalid input', () => {
		expect(toIsoDate('')).toBe('');
		expect(toIsoDate(null)).toBe('');
		expect(toIsoDate(undefined)).toBe('');
		expect(toIsoDate('Jan 15')).toBe('');
	});
});

describe('addMonths', () => {
	it('keeps the day of month', () => {
		expect(addMonths('2026-01-15', 1)).toBe('2026-02-15');
	});

	it('clamps to the end of shorter months', () => {
		expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
		expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
		expect(addMonths('2026-03-31', 1)).toBe('2026-04-30');
	});

	it('rolls over years in both directions', () => {
		expect(addMonths('2026-11-30', 3)).toBe('2027-02-28');
		expect(addMonths('2026-01-10', -1)).toBe('2025-12-10');
	});
});

describe('nthOccurrence', () => {
	it('anchors monthly charges to the start date so they never drift', () => {
		expect(nthOccurrence('2026-01-31', 'monthly', 1)).toBe('2026-02-28');
		expect(nthOccurrence('2026-01-31', 'monthly', 2)).toBe('2026-03-31');
	});

	it('handles weekly, quarterly and yearly', () => {
		expect(nthOccurrence('2026-12-28', 'weekly', 1)).toBe('2027-01-04');
		expect(nthOccurrence('2026-01-15', 'quarterly', 3)).toBe('2026-10-15');
		expect(nthOccurrence('2028-02-29', 'yearly', 1)).toBe('2029-02-28');
		expect(nthOccurrence('2028-02-29', 'yearly', 4)).toBe('2032-02-29');
	});

	it('returns the start date for n = 0', () => {
		expect(nthOccurrence('2026-05-05', 'weekly', 0)).toBe('2026-05-05');
	});
});

describe('dueOccurrences', () => {
	it('fills in every charge from a past start date up to today', () => {
		const dates = dueOccurrences(schedule('2026-01-15'), '2026-10-15');
		expect(dates).toHaveLength(10);
		expect(dates[0]).toBe('2026-01-15');
		expect(dates.at(-1)).toBe('2026-10-15');
	});

	it('includes a charge due today', () => {
		expect(dueOccurrences(schedule('2026-10-15'), '2026-10-15')).toEqual(['2026-10-15']);
	});

	it('only returns charges after last_generated', () => {
		expect(dueOccurrences(schedule('2026-01-15', 'monthly', { last_generated: '2026-09-15' }), '2026-10-20')).toEqual(['2026-10-15']);
		expect(dueOccurrences(schedule('2026-01-15', 'monthly', { last_generated: '2026-10-15 00:00:00.000Z' }), '2026-10-20')).toEqual([]);
	});

	it('stops at the end date', () => {
		expect(dueOccurrences(schedule('2026-01-15', 'monthly', { end_date: '2026-03-20' }), '2026-10-15')).toEqual([
			'2026-01-15',
			'2026-02-15',
			'2026-03-15'
		]);
	});

	it('returns nothing for a future start or a missing start', () => {
		expect(dueOccurrences(schedule('2026-11-01'), '2026-10-15')).toEqual([]);
		expect(dueOccurrences(schedule(''), '2026-10-15')).toEqual([]);
	});

	it('caps the number of charges created at once', () => {
		expect(dueOccurrences(schedule('1900-01-01', 'weekly'), '2026-10-15')).toHaveLength(MAX_OCCURRENCES);
	});
});

describe('nextOccurrence / isActive', () => {
	it('is the first charge after today', () => {
		expect(nextOccurrence(schedule('2026-01-15'), '2026-10-15')).toBe('2026-11-15');
		expect(nextOccurrence(schedule('2026-01-15'), '2026-10-14')).toBe('2026-10-15');
	});

	it('is the start date when the schedule starts in the future', () => {
		expect(nextOccurrence(schedule('2026-12-01', 'yearly'), '2026-10-15')).toBe('2026-12-01');
	});

	it('skips charges already created ahead of today', () => {
		expect(nextOccurrence(schedule('2026-01-15', 'monthly', { last_generated: '2026-11-15' }), '2026-10-15')).toBe('2026-12-15');
	});

	it('is null once the end date has passed', () => {
		const s = schedule('2026-01-15', 'monthly', { end_date: '2026-10-31' });
		expect(nextOccurrence(s, '2026-10-15')).toBeNull();
		expect(isActive(s, '2026-10-15')).toBe(false);
		expect(isActive(schedule('2026-01-15'), '2026-10-15')).toBe(true);
	});

	it('is null without a start date', () => {
		expect(nextOccurrence(schedule(''), '2026-10-15')).toBeNull();
	});
});

describe('annualCost', () => {
	it('scales by charges per year', () => {
		expect(annualCost(20, 'monthly')).toBe(240);
		expect(annualCost(100, 'quarterly')).toBe(400);
		expect(annualCost(99.99, 'yearly')).toBe(99.99);
		expect(annualCost(10, 'weekly')).toBe(520);
	});

	it('is zero for a zero amount', () => {
		expect(annualCost(0, 'monthly')).toBe(0);
	});
});
