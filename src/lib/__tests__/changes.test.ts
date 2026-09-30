import { describe, it, expect } from 'vitest';
import { changedFields, lineItemsChanged, describeChanges, FIELD_LABELS } from '../changes.js';

describe('changedFields', () => {
	it('returns [] when nothing differs', () => {
		expect(changedFields({ number: 'INV-1', notes: 'hi' }, { number: 'INV-1', notes: 'hi' })).toEqual([]);
	});

	it('returns the keys that differ, in submitted order', () => {
		expect(
			changedFields(
				{ number: 'INV-1', subject: 'a', status: 'draft' },
				{ status: 'sent', number: 'INV-1', subject: 'b' }
			)
		).toEqual(['status', 'subject']);
	});

	it('compares date fields by their YYYY-MM-DD part', () => {
		const current = { issue_date: '2026-09-30 00:00:00.000Z', due_date: '2026-10-30 00:00:00.000Z' };
		expect(changedFields(current, { issue_date: '2026-09-30', due_date: '2026-10-30' }, ['issue_date', 'due_date'])).toEqual([]);
		expect(changedFields(current, { issue_date: '2026-09-30', due_date: '2026-10-31' }, ['issue_date', 'due_date'])).toEqual(['due_date']);
	});

	it('does not truncate non-date fields', () => {
		expect(changedFields({ notes: '2026-09-30 extra' }, { notes: '2026-09-30' })).toEqual(['notes']);
	});

	it('compares numbers numerically', () => {
		expect(changedFields({ tax_percent: 5 }, { tax_percent: 5.0 })).toEqual([]);
		expect(changedFields({ tax_percent: 5 }, { tax_percent: '5' })).toEqual([]);
		expect(changedFields({ tax_percent: 5 }, { tax_percent: 7.5 })).toEqual(['tax_percent']);
	});

	it('treats null, undefined and empty string as equal', () => {
		expect(changedFields({ subject: null, notes: undefined }, { subject: '', notes: '' })).toEqual([]);
		expect(changedFields({}, { subject: '' })).toEqual([]);
	});

	it('ignores surrounding whitespace', () => {
		expect(changedFields({ subject: 'Retainer' }, { subject: '  Retainer ' })).toEqual([]);
	});

	it('detects a value being cleared', () => {
		expect(changedFields({ subject: 'Retainer' }, { subject: '' })).toEqual(['subject']);
	});
});

describe('lineItemsChanged', () => {
	const items = [
		{ description: 'Design', quantity: 2, unit_price: 100 },
		{ description: 'Build', quantity: 1, unit_price: 500 }
	];

	it('returns false for identical items', () => {
		expect(lineItemsChanged(items, items.map((i) => ({ ...i })))).toBe(false);
	});

	it('returns false for two empty lists', () => {
		expect(lineItemsChanged([], [])).toBe(false);
	});

	it('detects added and removed items', () => {
		expect(lineItemsChanged(items, items.slice(0, 1))).toBe(true);
		expect(lineItemsChanged([], items)).toBe(true);
	});

	it('detects a changed description, quantity or price', () => {
		expect(lineItemsChanged(items, [{ ...items[0], description: 'Design!' }, items[1]])).toBe(true);
		expect(lineItemsChanged(items, [{ ...items[0], quantity: 3 }, items[1]])).toBe(true);
		expect(lineItemsChanged(items, [{ ...items[0], unit_price: 99.99 }, items[1]])).toBe(true);
	});

	it('detects reordering', () => {
		expect(lineItemsChanged(items, [items[1], items[0]])).toBe(true);
	});
});

describe('describeChanges', () => {
	it('returns an empty string for no changes', () => {
		expect(describeChanges([])).toBe('');
	});

	it('formats one, two and many changes', () => {
		expect(describeChanges(['notes'])).toBe('Updated notes');
		expect(describeChanges(['notes', 'line items'])).toBe('Updated notes and line items');
		expect(describeChanges(['due date', 'notes', 'line items'])).toBe('Updated due date, notes and line items');
	});
});

describe('FIELD_LABELS', () => {
	it('labels every editable header field', () => {
		for (const key of ['client', 'number', 'subject', 'issue_date', 'due_date', 'expiry_date', 'payment_terms', 'status', 'tax_percent', 'notes']) {
			expect(FIELD_LABELS[key]).toBeTruthy();
		}
	});
});
