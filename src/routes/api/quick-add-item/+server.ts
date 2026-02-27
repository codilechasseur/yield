import { json } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import { getSmtpSettings } from '$lib/mail.server.js';

interface QuickAddBody {
	/** ID of an existing draft invoice to append the item to. */
	invoice_id?: string;
	/** Client ID to create a new draft invoice for (used when invoice_id is absent). */
	client_id?: string;
	description: string;
	quantity: number;
	unit_price: number;
}

/**
 * POST /api/quick-add-item
 *
 * Adds a line item to an existing draft invoice, or first creates a new draft
 * invoice for a given client and then appends the item.
 *
 * Body (JSON):
 *   { invoice_id, description, quantity, unit_price }  — append to existing invoice
 *   { client_id, description, quantity, unit_price }   — create new invoice then append
 */
export async function POST({ request }) {
	const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');

	let body: QuickAddBody;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}

	const { invoice_id, client_id, description, quantity, unit_price } = body;

	if (!description?.trim()) {
		return json({ error: 'Description is required' }, { status: 400 });
	}
	if (!invoice_id && !client_id) {
		return json({ error: 'Either invoice_id or client_id is required' }, { status: 400 });
	}

	let targetInvoiceId = invoice_id;

	// ── Create a new draft invoice if no invoice_id was supplied ──────────────
	if (!targetInvoiceId && client_id) {
		try {
			const settings = await getSmtpSettings(pb).catch(() => null);
			const format = settings?.invoice_number_format?.trim() || 'INV-{number}';
			const nextNum = settings?.invoice_next_number ?? null;
			const today = new Date().toISOString().split('T')[0];

			let number: string;
			if (nextNum !== null && nextNum > 0) {
				number = format.replace('{number}', String(nextNum));
			} else {
				// Use a millisecond-resolution timestamp suffix to avoid collisions
				// when no sequential counter is configured (e.g. clean test database).
				const suffix = Date.now().toString().slice(-6);
				number = `INV-${today.replace(/-/g, '')}-${suffix}`;
			}

			const dueDate = new Date(Date.now() + 30 * 86_400_000).toISOString().split('T')[0];
			const invoice = await pb.collection('invoices').create({
				client: client_id,
				number,
				issue_date: today,
				due_date: dueDate,
				payment_terms: 'net_30',
				status: 'draft',
				tax_percent: settings?.default_tax_percent ?? 0,
				notes: ''
			});
			targetInvoiceId = invoice.id;

			// Auto-increment the next invoice number in settings
			if (settings?.id && settings.invoice_next_number) {
				const expectedNumber = format.replace('{number}', String(settings.invoice_next_number));
				if (number === expectedNumber) {
					await pb
						.collection('settings')
						.update(settings.id, { invoice_next_number: settings.invoice_next_number + 1 })
						.catch(() => { /* non-critical */ });
				}
			}

			await pb.collection('invoice_logs').create({
				invoice: targetInvoiceId,
				action: 'invoice_created',
				detail: 'Invoice created via Quick Add Item',
				occurred_at: new Date().toISOString()
			}).catch(() => { /* non-critical */ });
		} catch {
			return json({ error: 'Failed to create invoice' }, { status: 500 });
		}
	}

	// ── Append the line item ──────────────────────────────────────────────────
	try {
		const item = await pb.collection('invoice_items').create({
			invoice: targetInvoiceId,
			description: description.trim(),
			quantity: Number(quantity) || 1,
			unit_price: Number(unit_price) || 0
		});
		return json({ success: true, invoice_id: targetInvoiceId, item_id: item.id }, { status: 201 });
	} catch {
		return json({ error: 'Failed to add line item' }, { status: 500 });
	}
}
