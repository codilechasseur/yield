import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	createSession,
	validateSession,
	destroySession,
	destroyAllSessions,
	safeRedirectPath,
	sessionCookieOptions,
	loginRetryAfterMs,
	recordLoginFailure,
	clearLoginFailures,
	MAX_LOGIN_FAILURES,
	hashPassword,
	verifyPassword,
	getCachedPasswordHash,
	setCachedPasswordHash,
	invalidatePasswordCache
} from '../auth.server.js';

// ── Session management ──────────────────────────────────────────────────────

describe('Session management', () => {
	it('createSession returns a non-empty string token', () => {
		const token = createSession();
		expect(typeof token).toBe('string');
		expect(token.length).toBeGreaterThan(0);
	});

	it('createSession returns unique tokens each call', () => {
		const a = createSession();
		const b = createSession();
		expect(a).not.toBe(b);
	});

	it('validateSession returns true for a freshly created session', () => {
		const token = createSession();
		expect(validateSession(token)).toBe(true);
	});

	it('validateSession returns false for an unknown token', () => {
		expect(validateSession('totally-fake-token')).toBe(false);
	});

	it('validateSession returns false for an empty string', () => {
		expect(validateSession('')).toBe(false);
	});

	it('destroySession makes a valid session invalid', () => {
		const token = createSession();
		expect(validateSession(token)).toBe(true);
		destroySession(token);
		expect(validateSession(token)).toBe(false);
	});

	it('destroySession is a no-op for an unknown token', () => {
		// Should not throw
		expect(() => destroySession('nonexistent')).not.toThrow();
	});

	it('validateSession removes and rejects an expired session', () => {
		const token = createSession();
		// Push the current time past the session expiry (7 days + 1ms)
		const future = Date.now() + 7 * 24 * 60 * 60 * 1000 + 1;
		vi.spyOn(Date, 'now').mockReturnValue(future);
		expect(validateSession(token)).toBe(false);
		vi.restoreAllMocks();
	});
});

// ── Password hashing ────────────────────────────────────────────────────────

describe('Password hashing', () => {
	it('hashPassword returns a string containing a dot separator', async () => {
		const hash = await hashPassword('secret');
		expect(hash).toContain('.');
	});

	it('hashPassword produces different hashes for the same password (salted)', async () => {
		const h1 = await hashPassword('same');
		const h2 = await hashPassword('same');
		expect(h1).not.toBe(h2);
	});

	it('verifyPassword returns true for the correct password', async () => {
		const hash = await hashPassword('correct');
		const result = await verifyPassword('correct', hash);
		expect(result).toBe(true);
	});

	it('verifyPassword returns false for an incorrect password', async () => {
		const hash = await hashPassword('correct');
		const result = await verifyPassword('wrong', hash);
		expect(result).toBe(false);
	});

	it('verifyPassword returns false for an empty password against a real hash', async () => {
		const hash = await hashPassword('correct');
		const result = await verifyPassword('', hash);
		expect(result).toBe(false);
	});

	it('verifyPassword returns false for a malformed hash (no dot separator)', async () => {
		const result = await verifyPassword('anything', 'notavalidhash');
		expect(result).toBe(false);
	});

	it('verifyPassword returns false for an empty hash string', async () => {
		const result = await verifyPassword('anything', '');
		expect(result).toBe(false);
	});
});

// ── Password hash cache ─────────────────────────────────────────────────────

describe('Password hash cache', () => {
	beforeEach(() => {
		invalidatePasswordCache();
	});

	it('getCachedPasswordHash returns undefined before anything is set', () => {
		expect(getCachedPasswordHash()).toBeUndefined();
	});

	it('setCachedPasswordHash/getCachedPasswordHash round-trips a hash value', () => {
		setCachedPasswordHash('abc.def');
		expect(getCachedPasswordHash()).toBe('abc.def');
	});

	it('setCachedPasswordHash accepts null (no password configured)', () => {
		setCachedPasswordHash(null);
		expect(getCachedPasswordHash()).toBeNull();
	});

	it('invalidatePasswordCache causes getCachedPasswordHash to return undefined', () => {
		setCachedPasswordHash('some.hash');
		invalidatePasswordCache();
		expect(getCachedPasswordHash()).toBeUndefined();
	});

	it('cache expires after 1 minute', () => {
		setCachedPasswordHash('some.hash');
		const future = Date.now() + 60_001;
		vi.spyOn(Date, 'now').mockReturnValue(future);
		expect(getCachedPasswordHash()).toBeUndefined();
		vi.restoreAllMocks();
	});
});

// ── destroyAllSessions ──────────────────────────────────────────────────────

describe('destroyAllSessions', () => {
	it('invalidates every existing session', () => {
		const a = createSession();
		const b = createSession();
		destroyAllSessions();
		expect(validateSession(a)).toBe(false);
		expect(validateSession(b)).toBe(false);
	});

	it('does not prevent new sessions from being created', () => {
		destroyAllSessions();
		expect(validateSession(createSession())).toBe(true);
	});
});

// ── safeRedirectPath ────────────────────────────────────────────────────────

describe('safeRedirectPath', () => {
	it('allows same-origin paths with query strings', () => {
		expect(safeRedirectPath('/invoices')).toBe('/invoices');
		expect(safeRedirectPath('/invoices?page=2&q=a%20b')).toBe('/invoices?page=2&q=a%20b');
	});

	it('falls back for null, undefined and empty values', () => {
		expect(safeRedirectPath(null)).toBe('/');
		expect(safeRedirectPath(undefined)).toBe('/');
		expect(safeRedirectPath('')).toBe('/');
	});

	it('rejects absolute and protocol-relative URLs', () => {
		expect(safeRedirectPath('https://evil.example')).toBe('/');
		expect(safeRedirectPath('//evil.example')).toBe('/');
		expect(safeRedirectPath('javascript:alert(1)')).toBe('/');
	});

	it('rejects backslash and control-character tricks', () => {
		expect(safeRedirectPath('/\\evil.example')).toBe('/');
		expect(safeRedirectPath('/\t/evil.example')).toBe('/');
		expect(safeRedirectPath('/foo\\bar')).toBe('/');
	});

	it('uses the supplied fallback', () => {
		expect(safeRedirectPath('//evil.example', '/login')).toBe('/login');
	});
});

// ── Login rate limiting ─────────────────────────────────────────────────────

describe('Login rate limiting', () => {
	let n = 0;
	const key = () => `test-ip-${++n}`;

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('allows attempts from an unknown key', () => {
		expect(loginRetryAfterMs(key())).toBe(0);
	});

	it('allows attempts below the failure threshold', () => {
		const k = key();
		for (let i = 0; i < MAX_LOGIN_FAILURES - 1; i++) recordLoginFailure(k);
		expect(loginRetryAfterMs(k)).toBe(0);
	});

	it('locks out a key after MAX_LOGIN_FAILURES failures', () => {
		const k = key();
		for (let i = 0; i < MAX_LOGIN_FAILURES; i++) recordLoginFailure(k);
		expect(loginRetryAfterMs(k)).toBeGreaterThan(0);
	});

	it('does not affect other keys', () => {
		const k = key();
		for (let i = 0; i < MAX_LOGIN_FAILURES; i++) recordLoginFailure(k);
		expect(loginRetryAfterMs(key())).toBe(0);
	});

	it('lifts the lockout once it expires', () => {
		const k = key();
		const start = Date.now();
		vi.spyOn(Date, 'now').mockReturnValue(start);
		for (let i = 0; i < MAX_LOGIN_FAILURES; i++) recordLoginFailure(k);
		vi.spyOn(Date, 'now').mockReturnValue(start + 15 * 60 * 1000 + 1);
		expect(loginRetryAfterMs(k)).toBe(0);
	});

	it('doubles the lockout on repeat offences', () => {
		const k = key();
		const start = Date.now();
		vi.spyOn(Date, 'now').mockReturnValue(start);
		for (let i = 0; i < MAX_LOGIN_FAILURES; i++) recordLoginFailure(k);
		const first = loginRetryAfterMs(k);

		const later = start + first + 1;
		vi.spyOn(Date, 'now').mockReturnValue(later);
		for (let i = 0; i < MAX_LOGIN_FAILURES; i++) recordLoginFailure(k);
		expect(loginRetryAfterMs(k)).toBe(first * 2);
	});

	it('resets the failure count once the window passes', () => {
		const k = key();
		const start = Date.now();
		vi.spyOn(Date, 'now').mockReturnValue(start);
		for (let i = 0; i < MAX_LOGIN_FAILURES - 1; i++) recordLoginFailure(k);
		vi.spyOn(Date, 'now').mockReturnValue(start + 15 * 60 * 1000 + 1);
		recordLoginFailure(k);
		expect(loginRetryAfterMs(k)).toBe(0);
	});

	it('clearLoginFailures removes a lockout', () => {
		const k = key();
		for (let i = 0; i < MAX_LOGIN_FAILURES; i++) recordLoginFailure(k);
		clearLoginFailures(k);
		expect(loginRetryAfterMs(k)).toBe(0);
	});
});

// ── sessionCookieOptions ────────────────────────────────────────────────────

describe('sessionCookieOptions', () => {
	it('marks the cookie secure over https', () => {
		expect(sessionCookieOptions(new URL('https://yield.example/login')).secure).toBe(true);
	});

	it('does not mark the cookie secure over plain http', () => {
		expect(sessionCookieOptions(new URL('http://localhost:3000/login')).secure).toBe(false);
	});

	it('is httpOnly, lax, site-wide and lasts as long as a session', () => {
		const opts = sessionCookieOptions(new URL('https://yield.example/'));
		expect(opts).toMatchObject({ path: '/', httpOnly: true, sameSite: 'lax' });
		expect(opts.maxAge).toBe(7 * 24 * 60 * 60);
	});
});
