import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

// ── Session store ────────────────────────────────────────────────────────────
// In-memory Map: token → expiry timestamp. Fine for a single-user app.
const sessions = new Map<string, number>();
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const SESSION_COOKIE = 'yield_session';

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

export function invalidatePasswordCache(): void {
	_cacheExpiry = 0;
	_cachedHash = undefined;
}
