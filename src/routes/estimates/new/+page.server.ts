import { fail, redirect } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import type { Client } from '$lib/types.js';
import { getSmtpSettings } from '$lib/mail.server.js';
import { pbErrorMessage } from '$lib/pocketbase.js';
import { suggestNextNumber, advanceCounter, createWithAutoNumber } from '$lib/numbering.server.js';

export async function load({ url }) {
	const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
	const preselectedClient = url.searchParams.get('client') || '';

	const [clients, settings] = await Promise.all([
		pb.collection('clients').getFullList<Client>({ sort: 'name', filter: 'archived = false' }).catch(() => [] as Client[]),
		getSmtpSettings(pb).catch(() => null)
	]);

	const defaultTaxPercent = settings?.default_tax_percent ?? 5;

	const suggestedEstimateNumber = await suggestNextNumber(pb, 'estimate', settings);

	return { clients, preselectedClient, defaultTaxPercent, suggestedEstimateNumber };
}

export const actions = {
	default: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const data = await request.formData();

		const client = data.get('client')?.toString();
		const number = data.get('number')?.toString().trim();
		const subject = data.get('subject')?.toString().trim() ?? '';
		const issue_date = data.get('issue_date')?.toString();
		const expiry_date = data.get('expiry_date')?.toString();
		const status = data.get('status')?.toString() || 'draft';
		const tax_percent = parseFloat(data.get('tax_percent')?.toString() || '0');
		const notes = data.get('notes')?.toString() || '';

		if (!client) return fail(400, { error: 'Client is required' });
		if (!number) return fail(400, { error: 'Estimate number is required' });

		const itemsJson = data.get('items')?.toString() || '[]';
		let items: { description: string; quantity: number; unit_price: number }[] = [];
		try {
			items = JSON.parse(itemsJson);
		} catch {
			return fail(400, { error: 'Invalid line items' });
		}

		let estimateId: string;
		try {
			const settingsRecord = await getSmtpSettings(pb).catch(() => null);

			const fields = { client, subject, issue_date, expiry_date, status, tax_percent, notes };
			const createEstimate = (n: string) => pb.collection('estimates').create({ ...fields, number: n });
			// An accepted suggestion may have been taken since the form loaded — take
			// the next free one. A number the user typed is used as-is.
			const { record: estimate, number: usedNumber } =
				number === data.get('suggested_number')?.toString()
					? await createWithAutoNumber(pb, 'estimate', settingsRecord, number, createEstimate)
					: { record: await createEstimate(number), number };
			estimateId = estimate.id;

			for (const item of items) {
				await pb.collection('estimate_items').create({
					estimate: estimate.id,
					description: item.description,
					quantity: item.quantity,
					unit_price: item.unit_price
				});
			}

			await pb.collection('estimate_logs').create({
				estimate: estimate.id,
				action: 'estimate_created',
				detail: 'Estimate created',
				occurred_at: new Date().toISOString()
			}).catch(() => { /* non-critical */ });

			await advanceCounter(pb, 'estimate', settingsRecord, usedNumber);
		} catch (e: unknown) {
			return fail(500, { error: pbErrorMessage(e, 'Failed to create estimate') });
		}

		return redirect(302, `/estimates/${estimateId}`);
	}
};
