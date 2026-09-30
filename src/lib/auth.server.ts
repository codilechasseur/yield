import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import type PocketBase from 'pocketbase';

const scryptAsync = promisify(scrypt);

// ── Session store ────────────────────────────────────────────────────────────
// In-memory Map: token → expiry timestamp. Fine for a single-user app.
const sessions = new Map<string, number>();
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const SESSION_COOKIE = 'yield_session';

/** Cookie attributes for the session cookie set after login or a password change. */
export function sessionCookieOptions(url: URL) {
	return {
		path: '/',
		httpOnly: true,
		secure: url.protocol === 'https:',
		sameSite: 'lax' as const,
		maxAge: SESSION_TTL_MS / 1000
	};
}

export function createSession(): string {
	const token = randomBytes(32).toString('hex');
	sessions.set(token, Date.now() + SESSION_TTL_MS);
	return token;
}

export function validateSession(token: string): boolean {
	const expiry = sessions.get(token);
	if (!expiry) return false;
	if (Date.now() > expiry) {
		sessions.delete(token);
		return false;
	}
	return true;
}

export function destroySession(token: string): void {
	sessions.delete(token);
}

/** Revokes every session — used when the password changes or is removed. */
export function destroyAllSessions(): void {
	sessions.clear();
}

// ── Post-login redirect target ────────────────────────────────────────────────
/**
 * Returns `next` if it is a same-origin path, otherwise `fallback`. Blocks open
 * redirects such as `https://evil.com`, `//evil.com` and `/\evil.com` (browsers
 * treat a backslash like a slash).
 */
export function safeRedirectPath(next: string | null | undefined, fallback = '/'): string {
	if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
		return fallback;
	}
	// Tabs/newlines are stripped by URL parsers and can smuggle a second slash.
	if (/[\u0000-\u001f\\]/.test(next)) return fallback;
	try {
		const base = 'http://yield.invalid';
		return new URL(next, base).origin === base ? next : fallback;
	} catch {
		return fallback;
	}
}

// ── Login rate limiting ───────────────────────────────────────────────────────
// In-memory, per client key (IP address). After MAX_LOGIN_FAILURES failures
// inside the window, further attempts are refused until the lockout expires.
// Each subsequent lockout for the same key doubles, capped at MAX_LOCKOUT_MS.
export const MAX_LOGIN_FAILURES = 5;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const BASE_LOCKOUT_MS = 15 * 60 * 1000;
const MAX_LOCKOUT_MS = 24 * 60 * 60 * 1000;

interface LoginAttempts {
	failures: number;
	windowStart: number;
	lockedUntil: number;
	lockouts: number;
}

const loginAttempts = new Map<string, LoginAttempts>();

/** Returns 0 if a login attempt is allowed, otherwise milliseconds until it is. */
export function loginRetryAfterMs(key: string): number {
	const entry = loginAttempts.get(key);
	if (!entry) return 0;
	return Math.max(0, entry.lockedUntil - Date.now());
}

export function recordLoginFailure(key: string): void {
	const now = Date.now();
	pruneLoginAttempts(now);
	let entry = loginAttempts.get(key);
	if (!entry) {
		entry = { failures: 0, windowStart: now, lockedUntil: 0, lockouts: 0 };
		loginAttempts.set(key, entry);
	}
	if (now - entry.windowStart > FAILURE_WINDOW_MS) {
		entry.failures = 0;
		entry.windowStart = now;
	}
	entry.failures += 1;
	if (entry.failures >= MAX_LOGIN_FAILURES) {
		entry.lockedUntil = now + Math.min(BASE_LOCKOUT_MS * 2 ** entry.lockouts, MAX_LOCKOUT_MS);
		entry.lockouts += 1;
		entry.failures = 0;
		entry.windowStart = now;
	}
}

export function clearLoginFailures(key: string): void {
	loginAttempts.delete(key);
}

/** Drops entries that are neither locked nor inside an active failure window. */
function pruneLoginAttempts(now: number): void {
	for (const [key, entry] of loginAttempts) {
		const idleSince = Math.max(entry.lockedUntil, entry.windowStart + FAILURE_WINDOW_MS);
		// Keep the escalation history for a day after the last activity.
		if (now - idleSince > MAX_LOCKOUT_MS) loginAttempts.delete(key);
	}
}

// ── Password hashing (Node built-in scrypt) ───────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16).toString('hex');
	const buf = (await scryptAsync(password, salt, 64)) as Buffer;
	return `${buf.toString('hex')}.${salt}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
	const [hashed, salt] = hash.split('.');
	if (!hashed || !salt) return false;
	try {
		const buf = (await scryptAsync(password, salt, 64)) as Buffer;
		const hashedBuf = Buffer.from(hashed, 'hex');
		if (buf.length !== hashedBuf.length) return false;
		return timingSafeEqual(buf, hashedBuf);
	} catch {
		return false;
	}
}

// ── Password hash cache ───────────────────────────────────────────────────────
// Avoid reading PocketBase settings on every HTTP request.
let _cachedHash: string | null | undefined = undefined; // undefined = not loaded
let _cacheExpiry = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

export function getCachedPasswordHash(): string | null | undefined {
	if (Date.now() < _cacheExpiry) return _cachedHash;
	return undefined; // expired
}

export function setCachedPasswordHash(hash: string | null): void {
	_cachedHash = hash;
	_cacheExpiry = Date.now() + CACHE_TTL_MS;
}

/**
 * Reads the stored app password hash; `null` means no password is set.
 * Unlike getSmtpSettings() this throws when PocketBase can't be read, so
 * callers can fail closed instead of mistaking an outage for "no password".
 */
export async function readPasswordHash(pb: PocketBase): Promise<string | null> {
	const list = await pb.collection('settings').getList(1, 1, { requestKey: null });
	return (list.items[0]?.app_password_hash as string | undefined) || null;
}

export function invalidatePasswordCache(): void {
	_cacheExpiry = 0;
	_cachedHash = undefined;
}
