import { describe, it, expect } from 'vitest';
import {
	GST_FREQUENCIES,
	isGstFrequency,
	gstPeriods,
	periodKeyForDate,
	parsePeriodKey,
	isPeriodKey,
	periodYear,
	periodLabel,
	incomeTaxDates
} from '../gst-periods.js';

describe('isGstFrequency', () => {
	it('accepts the three CRA filing frequencies', () => {
		for (const f of GST_FREQUENCIES) expect(isGstFrequency(f.value)).toBe(true);
		expect(isGstFrequency('weekly')).toBe(false);
		expect(isGstFrequency('')).toBe(false);
	});
});

describe('gstPeriods', () => {
	it('annual: pay by April 30 and file by June 15 of the next year', () => {
		expect(gstPeriods(2026, 'annual')).toEqual([
			{ key: '2026', label: '2026 (annual)', start: '2026-01-01', end: '2026-12-31', paymentDue: '2027-04-30', filingDue: '2027-06-15' }
		]);
	});

	it('quarterly: due one month after the quarter ends', () => {
		const q = gstPeriods(2026, 'quarterly');
		expect(q.map((p) => p.key)).toEqual(['2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4']);
		expect(q[0]).toMatchObject({ start: '2026-01-01', end: '2026-03-31', paymentDue: '2026-04-30', label: 'Q1 (Jan–Mar) 2026' });
		expect(q[3]).toMatchObject({ end: '2026-12-31', paymentDue: '2027-01-31', filingDue: '2027-01-31' });
	});

	it('monthly: twelve periods with correct month ends', () => {
		const m = gstPeriods(2028, 'monthly');
		expect(m).toHaveLength(12);
		expect(m[1]).toMatchObject({ key: '2028-02', end: '2028-02-29', paymentDue: '2028-03-31', label: 'February 2028' });
		expect(m[0].paymentDue).toBe('2028-02-29');
		expect(m[11].paymentDue).toBe('2029-01-31');
	});
});

describe('periodKeyForDate', () => {
	it('maps a date to its period for each frequency', () => {
		expect(periodKeyForDate('2026-08-20', 'annual')).toBe('2026');
		expect(periodKeyForDate('2026-08-20', 'quarterly')).toBe('2026-Q3');
		expect(periodKeyForDate('2026-08-20 00:00:00.000Z', 'monthly')).toBe('2026-08');
		expect(periodKeyForDate('2026-12-31', 'quarterly')).toBe('2026-Q4');
	});
});

describe('parsePeriodKey / isPeriodKey / periodYear / periodLabel', () => {
	it('round-trips every period key', () => {
		for (const f of GST_FREQUENCIES) {
			for (const p of gstPeriods(2026, f.value)) expect(parsePeriodKey(p.key)).toEqual(p);
		}
	});

	it('rejects malformed keys', () => {
		for (const bad of ['', '26', '2026-Q5', '2026-13', '2026-00', '2026-q1', 'abcd']) {
			expect(parsePeriodKey(bad)).toBeNull();
			expect(isPeriodKey(bad)).toBe(false);
		}
	});

	it('reads the year from a key', () => {
		expect(periodYear('2025')).toBe(2025);
		expect(periodYear('2025-Q4')).toBe(2025);
		expect(periodYear('')).toBeNaN();
	});

	it('labels keys and falls back to the raw value', () => {
		expect(periodLabel('2026-Q2')).toBe('Q2 (Apr–Jun) 2026');
		expect(periodLabel('2026-07')).toBe('July 2026');
		expect(periodLabel('legacy')).toBe('legacy');
	});
});

describe('incomeTaxDates', () => {
	it('returns instalment, balance and filing dates', () => {
		expect(incomeTaxDates(2026)).toEqual({
			instalments: ['2026-03-15', '2026-06-15', '2026-09-15', '2026-12-15'],
			balanceDue: '2027-04-30',
			filingDue: '2027-06-15'
		});
	});
});
