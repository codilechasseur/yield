import { json } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import { getSmtpSettings } from '$lib/mail.server.js';
import { suggestNextNumber, advanceCounter, createWithAutoNumber } from '$lib/numbering.server.js';
import { pbErrorMessage } from '$lib/pocketbase.js';

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
			const today = new Date().toISOString().split('T')[0];

			const dueDate = new Date(Date.now() + 30 * 86_400_000).toISOString().split('T')[0];
			const { record: invoice, number } = await createWithAutoNumber(
				pb, 'invoice', settings, await suggestNextNumber(pb, 'invoice', settings),
				(n) => pb.collection('invoices').create({
					client: client_id,
					number: n,
					issue_date: today,
					due_date: dueDate,
					payment_terms: 'net_30',
					status: 'draft',
					tax_percent: settings?.default_tax_percent ?? 0,
					notes: ''
				})
			);
			targetInvoiceId = invoice.id;

			await advanceCounter(pb, 'invoice', settings, number);

			await pb.collection('invoice_logs').create({
				invoice: targetInvoiceId,
				action: 'invoice_created',
				detail: 'Invoice created via Quick Add Item',
				occurred_at: new Date().toISOString()
			}).catch(() => { /* non-critical */ });
		} catch (e: unknown) {
			return json({ error: pbErrorMessage(e, 'Failed to create invoice') }, { status: 500 });
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
