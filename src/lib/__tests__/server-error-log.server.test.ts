import { describe, it, expect, beforeEach } from 'vitest';
import { pushServerError, getServerErrors } from '../server-error-log.server.js';

// Reset module state between tests by clearing private log via getServerErrors
// (we cannot import _log directly, so we drain it by reading & trimming).
// The simplest approach: use a fresh import per test is not needed because the
// module is loaded once — instead we clear by pushing MAX_ENTRIES+1 items and
// checking length, or we use a different strategy: just test the behaviour in
// sequence across a clean module invocation.
//
// Since Vitest reloads modules per file (not per test), we keep tests
// independent by reasoning about incremental ids and relative positions.

describe('pushServerError / getServerErrors', () => {
	// Capture a baseline id before any test-specific pushes
	let baselineId: number;

	beforeEach(() => {
		// getServerErrors() returns a snapshot; use the highest current id as
		// the "before" watermark so each test only sees its own entries.
		const existing = getServerErrors();
		baselineId = existing.length > 0 ? existing[existing.length - 1].id : -1;
	});

	it('returns an empty array when no errors have been added after baseline', () => {
		const errors = getServerErrors(baselineId);
		expect(errors).toHaveLength(0);
	});

	it('stores message, timestamp, and optional stack + url', () => {
		pushServerError('Something broke', 'Error: Something broke\n  at x.js:1', '/invoices');
		const [entry] = getServerErrors(baselineId);
		expect(entry.message).toBe('Something broke');
		expect(entry.stack).toContain('at x.js:1');
		expect(entry.url).toBe('/invoices');
		expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});

	it('works without stack or url (optional fields)', () => {
		pushServerError('Minimal error');
		const [entry] = getServerErrors(baselineId);
		expect(entry.message).toBe('Minimal error');
		expect(entry.stack).toBeUndefined();
		expect(entry.url).toBeUndefined();
	});

	it('assigns unique monotonically increasing ids', () => {
		pushServerError('Error A');
		pushServerError('Error B');
		const entries = getServerErrors(baselineId);
		expect(entries).toHaveLength(2);
		expect(entries[1].id).toBeGreaterThan(entries[0].id);
	});

	it('getServerErrors() with afterId returns only newer entries', () => {
		pushServerError('Before cutoff');
		const snapshot = getServerErrors(baselineId);
		const cutoffId = snapshot[snapshot.length - 1].id;

		pushServerError('After cutoff A');
		pushServerError('After cutoff B');
		const newer = getServerErrors(cutoffId);
		expect(newer).toHaveLength(2);
		expect(newer[0].message).toBe('After cutoff A');
		expect(newer[1].message).toBe('After cutoff B');
	});

	it('getServerErrors() without argument returns all entries', () => {
		pushServerError('One');
		pushServerError('Two');
		const all = getServerErrors();
		// Must include at least the two we just pushed
		expect(all.length).toBeGreaterThanOrEqual(2);
		const messages = all.map((e) => e.message);
		expect(messages).toContain('One');
		expect(messages).toContain('Two');
	});

	it('returns a copy — mutating the result does not affect the log', () => {
		pushServerError('Stable');
		const copy1 = getServerErrors(baselineId);
		copy1.splice(0, copy1.length); // clear our copy
		const copy2 = getServerErrors(baselineId);
		expect(copy2.length).toBeGreaterThanOrEqual(1);
	});
});
