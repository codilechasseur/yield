import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	addToast,
	removeToast,
	clearToasts,
	toasts,
	setToastDebug,
	getToastDebugConfig
} from '../toasts.svelte.js';

beforeEach(() => {
	clearToasts();
	setToastDebug(false);
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

describe('setToastDebug / getToastDebugConfig', () => {
	it('is disabled by default', () => {
		expect(getToastDebugConfig()).toEqual({ enabled: false, filter: 'all' });
	});

	it('enables logging and stores the config', () => {
		setToastDebug(true);
		expect(getToastDebugConfig()).toEqual({ enabled: true, filter: 'all' });
	});

	it('stores a custom filter when provided', () => {
		setToastDebug(true, ['error']);
		expect(getToastDebugConfig()).toEqual({ enabled: true, filter: ['error'] });
	});

	it('disables logging', () => {
		setToastDebug(true);
		setToastDebug(false);
		expect(getToastDebugConfig().enabled).toBe(false);
	});

	it('logs every toast when enabled with filter "all"', () => {
		const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
		setToastDebug(true, 'all');

		addToast('Success!', 'success');
		addToast('Failed!', 'error');

		expect(spy).toHaveBeenCalledTimes(2);
		expect(spy).toHaveBeenNthCalledWith(1, expect.stringContaining('[toast:success]'));
		expect(spy).toHaveBeenNthCalledWith(1, expect.stringContaining('Success!'));
		expect(spy).toHaveBeenNthCalledWith(2, expect.stringContaining('[toast:error]'));
		expect(spy).toHaveBeenNthCalledWith(2, expect.stringContaining('Failed!'));
	});

	it('only logs matching types when a filter is set', () => {
		const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
		setToastDebug(true, ['error']);

		addToast('All good', 'success');
		addToast('Oh no', 'error');

		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy).toHaveBeenCalledWith(expect.stringContaining('[toast:error]'));
		expect(spy).toHaveBeenCalledWith(expect.stringContaining('Oh no'));
	});

	it('does not log when debug is disabled', () => {
		const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
		setToastDebug(false);

		addToast('Silent', 'success');
		addToast('Also silent', 'error');

		expect(spy).not.toHaveBeenCalled();
	});

	it('does not log a success toast when filter is ["error"]', () => {
		const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
		setToastDebug(true, ['error']);

		addToast('All good', 'success');

		expect(spy).not.toHaveBeenCalled();
	});

	it('includes the toast id and message in the log output', () => {
		const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
		setToastDebug(true);

		addToast('Check me', 'success');
		const id = toasts[0].id;

		expect(spy).toHaveBeenCalledWith(expect.stringContaining(`id=${id}`));
		expect(spy).toHaveBeenCalledWith(expect.stringContaining('Check me'));
	});

	it('returns a snapshot so mutations do not affect the internal config', () => {
		setToastDebug(true, ['success']);
		const cfg = getToastDebugConfig();
		(cfg.filter as string[]).push('error');
		expect(getToastDebugConfig().filter).toEqual(['success']);
	});
});
