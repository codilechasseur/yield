import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RecordService } from 'pocketbase';

const mockEnv = vi.hoisted(() => ({}) as Record<string, string | undefined>);
vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

import {
	getPb,
	pbUrl,
	isPbAdminConfigured,
	resetPbAuth,
	PbAdminNotConfiguredError
} from '../pb.server.js';

/** Builds an unsigned JWT-shaped token expiring `secondsFromNow` from now. */
function fakeToken(secondsFromNow: number): string {
	const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
	const exp = Math.floor(Date.now() / 1000) + secondsFromNow;
	return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ exp, type: 'auth' })}.sig`;
}

function mockAuth(token: () => string) {
	return vi
		.spyOn(RecordService.prototype, 'authWithPassword')
		.mockImplementation(async () => ({ token: token(), record: { id: 'su1' } }) as never);
}

describe('pb.server', () => {
	beforeEach(() => {
		for (const k of Object.keys(mockEnv)) delete mockEnv[k];
		mockEnv.PB_URL = 'http://pb.test:8090';
		mockEnv.PB_ADMIN_EMAIL = 'admin@example.com';
		mockEnv.PB_ADMIN_PASSWORD = 'secret';
		resetPbAuth();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('pbUrl', () => {
		it('returns PB_URL when set', () => {
			expect(pbUrl()).toBe('http://pb.test:8090');
		});

		it('falls back to localhost when PB_URL is unset', () => {
			delete mockEnv.PB_URL;
			expect(pbUrl()).toBe('http://localhost:8090');
		});
	});

	describe('isPbAdminConfigured', () => {
		it('is true when both credentials are set', () => {
			expect(isPbAdminConfigured()).toBe(true);
		});

		it('is false when either credential is missing or empty', () => {
			mockEnv.PB_ADMIN_PASSWORD = '';
			expect(isPbAdminConfigured()).toBe(false);
			mockEnv.PB_ADMIN_PASSWORD = 'secret';
			delete mockEnv.PB_ADMIN_EMAIL;
			expect(isPbAdminConfigured()).toBe(false);
		});
	});

	describe('getPb', () => {
		it('throws PbAdminNotConfiguredError when credentials are missing', async () => {
			delete mockEnv.PB_ADMIN_PASSWORD;
			await expect(getPb()).rejects.toBeInstanceOf(PbAdminNotConfiguredError);
		});

		it('returns a client authenticated with the superuser token', async () => {
			const token = fakeToken(3600);
			const auth = mockAuth(() => token);
			const pb = await getPb();
			expect(auth).toHaveBeenCalledWith('admin@example.com', 'secret', { requestKey: null });
			expect(pb.baseURL).toBe('http://pb.test:8090');
			expect(pb.authStore.token).toBe(token);
			expect(pb.authStore.isValid).toBe(true);
		});

		it('reuses the cached token across calls but returns distinct instances', async () => {
			const auth = mockAuth(() => fakeToken(3600));
			const a = await getPb();
			const b = await getPb();
			expect(auth).toHaveBeenCalledTimes(1);
			expect(a).not.toBe(b);
			expect(a.authStore.token).toBe(b.authStore.token);
		});

		it('shares one authentication between concurrent callers', async () => {
			const auth = mockAuth(() => fakeToken(3600));
			await Promise.all([getPb(), getPb(), getPb()]);
			expect(auth).toHaveBeenCalledTimes(1);
		});

		it('re-authenticates when the cached token is about to expire', async () => {
			let ttl = 60; // inside the 5-minute refresh threshold
			const auth = mockAuth(() => fakeToken(ttl));
			await getPb();
			ttl = 3600;
			await getPb();
			expect(auth).toHaveBeenCalledTimes(2);
		});

		it('re-authenticates after PocketBase answers 401', async () => {
			const auth = mockAuth(() => fakeToken(3600));
			const pb = await getPb();
			pb.afterSend!(new Response(null, { status: 401 }), {});
			await getPb();
			expect(auth).toHaveBeenCalledTimes(2);
		});

		it('keeps the cached token after non-401 responses', async () => {
			const auth = mockAuth(() => fakeToken(3600));
			const pb = await getPb();
			const data = { ok: true };
			expect(pb.afterSend!(new Response(null, { status: 404 }), data)).toBe(data);
			await getPb();
			expect(auth).toHaveBeenCalledTimes(1);
		});

		it('propagates authentication failures and retries on the next call', async () => {
			const auth = vi
				.spyOn(RecordService.prototype, 'authWithPassword')
				.mockRejectedValueOnce(new Error('bad credentials'))
				.mockImplementation(async () => ({ token: fakeToken(3600), record: { id: 'su1' } }) as never);
			await expect(getPb()).rejects.toThrow('bad credentials');
			await expect(getPb()).resolves.toBeDefined();
			expect(auth).toHaveBeenCalledTimes(2);
		});
	});
});
