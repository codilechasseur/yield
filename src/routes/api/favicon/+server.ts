import { error } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import { getSmtpSettings, buildLogoUrl } from '$lib/mail.server.js';

/**
 * Serves the uploaded favicon by proxying the PocketBase file through the app.
 * The browser can't necessarily reach PB_URL directly (e.g. an internal
 * docker-compose hostname), but the app server always can.
 */
export async function GET() {
	const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
	const settings = await getSmtpSettings(pb).catch(() => null);

	if (!settings?.favicon || !settings.id) {
		throw error(404, 'No favicon configured');
	}

	const fileUrl = buildLogoUrl(env.PB_URL || 'http://localhost:8090', settings.id, settings.favicon);
	const res = await fetch(fileUrl);
	if (!res.ok) throw error(404, 'Favicon file not found');

	return new Response(res.body, {
		headers: {
			'Content-Type': res.headers.get('Content-Type') ?? 'image/png',
			// The layout cache-busts via ?v=<filename>, so long-lived caching is safe.
			'Cache-Control': 'public, max-age=86400, immutable'
		}
	});
}
