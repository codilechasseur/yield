import { describe, it, expect } from 'vitest';
import { STATUS_COLORS } from '../pocketbase.js';

// ── Estimate status badge classes ────────────────────────────────────────────

describe('STATUS_COLORS — estimate statuses', () => {
	it('accepted returns a non-empty class string', () => {
		expect(STATUS_COLORS['accepted']).toBeTruthy();
		expect(typeof STATUS_COLORS['accepted']).toBe('string');
	});

	it('declined returns a non-empty class string', () => {
		expect(STATUS_COLORS['declined']).toBeTruthy();
	});

	it('expired returns a non-empty class string', () => {
		expect(STATUS_COLORS['expired']).toBeTruthy();
	});

	it('accepted class includes status-accepted', () => {
		expect(STATUS_COLORS['accepted']).toContain('status-accepted');
	});

	it('declined class includes status-declined', () => {
		expect(STATUS_COLORS['declined']).toContain('status-declined');
	});

	it('expired class includes status-expired', () => {
		expect(STATUS_COLORS['expired']).toContain('status-expired');
	});

	it('draft class still works (not broken by new entries)', () => {
		expect(STATUS_COLORS['draft']).toBeTruthy();
		expect(STATUS_COLORS['draft']).toContain('status-draft');
	});

	it('returns undefined for an unknown status', () => {
		expect(STATUS_COLORS['completely_unknown']).toBeUndefined();
	});
});
