import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ params }) => {
	const email = env.PB_ADMIN_EMAIL;
	const password = env.PB_ADMIN_PASSWORD;
	if (!email || !password) {
		throw error(503, 'PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD are not configured');
	}

	const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
	await pb.collection('_superusers').authWithPassword(email, password);

	// Get a short-lived file access token and build the download URL
	const token = await pb.files.getToken();
	const url = pb.backups.getDownloadUrl(token, params.name);

	// Proxy the file through the SvelteKit server so the PocketBase URL
	// is never exposed to the client.
	const upstream = await fetch(url);
	if (!upstream.ok) {
		throw error(upstream.status, `Backup download failed: ${upstream.statusText}`);
	}

	const filename = params.name.includes('/') ? params.name.split('/').pop()! : params.name;
	return new Response(upstream.body, {
		headers: {
			'Content-Type': upstream.headers.get('Content-Type') ?? 'application/zip',
			'Content-Disposition': `attachment; filename="${filename}"`,
			...(upstream.headers.get('Content-Length')
				? { 'Content-Length': upstream.headers.get('Content-Length')! }
				: {})
		}
	});
};
