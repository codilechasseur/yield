import { error } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import { getSmtpSettings, buildLogoUrl } from '$lib/mail.server.js';

/**
 * Serves the uploaded company logo (invoice/estimate PDF header) by proxying
 * the PocketBase file through the app, same as /api/favicon: the browser
 * can't necessarily reach PB_URL directly (e.g. internal docker hostname).
 * Server-side PDF generation keeps using the direct PB_URL — Puppeteer runs
 * next to PocketBase and can resolve it.
 */
export async function GET() {
	const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
	const settings = await getSmtpSettings(pb).catch(() => null);

	if (!settings?.logo || !settings.id) {
		throw error(404, 'No company logo configured');
	}

	const fileUrl = buildLogoUrl(env.PB_URL || 'http://localhost:8090', settings.id, settings.logo);
	const res = await fetch(fileUrl);
	if (!res.ok) throw error(404, 'Company logo file not found');

	return new Response(res.body, {
		headers: {
			'Content-Type': res.headers.get('Content-Type') ?? 'image/png',
			// The settings page cache-busts via ?v=<filename>.
			'Cache-Control': 'public, max-age=86400, immutable'
		}
	});
}
