import { describe, it, expect } from 'vitest';
import { toRecentInvoice, hasOnlyBlankItems } from '../recent-invoices.js';
import type { Invoice, InvoiceItem } from '../types.js';

function invoice(overrides: Partial<Invoice> = {}): Invoice {
	return {
		id: 'inv1',
		client: 'c1',
		number: 'INV-0042',
		subject: 'Retainer — September 2026',
		issue_date: '2026-09-30 00:00:00.000Z',
		due_date: '2026-10-30 00:00:00.000Z',
		payment_terms: 'net_30',
		status: 'paid',
		tax_percent: 5,
		paid_amount: 0,
		notes: 'Thanks!',
		created: '2026-09-30 10:00:00.000Z',
		updated: '2026-09-30 10:00:00.000Z',
		...overrides
	};
}

function item(overrides: Partial<InvoiceItem> = {}): InvoiceItem {
	return {
		id: 'it1',
		invoice: 'inv1',
		description: 'Development',
		quantity: 1,
		unit_price: 100,
		created: '2026-09-30 10:00:00.000Z',
		updated: '2026-09-30 10:00:00.000Z',
		...overrides
	};
}

// ── toRecentInvoice ──────────────────────────────────────────────────────────

describe('toRecentInvoice', () => {
	it('keeps the identifying fields', () => {
		const r = toRecentInvoice(invoice(), []);
		expect(r).toMatchObject({
			id: 'inv1',
			number: 'INV-0042',
			subject: 'Retainer — September 2026',
			issue_date: '2026-09-30 00:00:00.000Z',
			status: 'paid'
		});
	});

	it('drops fields the form does not need', () => {
		const r = toRecentInvoice({ ...invoice(), expand: { client: undefined } }, [item()]);
		expect(r).not.toHaveProperty('notes');
		expect(r).not.toHaveProperty('expand');
		expect(r.items[0]).toEqual({ description: 'Development', quantity: 1, unit_price: 100 });
	});

	it('computes the total including tax', () => {
		const r = toRecentInvoice(invoice({ tax_percent: 5 }), [
			item({ quantity: 10, unit_price: 120 }),
			item({ id: 'it2', quantity: 2, unit_price: 50 })
		]);
		expect(r.total).toBeCloseTo(1365);
	});

	it('treats a missing tax_percent as zero', () => {
		const r = toRecentInvoice(invoice({ tax_percent: undefined as unknown as number }), [item({ unit_price: 80 })]);
		expect(r.total).toBe(80);
	});

	it('returns a zero total and no items for an invoice without line items', () => {
		const r = toRecentInvoice(invoice(), []);
		expect(r.total).toBe(0);
		expect(r.items).toEqual([]);
	});

	it('defaults a missing subject to an empty string', () => {
		expect(toRecentInvoice(invoice({ subject: undefined }), []).subject).toBe('');
	});

	it('orders line items by creation time', () => {
		const r = toRecentInvoice(invoice(), [
			item({ id: 'b', description: 'Second', created: '2026-09-30 10:00:02.000Z' }),
			item({ id: 'a', description: 'First', created: '2026-09-30 10:00:01.000Z' })
		]);
		expect(r.items.map((i) => i.description)).toEqual(['First', 'Second']);
	});

	it('does not reorder the caller’s array', () => {
		const items = [
			item({ id: 'b', created: '2026-09-30 10:00:02.000Z' }),
			item({ id: 'a', created: '2026-09-30 10:00:01.000Z' })
		];
		toRecentInvoice(invoice(), items);
		expect(items.map((i) => i.id)).toEqual(['b', 'a']);
	});
});

// ── hasOnlyBlankItems ────────────────────────────────────────────────────────

describe('hasOnlyBlankItems', () => {
	it('is true for an empty list', () => {
		expect(hasOnlyBlankItems([])).toBe(true);
	});

	it('is true for the blank starting row', () => {
		expect(hasOnlyBlankItems([{ description: '' }])).toBe(true);
	});

	it('treats whitespace and empty rich-text markup as blank', () => {
		expect(hasOnlyBlankItems([{ description: '   ' }, { description: '<p><br></p>' }])).toBe(true);
	});

	it('is false once any row has a description', () => {
		expect(hasOnlyBlankItems([{ description: '' }, { description: 'Design work' }])).toBe(false);
	});

	it('is false for rich-text descriptions with content', () => {
		expect(hasOnlyBlankItems([{ description: '<ul><li>Gallery</li></ul>' }])).toBe(false);
	});
});
