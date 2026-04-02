import { error, fail, redirect } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import type { Estimate, EstimateItem, Client } from '$lib/types.js';

export async function load({ params }) {
	const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
	try {
		const [estimate, items, clients] = await Promise.all([
			pb.collection('estimates').getOne<Estimate & { expand: { client: Client } }>(params.id, { expand: 'client' }),
			pb.collection('estimate_items').getFullList<EstimateItem>({ filter: `estimate = "${params.id}"`, sort: 'created' }),
			pb.collection('clients').getFullList<Client>({ sort: 'name', filter: 'archived = false' })
		]);
		return { estimate, items, clients };
	} catch {
		throw error(404, 'Estimate not found');
	}
}

export const actions = {
	default: async ({ request, params }) => {
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

		try {
			await pb.collection('estimates').update(params.id, {
				client, number, issue_date, expiry_date, status, tax_percent, notes
			});

			const existing = await pb.collection('estimate_items').getFullList({ filter: `estimate = "${params.id}"` });
			await Promise.all(existing.map((i) => pb.collection('estimate_items').delete(i.id)));
			for (const item of items) {
				await pb.collection('estimate_items').create({
					estimate: params.id,
					description: item.description,
					quantity: item.quantity,
					unit_price: item.unit_price
				});
			}

			try {
				await pb.collection('estimate_logs').create({
					estimate: params.id,
					action: 'edited',
					detail: 'Estimate details updated',
					occurred_at: new Date().toISOString()
				});
			} catch { /* non-critical */ }
		} catch {
			return fail(500, { error: 'Failed to update estimate' });
		}

		return redirect(302, `/estimates/${params.id}`);
	}
};
