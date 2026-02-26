import { json } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import type { Invoice, Client } from '$lib/types.js';
import { getSmtpSettings } from '$lib/mail.server.js';

/**
 * Returns all draft invoices (status = "draft") with their client name expanded,
 * plus the global default hourly rate from settings.
 * Used by the Quick Add Item dialog to populate the invoice selector.
 */
export async function GET() {
	const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
	const [invoices, settings] = await Promise.all([
		pb
			.collection('invoices')
			.getFullList<Invoice & { expand: { client?: Client } }>({
				filter: 'status = "draft"',
				sort: '-created',
				expand: 'client'
			})
			.catch(() => [] as (Invoice & { expand: { client?: Client } })[]),
		getSmtpSettings(pb).catch(() => null)
	]);
	const globalDefaultRate = settings?.default_hourly_rate ?? 0;
	return json({ invoices, globalDefaultRate });
}
