import { json } from '@sveltejs/kit';
import type { Client } from '$lib/types.js';
import { getPb } from '$lib/pb.server.js';

export async function GET() {
	const pb = await getPb();
	try {
		const clients = await pb
			.collection('clients')
			.getFullList<Client>({ sort: 'name', filter: 'archived = false' });
		return json({ clients });
	} catch {
		return json({ clients: [] });
	}
}

export async function POST({ request }) {
	const pb = await getPb();

	let body: { name?: string; email?: string };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}

	const name = body.name?.trim();
	const email = body.email?.trim() ?? '';

	if (!name) {
		return json({ error: 'Name is required' }, { status: 400 });
	}

	try {
		const client = await pb.collection('clients').create<Client>({
			name,
			email,
			address: '',
			currency: 'USD',
			harvest_id: '',
			archived: false
		});
		return json({ client }, { status: 201 });
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : 'Failed to create client';
		return json({ error: msg }, { status: 500 });
	}
}
