import { error } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import { getSmtpSettings, buildLogoUrl } from '$lib/mail.server.js';

/**
 * Serves the uploaded app logo (UI chrome branding — distinct from the
 * invoice/PDF `logo`) by proxying the PocketBase file through the app, same
 * as /api/favicon: the browser can't necessarily reach PB_URL directly.
 */
export async function GET() {
	const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
	const settings = await getSmtpSettings(pb).catch(() => null);

	if (!settings?.app_logo || !settings.id) {
		throw error(404, 'No app logo configured');
	}

	const fileUrl = buildLogoUrl(env.PB_URL || 'http://localhost:8090', settings.id, settings.app_logo);
	const res = await fetch(fileUrl);
	if (!res.ok) throw error(404, 'App logo file not found');

	return new Response(res.body, {
		headers: {
			'Content-Type': res.headers.get('Content-Type') ?? 'image/png',
			// The layout cache-busts via ?v=<filename>, so long-lived caching is safe.
			'Cache-Control': 'public, max-age=86400, immutable'
		}
	});
}
