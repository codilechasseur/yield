import { fail, redirect } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import { hashPassword, invalidatePasswordCache } from '$lib/auth.server.js';
import { getSmtpSettings } from '$lib/mail.server.js';

export async function load() {
	// If a password is already configured, setup is not needed.
	try {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const records = await pb.collection('settings').getFullList({ requestKey: null });
		if (records[0]?.app_password_hash) {
			redirect(302, '/');
		}
	} catch {
		// DB may not be ready yet — show the setup page anyway
	}

	return {};
}

export const actions = {
	setup: async ({ request }) => {
		const fd = await request.formData();
		const password = fd.get('password')?.toString() ?? '';
		const confirm = fd.get('confirm')?.toString() ?? '';

		if (password.length < 8) {
			return fail(400, { error: 'Password must be at least 8 characters.' });
		}
		if (password !== confirm) {
			return fail(400, { error: 'Passwords do not match.' });
		}

		try {
			const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
			const hash = await hashPassword(password);
			const existing = await getSmtpSettings(pb);
			if (existing?.id) {
				await pb.collection('settings').update(existing.id, { app_password_hash: hash });
			} else {
				await pb.collection('settings').create({ app_password_hash: hash });
			}
			invalidatePasswordCache();
		} catch (e) {
			return fail(500, { error: 'Failed to save password: ' + (e as Error).message });
		}

		redirect(302, '/login');
	}
};
