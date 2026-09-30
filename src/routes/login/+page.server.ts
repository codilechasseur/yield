import { fail, redirect } from '@sveltejs/kit';
import { getPb } from '$lib/pb.server.js';
import {
	SESSION_COOKIE,
	sessionCookieOptions,
	verifyPassword,
	createSession,
	destroySession,
	readPasswordHash,
	safeRedirectPath,
	loginRetryAfterMs,
	recordLoginFailure,
	clearLoginFailures
} from '$lib/auth.server.js';

// The auth hook only serves /login once a password exists, and sets
// locals.authed from the session cookie.
export async function load({ locals, url }) {
	if (locals.authed) {
		redirect(302, safeRedirectPath(url.searchParams.get('next')));
	}
	return {};
}

function retryMessage(ms: number): string {
	const minutes = Math.ceil(ms / 60_000);
	return `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}

export const actions = {
	login: async ({ request, cookies, url, getClientAddress }) => {
		// Behind a reverse proxy, set ADDRESS_HEADER (e.g. X-Forwarded-For) so this
		// is the real client IP rather than the proxy's. adapter-node throws when
		// that header is missing (a request that bypassed the proxy) — those share
		// one bucket.
		let clientKey: string;
		try {
			clientKey = getClientAddress();
		} catch {
			clientKey = 'unknown';
		}
		const retryAfter = loginRetryAfterMs(clientKey);
		if (retryAfter > 0) {
			return fail(429, { error: retryMessage(retryAfter) });
		}

		const fd = await request.formData();
		const password = fd.get('password')?.toString() ?? '';

		let passwordHash: string | null;
		try {
			passwordHash = await readPasswordHash(await getPb());
		} catch {
			return fail(503, { error: 'Could not verify password. Try again.' });
		}

		if (!passwordHash || !(await verifyPassword(password, passwordHash))) {
			recordLoginFailure(clientKey);
			const lockedFor = loginRetryAfterMs(clientKey);
			return fail(lockedFor > 0 ? 429 : 401, {
				error: lockedFor > 0 ? retryMessage(lockedFor) : 'Invalid password.'
			});
		}

		clearLoginFailures(clientKey);
		const token = createSession();
		cookies.set(SESSION_COOKIE, token, sessionCookieOptions(url));

		redirect(302, safeRedirectPath(fd.get('next')?.toString() || url.searchParams.get('next')));
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
