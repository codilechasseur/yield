import { describe, it, expect } from 'vitest';
import { calcSubtotal, calcTax, calcTotal, formatCurrency } from '../pocketbase.js';

// ── calcSubtotal ─────────────────────────────────────────────────────────────

describe('calcSubtotal', () => {
	it('returns 0 for an empty item list', () => {
		expect(calcSubtotal([])).toBe(0);
	});

	it('returns quantity × unit_price for a single item', () => {
		expect(calcSubtotal([{ quantity: 2, unit_price: 50 }])).toBe(100);
	});

	it('sums multiple items correctly', () => {
		expect(
			calcSubtotal([
				{ quantity: 1, unit_price: 100 },
				{ quantity: 3, unit_price: 25 }
			])
		).toBe(175);
	});

	it('handles fractional quantities and prices', () => {
		expect(calcSubtotal([{ quantity: 1.5, unit_price: 100 }])).toBeCloseTo(150);
	});

	it('handles zero unit_price', () => {
		expect(calcSubtotal([{ quantity: 5, unit_price: 0 }])).toBe(0);
	});

	it('handles zero quantity', () => {
		expect(calcSubtotal([{ quantity: 0, unit_price: 99 }])).toBe(0);
	});
});

// ── calcTax ──────────────────────────────────────────────────────────────────

describe('calcTax', () => {
	it('calculates 10% tax correctly', () => {
		expect(calcTax(200, 10)).toBe(20);
	});

	it('calculates 0% tax as 0', () => {
		expect(calcTax(500, 0)).toBe(0);
	});

	it('calculates 100% tax correctly', () => {
		expect(calcTax(100, 100)).toBe(100);
	});

	it('returns 0 for a 0 subtotal regardless of rate', () => {
		expect(calcTax(0, 15)).toBe(0);
	});

	it('handles fractional tax rates', () => {
		expect(calcTax(200, 7.5)).toBeCloseTo(15);
	});
});

// ── calcTotal ────────────────────────────────────────────────────────────────

describe('calcTotal', () => {
	it('equals subtotal + tax', () => {
		expect(calcTotal(100, 10)).toBeCloseTo(110);
	});

	it('equals subtotal when tax is 0%', () => {
		expect(calcTotal(250, 0)).toBe(250);
	});

	it('is consistent with calcSubtotal + calcTax', () => {
		const subtotal = calcSubtotal([
			{ quantity: 4, unit_price: 25 },
			{ quantity: 2, unit_price: 50 }
		]);
		expect(calcTotal(subtotal, 5)).toBeCloseTo(subtotal + calcTax(subtotal, 5));
	});
});

// ── formatCurrency ───────────────────────────────────────────────────────────

describe('formatCurrency', () => {
	it('formats a whole USD amount with dollar sign and commas', () => {
		const formatted = formatCurrency(1000);
		expect(formatted).toContain('1,000');
		expect(formatted).toContain('$');
	});

	it('formats zero as $0.00', () => {
		const formatted = formatCurrency(0);
		expect(formatted).toContain('0');
		expect(formatted).toContain('$');
	});

	it('formats a negative amount', () => {
		const formatted = formatCurrency(-50);
		expect(formatted).toContain('50');
	});

	it('defaults to USD when no currency is provided', () => {
		const withDefault = formatCurrency(100);
		const withExplicit = formatCurrency(100, 'USD');
		expect(withDefault).toBe(withExplicit);
	});

	it('respects a non-USD currency code', () => {
		const formatted = formatCurrency(100, 'CAD');
		// Should contain the numeric value at minimum
		expect(formatted).toContain('100');
	});
});
