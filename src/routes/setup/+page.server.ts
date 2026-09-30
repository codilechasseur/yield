import { error, fail, isHttpError, redirect } from '@sveltejs/kit';
import { getPb } from '$lib/pb.server.js';
import {
	hashPassword,
	invalidatePasswordCache,
	readPasswordHash
} from '$lib/auth.server.js';
import { getSmtpSettings } from '$lib/mail.server.js';

// The auth hook only serves /setup while no password is stored; the action
// re-checks against the database so a stale cache can't reopen it.
export async function load({ locals }) {
	if (locals.authEnabled) redirect(302, '/login');
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
			const pb = await getPb();
			if (await readPasswordHash(pb)) {
				invalidatePasswordCache();
				error(403, 'A password is already set.');
			}
			const hash = await hashPassword(password);
			const existing = await getSmtpSettings(pb);
			if (existing?.id) {
				await pb.collection('settings').update(existing.id, { app_password_hash: hash });
			} else {
				await pb.collection('settings').create({ app_password_hash: hash });
			}
			invalidatePasswordCache();
		} catch (e) {
			if (isHttpError(e)) throw e;
			console.error('[yield] Setup failed:', e);
			return fail(500, { error: 'Failed to save password. Check that PocketBase is running.' });
		}

		redirect(302, '/login');
	}
};
