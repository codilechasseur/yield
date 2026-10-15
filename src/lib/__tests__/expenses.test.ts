import { describe, it, expect } from 'vitest';
import {
	EXPENSE_CATEGORIES,
	isExpenseCategory,
	categoryInfo,
	businessUseFraction,
	claimableFraction,
	deductibleAmount,
	claimableItc,
	summarizeExpenses,
	parseBusinessUse
} from '../expenses.js';
import type { ExpenseCategory } from '../types.js';

const exp = (amount: number, gst_paid: number, category: ExpenseCategory | '' = 'software', business_use_percent = 100) => ({
	amount,
	gst_paid,
	category,
	business_use_percent
});

describe('EXPENSE_CATEGORIES', () => {
	it('has unique values and a T2125 line for each', () => {
		const values = EXPENSE_CATEGORIES.map((c) => c.value);
		expect(new Set(values).size).toBe(values.length);
		for (const c of EXPENSE_CATEGORIES) expect(c.t2125Line).toMatch(/^\d{4}$/);
	});

	it('only meals are partly deductible', () => {
		const partial = EXPENSE_CATEGORIES.filter((c) => c.deductibleShare < 1).map((c) => c.value);
		expect(partial).toEqual(['meals']);
	});
});

describe('isExpenseCategory / categoryInfo', () => {
	it('recognises known categories only', () => {
		expect(isExpenseCategory('meals')).toBe(true);
		expect(isExpenseCategory('equipment')).toBe(false);
		expect(isExpenseCategory('')).toBe(false);
		expect(isExpenseCategory(undefined)).toBe(false);
	});

	it('falls back to Other for empty or unknown values', () => {
		expect(categoryInfo('').value).toBe('other');
		expect(categoryInfo(null).value).toBe('other');
		expect(categoryInfo('nope').value).toBe('other');
		expect(categoryInfo('travel').label).toBe('Travel');
	});
});

describe('businessUseFraction', () => {
	it('treats missing or zero as fully business (older records)', () => {
		expect(businessUseFraction(undefined)).toBe(1);
		expect(businessUseFraction(null)).toBe(1);
		expect(businessUseFraction(0)).toBe(1);
		expect(businessUseFraction(-5)).toBe(1);
	});

	it('converts percentages and caps at 100', () => {
		expect(businessUseFraction(60)).toBe(0.6);
		expect(businessUseFraction(150)).toBe(1);
	});
});

describe('deductibleAmount / claimableItc', () => {
	it('is the full amount for a business-only expense', () => {
		expect(deductibleAmount(exp(100, 13))).toBe(100);
		expect(claimableItc(exp(100, 13))).toBe(13);
	});

	it('halves meals and entertainment', () => {
		expect(claimableFraction(exp(80, 10.4, 'meals'))).toBe(0.5);
		expect(deductibleAmount(exp(80, 10.4, 'meals'))).toBe(40);
		expect(claimableItc(exp(80, 10.4, 'meals'))).toBe(5.2);
	});

	it('applies the business-use share', () => {
		expect(deductibleAmount(exp(90, 11.7, 'telephone', 60))).toBe(54);
		expect(claimableItc(exp(90, 11.7, 'telephone', 60))).toBe(7.02);
	});

	it('combines business use with the meals rule', () => {
		expect(deductibleAmount(exp(100, 0, 'meals', 50))).toBe(25);
	});

	it('handles missing GST', () => {
		expect(claimableItc({ amount: 50, gst_paid: undefined as unknown as number, category: 'office', business_use_percent: 100 })).toBe(0);
	});
});

describe('summarizeExpenses', () => {
	it('returns zeros for no expenses', () => {
		expect(summarizeExpenses([])).toEqual({ count: 0, spent: 0, deductible: 0, gstPaid: 0, itc: 0, byCategory: [] });
	});

	it('totals and groups by category, largest deductible first', () => {
		const t = summarizeExpenses([
			exp(20, 2.6, 'software'),
			exp(30, 3.9, 'software'),
			exp(200, 26, 'meals'),
			exp(10, 0, '')
		]);
		expect(t.count).toBe(4);
		expect(t.spent).toBe(260);
		expect(t.deductible).toBe(160);
		expect(t.gstPaid).toBe(32.5);
		expect(t.itc).toBe(19.5);
		expect(t.byCategory.map((c) => [c.category, c.count, c.deductible])).toEqual([
			['meals', 1, 100],
			['software', 2, 50],
			['other', 1, 10]
		]);
	});

	it('avoids floating-point noise', () => {
		const t = summarizeExpenses([exp(0.1, 0, 'office'), exp(0.2, 0, 'office')]);
		expect(t.spent).toBe(0.3);
	});
});

describe('parseBusinessUse', () => {
	it('defaults blank to 100', () => {
		expect(parseBusinessUse('')).toBe(100);
		expect(parseBusinessUse(null)).toBe(100);
		expect(parseBusinessUse('  ')).toBe(100);
	});

	it('accepts 1–100', () => {
		expect(parseBusinessUse('1')).toBe(1);
		expect(parseBusinessUse('62.5')).toBe(62.5);
		expect(parseBusinessUse('100')).toBe(100);
	});

	it('rejects out-of-range or non-numeric input', () => {
		expect(parseBusinessUse('0')).toBeNull();
		expect(parseBusinessUse('101')).toBeNull();
		expect(parseBusinessUse('abc')).toBeNull();
	});
});
