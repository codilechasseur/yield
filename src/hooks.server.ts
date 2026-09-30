import type { Handle, HandleServerError } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { building } from '$app/environment';
import { pushServerError } from '$lib/server-error-log.server.js';
import { startReminderScheduler } from '$lib/reminders.server.js';
import type PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import {
	SESSION_COOKIE,
	validateSession,
	getCachedPasswordHash,
	setCachedPasswordHash,
	hashPassword,
	readPasswordHash
} from '$lib/auth.server.js';
import { getPb, PbAdminNotConfiguredError } from '$lib/pb.server.js';
import { getSmtpSettings } from '$lib/mail.server.js';

let envPasswordProvisioned = false;

/**
 * Writes APP_PASSWORD into settings when no password is stored yet. Runs
 * before any route (including /setup) is served, so a fresh instance can't be
 * claimed through the setup page before the env password lands.
 */
async function provisionEnvPassword(pb: PocketBase): Promise<string | null> {
	const plain = env.APP_PASSWORD?.trim();
	if (!plain) return null;
	const hash = await hashPassword(plain);
	const existing = await getSmtpSettings(pb);
	if (existing?.id) {
		await pb.collection('settings').update(existing.id, { app_password_hash: hash });
	} else {
		await pb.collection('settings').create({ app_password_hash: hash });
	}
	console.log('[yield] APP_PASSWORD provisioned from environment.');
	return hash;
}

// Kick off the overdue/reminder sweep when the server starts (not during build/prerender)
if (!building) startReminderScheduler();

/** The stored password hash (`null` = none set). Throws if PocketBase can't be read. */
async function loadPasswordHash(): Promise<string | null> {
	const cached = getCachedPasswordHash();
	if (cached !== undefined) return cached;

	const pb = await getPb();
	let hash = await readPasswordHash(pb);
	if (!hash && !envPasswordProvisioned) hash = await provisionEnvPassword(pb);
	envPasswordProvisioned = true;
	setCachedPasswordHash(hash);
	return hash;
}

/** Paths served to everyone, before any auth or database access. */
function isAlwaysPublic(path: string): boolean {
	return (
		path.startsWith('/_app/') ||
		path.startsWith('/.well-known/') ||
		path === '/api/favicon' ||
		path === '/api/app-logo' ||
		path === '/manifest.webmanifest'
	);
}

function isRoute(path: string, route: string): boolean {
	return path === route || path.startsWith(route + '/');
}

const SECURITY_HEADERS: Record<string, string> = {
	'X-Content-Type-Options': 'nosniff',
	'X-Frame-Options': 'DENY',
	'Referrer-Policy': 'same-origin',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()'
};

function withSecurityHeaders(response: Response): Response {
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		// Responses proxied from fetch() can have immutable headers.
		try {
			if (!response.headers.has(name)) response.headers.set(name, value);
		} catch {
			/* immutable — skip */
		}
	}
	return response;
}

const authHandle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;
	event.locals.authEnabled = false;
	event.locals.authed = false;

	if (isAlwaysPublic(path)) return resolve(event);

	let passwordHash: string | null;
	try {
		passwordHash = await loadPasswordHash();
	} catch (e) {
		// Fail closed: without the stored hash we can't tell who may get in.
		const message =
			e instanceof PbAdminNotConfiguredError
				? e.message
				: 'Yield cannot reach its database right now. Please try again shortly.';
		console.error('[yield] Auth check failed:', e);
		return new Response(message, { status: 503, headers: { 'Content-Type': 'text/plain' } });
	}

	if (!passwordHash) {
		// No password has been configured yet — force the user to create one.
		if (isRoute(path, '/setup')) return resolve(event);
		redirect(302, '/setup');
	}

	event.locals.authEnabled = true;

	// Setup is closed for good once a password exists (this also blocks POSTs
	// to the setup action, which re-checks as defence in depth).
	if (isRoute(path, '/setup')) redirect(302, '/login');

	const token = event.cookies.get(SESSION_COOKIE);
	event.locals.authed = Boolean(token && validateSession(token));

	if (isRoute(path, '/login')) return resolve(event);

	if (!event.locals.authed) {
		const next = encodeURIComponent(path + (event.url.search ?? ''));
		redirect(302, `/login?next=${next}`);
	}

	return resolve(event);
};

export const handle: Handle = async (input) => withSecurityHeaders(await authHandle(input));

/**
 * Capture unhandled server errors into the ring buffer so the debug page
 * can surface them client-side.
 */
export const handleError: HandleServerError = ({ error, event }) => {
	const message =
		error instanceof Error ? error.message : String(error ?? 'Unknown server error');
	const stack = error instanceof Error ? error.stack : undefined;
	pushServerError(message, stack, event.url?.pathname);
	console.error('[yield:server-error]', message, stack ?? '');
	// Return a generic message — internal error text (PocketBase URLs, SQL,
	// stack traces) stays in the server log and the authenticated debug page.
	return { message: 'Internal Error' };
};
