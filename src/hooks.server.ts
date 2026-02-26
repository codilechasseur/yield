import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import {
	SESSION_COOKIE,
	validateSession,
	getCachedPasswordHash,
	setCachedPasswordHash,
	hashPassword
} from '$lib/auth.server.js';

/** Provision APP_PASSWORD into the settings table if not already set. */
async function maybeProvisionEnvPassword(pb: PocketBase): Promise<void> {
	const plain = env.APP_PASSWORD?.trim();
	if (!plain) return;
	try {
		const records = await pb.collection('settings').getFullList({ requestKey: null });
		const existing = records[0];
		if (existing?.app_password_hash) return; // already set — don't overwrite
		const hash = await hashPassword(plain);
		if (existing?.id) {
			await pb.collection('settings').update(existing.id, { app_password_hash: hash });
		} else {
			await pb.collection('settings').create({ app_password_hash: hash });
		}
		setCachedPasswordHash(hash);
		console.log('[yield] APP_PASSWORD provisioned from environment.');
	} catch {
		// Settings collection may not exist yet on a fresh boot — will retry next request.
	}
}

let _envPasswordProvisioned = false;

async function getPasswordHash(): Promise<string | null> {
	const cached = getCachedPasswordHash();
	if (cached !== undefined) return cached;

	try {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');

		if (!_envPasswordProvisioned) {
			await maybeProvisionEnvPassword(pb);
			_envPasswordProvisioned = true;
		}

		const records = await pb.collection('settings').getFullList({ requestKey: null });
		const hash = (records[0]?.app_password_hash as string) || null;
		setCachedPasswordHash(hash);
		return hash;
	} catch {
		// Settings collection may not exist yet — treat as no auth required
		setCachedPasswordHash(null);
		return null;
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;

	// Always pass through the login/setup routes (and SvelteKit internals)
	if (
		path.startsWith('/login') ||
		path.startsWith('/setup') ||
		path.startsWith('/__data') ||
		path.startsWith('/_app/')
	) {
		event.locals.authEnabled = false;
		event.locals.authed = false;
		return resolve(event);
	}

	const passwordHash = await getPasswordHash();
	const authEnabled = Boolean(passwordHash);
	event.locals.authEnabled = authEnabled;

	if (!authEnabled) {
		// No password has been configured yet — force the user to create one.
		redirect(302, '/setup');
	}

	const token = event.cookies.get(SESSION_COOKIE);
	const authed = Boolean(token && validateSession(token));
	event.locals.authed = authed;

	if (!authed) {
		const next = encodeURIComponent(path + (event.url.search ?? ''));
		redirect(302, `/login?next=${next}`);
	}

	return resolve(event);
};
