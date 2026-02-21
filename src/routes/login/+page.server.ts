import { fail, redirect } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import {
	SESSION_COOKIE,
	verifyPassword,
	createSession,
	destroySession,
	validateSession
} from '$lib/auth.server.js';

export async function load({ cookies, url }) {
	let passwordHash: string | null = null;
	try {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const records = await pb.collection('settings').getFullList({ requestKey: null });
		passwordHash = (records[0]?.app_password_hash as string) || null;
	} catch {
		// ignore
	}

	// If auth isn't enabled, the login page is pointless — go to app
	if (!passwordHash) {
		redirect(302, url.searchParams.get('next') || '/');
	}

	// If already logged in, redirect to destination
	const token = cookies.get(SESSION_COOKIE);
	if (token && validateSession(token)) {
		redirect(302, url.searchParams.get('next') || '/');
	}

	return {};
}

export const actions = {
	login: async ({ request, cookies, url }) => {
		const fd = await request.formData();
		const password = fd.get('password')?.toString() ?? '';

		let passwordHash: string | null = null;
		try {
			const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
			const records = await pb.collection('settings').getFullList({ requestKey: null });
			passwordHash = (records[0]?.app_password_hash as string) || null;
		} catch {
			return fail(500, { error: 'Could not verify password. Try again.' });
		}

		if (!passwordHash || !(await verifyPassword(password, passwordHash))) {
			return fail(401, { error: 'Invalid password.' });
		}

		const token = createSession();
		cookies.set(SESSION_COOKIE, token, {
			path: '/',
			httpOnly: true,
			secure: url.protocol === 'https:',
			sameSite: 'lax',
			maxAge: 7 * 24 * 60 * 60 // 7 days
		});

		const next = url.searchParams.get('next') || '/';
		redirect(302, next);
	},

	logout: async ({ cookies }) => {
		const token = cookies.get(SESSION_COOKIE);
		if (token) {
			destroySession(token);
			cookies.delete(SESSION_COOKIE, { path: '/' });
		}
		redirect(302, '/login');
	}
};
