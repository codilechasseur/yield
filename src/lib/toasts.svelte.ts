export type ToastType = 'success' | 'error';

export interface Toast {
	id: number;
	message: string;
	type: ToastType;
}

export interface ToastDebugConfig {
	/** Whether debug logging is active. */
	enabled: boolean;
	/**
	 * Which toast types to log. Pass `'all'` (the default) to log every type,
	 * or an array of specific types, e.g. `['error']`.
	 */
	filter: ToastType[] | 'all';
}

let list = $state<Toast[]>([]);
let _next = 0;

let _debug: ToastDebugConfig = { enabled: false, filter: 'all' };

function _passesFilter(type: ToastType): boolean {
	return _debug.filter === 'all' || _debug.filter.includes(type);
}

/**
 * Configure the toast debug logger.
 *
 * @example
 * // Log all toasts
 * setToastDebug(true);
 *
 * @example
 * // Log only errors
 * setToastDebug(true, ['error']);
 *
 * @example
 * // Disable logging
 * setToastDebug(false);
 */
export function setToastDebug(enabled: boolean, filter: ToastType[] | 'all' = 'all'): void {
	_debug = { enabled, filter };
}

/** Returns a snapshot of the current debug configuration. */
export function getToastDebugConfig(): ToastDebugConfig {
	return {
		enabled: _debug.enabled,
		filter: Array.isArray(_debug.filter) ? [..._debug.filter] : _debug.filter
	};
}

export function addToast(message: string, type: ToastType = 'success', duration = 4000) {
	const id = _next++;
	list.push({ id, message, type });

	if (_debug.enabled && _passesFilter(type)) {
		console.debug(`[toast:${type}] (id=${id}) ${message}`);
	}

	setTimeout(() => {
		const i = list.findIndex((t) => t.id === id);
		if (i !== -1) list.splice(i, 1);
	}, duration);
}

export function removeToast(id: number) {
	const i = list.findIndex((t) => t.id === id);
	if (i !== -1) list.splice(i, 1);
}

/** Remove all toasts — used for test isolation. */
export function clearToasts() {
	list.splice(0, list.length);
}

export { list as toasts };
