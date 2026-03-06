import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import { getSmtpSettings } from '$lib/mail.server.js';

export async function load({ locals }) {
	const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
	const smtp = await getSmtpSettings(pb).catch(() => null);
	return {
		authEnabled: locals.authEnabled ?? false,
		brandHue: smtp?.brand_hue ?? 250
	};
}
