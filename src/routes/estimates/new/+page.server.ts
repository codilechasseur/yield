import { fail, redirect } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import type { Client } from '$lib/types.js';
import { getSmtpSettings } from '$lib/mail.server.js';

export async function load({ url }) {
	const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
	const preselectedClient = url.searchParams.get('client') || '';

	const [clients, settings] = await Promise.all([
		pb.collection('clients').getFullList<Client>({ sort: 'name', filter: 'archived = false' }).catch(() => [] as Client[]),
		getSmtpSettings(pb).catch(() => null)
	]);

	const defaultTaxPercent = settings?.default_tax_percent ?? 5;

	// Build suggested estimate number
	const format = settings?.estimate_number_format?.trim() || 'EST-{number}';
	const nextNum = settings?.estimate_next_number ?? null;
	let suggestedEstimateNumber: string;
	if (nextNum !== null && nextNum > 0) {
		suggestedEstimateNumber = format.replace('{number}', String(nextNum));
	} else {
		const today = new Date().toISOString().split('T')[0];
		suggestedEstimateNumber = `EST-${today.replace(/-/g, '')}-001`;
	}

	return { clients, preselectedClient, defaultTaxPercent, suggestedEstimateNumber };
}

export const actions = {
	default: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const data = await request.formData();

		const client = data.get('client')?.toString();
		const number = data.get('number')?.toString().trim();
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

			const estimate = await pb.collection('estimates').create({
				client,
				number,
				issue_date,
				expiry_date,
				status,
				tax_percent,
				notes
			});
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

			// Auto-increment estimate number in settings if user used the suggested number
			if (settingsRecord?.id && settingsRecord.estimate_next_number) {
				const fmt = settingsRecord.estimate_number_format?.trim() || 'EST-{number}';
				const expectedNumber = fmt.replace('{number}', String(settingsRecord.estimate_next_number));
				if (number === expectedNumber) {
					await pb.collection('settings').update(settingsRecord.id, {
						estimate_next_number: settingsRecord.estimate_next_number + 1
					}).catch(() => { /* non-critical */ });
				}
			}
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Failed to create estimate';
			return fail(500, { error: msg });
		}

		return redirect(302, `/estimates/${estimateId}`);
	}
};
