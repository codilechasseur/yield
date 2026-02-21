import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	createSession,
	validateSession,
	destroySession,
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
