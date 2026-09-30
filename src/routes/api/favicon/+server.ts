import { error } from '@sveltejs/kit';
import type PocketBase from 'pocketbase';
import { getSmtpSettings, buildLogoUrl } from '$lib/mail.server.js';
import { getPb, pbUrl } from '$lib/pb.server.js';

/**
 * Serves the uploaded favicon by proxying the PocketBase file through the app.
 * The browser can't necessarily reach PB_URL directly (e.g. an internal
 * docker-compose hostname), but the app server always can.
 */
export async function GET() {
	const pb = await getPb();
	const settings = await getSmtpSettings(pb).catch(() => null);

	if (!settings?.favicon || !settings.id) {
		throw error(404, 'No favicon configured');
	}

	const fileUrl = buildLogoUrl(pbUrl(), settings.id, settings.favicon);
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
