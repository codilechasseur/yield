import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { addToast, removeToast, clearToasts, toasts } from '../toasts.svelte.js';
import { clearDebugLog, setDebugEnabled } from '../debug.svelte.js';

beforeEach(() => {
	clearToasts();
	clearDebugLog();
	setDebugEnabled(false);
	vi.useFakeTimers();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('addToast', () => {
	it('adds a toast to the list', () => {
		addToast('Hello');
		expect(toasts.length).toBe(1);
		expect(toasts[0].message).toBe('Hello');
	});

	it('defaults type to success', () => {
		addToast('Done');
		expect(toasts[0].type).toBe('success');
	});

	it('accepts an explicit error type', () => {
		addToast('Oops', 'error');
		expect(toasts[0].type).toBe('error');
	});

	it('assigns a unique id to each toast', () => {
		addToast('First');
		addToast('Second');
		expect(toasts[0].id).not.toBe(toasts[1].id);
	});

	it('stacks multiple toasts', () => {
		addToast('A');
		addToast('B');
		addToast('C');
		expect(toasts.length).toBe(3);
	});

	it('auto-removes the toast after the duration', () => {
		addToast('Temp', 'success', 2000);
		expect(toasts.length).toBe(1);
		vi.advanceTimersByTime(2000);
		expect(toasts.length).toBe(0);
	});

	it('does not remove the toast before the duration elapses', () => {
		addToast('Temp', 'success', 3000);
		vi.advanceTimersByTime(2999);
		expect(toasts.length).toBe(1);
	});

	it('only removes the correct toast when multiple are present', () => {
		addToast('Short', 'success', 1000);
		addToast('Long',  'success', 5000);
		vi.advanceTimersByTime(1000);
		expect(toasts.length).toBe(1);
		expect(toasts[0].message).toBe('Long');
	});
});

describe('removeToast', () => {
	it('removes a toast by id', () => {
		addToast('Remove me');
		const id = toasts[0].id;
		removeToast(id);
		expect(toasts.length).toBe(0);
	});

	it('only removes the toast with the matching id', () => {
		addToast('Keep');
		addToast('Delete');
		const idToDelete = toasts[1].id;
		removeToast(idToDelete);
		expect(toasts.length).toBe(1);
		expect(toasts[0].message).toBe('Keep');
	});

	it('is a no-op for an unknown id', () => {
		addToast('Safe');
		removeToast(999);
		expect(toasts.length).toBe(1);
	});
});

describe('clearToasts', () => {
	it('removes all toasts', () => {
		addToast('A');
		addToast('B');
		addToast('C');
		clearToasts();
		expect(toasts.length).toBe(0);
	});

	it('is safe to call when the list is already empty', () => {
		expect(() => clearToasts()).not.toThrow();
		expect(toasts.length).toBe(0);
	});
});
