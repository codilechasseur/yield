import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	addDebugEntry,
	clearDebugLog,
	setDebugEnabled,
	debugLog,
	getDebugEnabled
} from '../debug.svelte.js';
import { addToast, clearToasts } from '../toasts.svelte.js';

beforeEach(() => {
	clearDebugLog();
	clearToasts();
	setDebugEnabled(false);
	vi.useFakeTimers();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('setDebugEnabled / getDebugEnabled', () => {
	it('is disabled by default (no localStorage in test env)', () => {
		expect(getDebugEnabled()).toBe(false);
	});

	it('enables logging', () => {
		setDebugEnabled(true);
		expect(getDebugEnabled()).toBe(true);
	});

	it('disables logging', () => {
		setDebugEnabled(true);
		setDebugEnabled(false);
		expect(getDebugEnabled()).toBe(false);
	});
});

describe('addDebugEntry', () => {
	it('is a no-op when debug is disabled', () => {
		addDebugEntry('toast:success', 'Should not appear');
		expect(debugLog.length).toBe(0);
	});

	it('adds an entry when debug is enabled', () => {
		setDebugEnabled(true);
		addDebugEntry('toast:success', 'Hello');
		expect(debugLog.length).toBe(1);
	});

	it('stores the correct type and message', () => {
		setDebugEnabled(true);
		addDebugEntry('js-error', 'ReferenceError: x is not defined');
		expect(debugLog[0].type).toBe('js-error');
		expect(debugLog[0].message).toBe('ReferenceError: x is not defined');
	});

	it('stores an optional detail string', () => {
		setDebugEnabled(true);
		addDebugEntry('js-error', 'Boom', 'file.js:10:5');
		expect(debugLog[0].detail).toBe('file.js:10:5');
	});

	it('stores undefined detail when not provided', () => {
		setDebugEnabled(true);
		addDebugEntry('toast:error', 'No detail');
		expect(debugLog[0].detail).toBeUndefined();
	});

	it('attaches a timestamp to each entry', () => {
		setDebugEnabled(true);
		addDebugEntry('toast:success', 'Stamped');
		expect(debugLog[0].timestamp).toBeInstanceOf(Date);
	});

	it('assigns unique ids across entries', () => {
		setDebugEnabled(true);
		addDebugEntry('toast:success', 'A');
		addDebugEntry('toast:error', 'B');
		expect(debugLog[0].id).not.toBe(debugLog[1].id);
	});

	it('accumulates entries in order', () => {
		setDebugEnabled(true);
		addDebugEntry('toast:success', 'first');
		addDebugEntry('toast:error', 'second');
		addDebugEntry('js-error', 'third');
		expect(debugLog.length).toBe(3);
		expect(debugLog[0].message).toBe('first');
		expect(debugLog[2].message).toBe('third');
	});

	it('emits console.debug when enabled', () => {
		const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
		setDebugEnabled(true);
		addDebugEntry('toast:success', 'Visible');
		expect(spy).toHaveBeenCalledOnce();
		expect(spy).toHaveBeenCalledWith(expect.stringContaining('[debug:toast:success]'));
		expect(spy).toHaveBeenCalledWith(expect.stringContaining('Visible'));
	});

	it('includes detail in console.debug output when present', () => {
		const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
		setDebugEnabled(true);
		addDebugEntry('js-error', 'Error', 'stack trace here');
		expect(spy).toHaveBeenCalledWith(expect.stringContaining('stack trace here'));
	});

	it('does not emit console.debug when disabled', () => {
		const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
		addDebugEntry('toast:success', 'Silent');
		expect(spy).not.toHaveBeenCalled();
	});

	it('supports all four entry types', () => {
		setDebugEnabled(true);
		addDebugEntry('toast:success', 'a');
		addDebugEntry('toast:error', 'b');
		addDebugEntry('js-error', 'c');
		addDebugEntry('unhandled-rejection', 'd');
		addDebugEntry('server:error', 'e');
		const types = debugLog.map(e => e.type);
		expect(types).toEqual(['toast:success', 'toast:error', 'js-error', 'unhandled-rejection', 'server:error']);
	});
});

describe('clearDebugLog', () => {
	it('empties the log', () => {
		setDebugEnabled(true);
		addDebugEntry('toast:success', 'X');
		addDebugEntry('toast:error', 'Y');
		clearDebugLog();
		expect(debugLog.length).toBe(0);
	});

	it('is safe to call when already empty', () => {
		expect(() => clearDebugLog()).not.toThrow();
		expect(debugLog.length).toBe(0);
	});
});

describe('toast integration', () => {
	it('addToast feeds into debugLog when debug is enabled', () => {
		setDebugEnabled(true);
		addToast('Hello', 'success');
		expect(debugLog.length).toBe(1);
		expect(debugLog[0].type).toBe('toast:success');
		expect(debugLog[0].message).toBe('Hello');
	});

	it('addToast does not feed into debugLog when debug is disabled', () => {
		addToast('Silent', 'success');
		expect(debugLog.length).toBe(0);
	});

	it('error toasts are logged with type toast:error', () => {
		setDebugEnabled(true);
		addToast('Failure', 'error');
		expect(debugLog[0].type).toBe('toast:error');
	});

	it('log entries persist after the toast auto-dismisses', () => {
		setDebugEnabled(true);
		addToast('Gone soon', 'success', 500);
		vi.advanceTimersByTime(500);
		expect(clearToasts).toBeDefined(); // toast dismissed
		expect(debugLog.length).toBe(1);  // entry still in log
	});
});
