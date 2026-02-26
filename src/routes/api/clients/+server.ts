import { json } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import type { Client } from '$lib/types.js';

export async function POST({ request }) {
	const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');

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
