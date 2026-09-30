import PocketBase, { isTokenExpired, type AuthRecord } from 'pocketbase';
import { env } from '$env/dynamic/private';

// Every PocketBase collection is locked to superusers (see the
// lock_down_collection_rules migration), so the app authenticates as the
// superuser from PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD. The token is cached for
// the process and shared by the per-request instances getPb() hands out.

/** Refresh the token when it has less than this many seconds left. */
const TOKEN_REFRESH_THRESHOLD_S = 5 * 60;

let cachedAuth: { token: string; record: AuthRecord } | null = null;
let pendingAuth: Promise<{ token: string; record: AuthRecord }> | null = null;

export class PbAdminNotConfiguredError extends Error {
	constructor() {
		super('PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD must be set so Yield can access PocketBase.');
		this.name = 'PbAdminNotConfiguredError';
	}
}

export function pbUrl(): string {
	return env.PB_URL || 'http://localhost:8090';
}

export function isPbAdminConfigured(): boolean {
	return Boolean(env.PB_ADMIN_EMAIL && env.PB_ADMIN_PASSWORD);
}

/** Forgets the cached superuser token so the next getPb() re-authenticates. */
export function resetPbAuth(): void {
	cachedAuth = null;
}

async function authenticate(): Promise<{ token: string; record: AuthRecord }> {
	const email = env.PB_ADMIN_EMAIL;
	const password = env.PB_ADMIN_PASSWORD;
	if (!email || !password) throw new PbAdminNotConfiguredError();

	const pb = new PocketBase(pbUrl());
	const res = await pb.collection('_superusers').authWithPassword(email, password, {
		requestKey: null
	});
	return { token: res.token, record: res.record };
}

/**
 * Returns a new PocketBase client authenticated as the superuser. Each call
 * gets its own instance (so request auto-cancellation stays per-request), but
 * they share one cached token. Throws PbAdminNotConfiguredError when the
 * credentials are missing, or the PocketBase error when authentication fails.
 */
export async function getPb(): Promise<PocketBase> {
	if (!cachedAuth || isTokenExpired(cachedAuth.token, TOKEN_REFRESH_THRESHOLD_S)) {
		// Concurrent callers share a single in-flight authentication.
		pendingAuth ??= authenticate().finally(() => {
			pendingAuth = null;
		});
		cachedAuth = await pendingAuth;
	}

	const pb = new PocketBase(pbUrl());
	pb.authStore.save(cachedAuth.token, cachedAuth.record);
	// A revoked token (e.g. superuser password changed) self-heals on the next call.
	pb.afterSend = (response, data) => {
		if (response.status === 401) resetPbAuth();
		return data;
	};
	return pb;
}
