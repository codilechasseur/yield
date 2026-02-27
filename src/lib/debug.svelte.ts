/**
 * Central debug log. Captures:
 *  - toast:success / toast:error  — fired by addToast()
 *  - js-error                     — window 'error' events (DebugCapture component)
 *  - unhandled-rejection          — window 'unhandledrejection' events
 *
 * Enable via Settings → Debug toggle. State is persisted in localStorage so it
 * survives page reloads.
 */

export type DebugEntryType = 'toast:success' | 'toast:error' | 'js-error' | 'unhandled-rejection' | 'server:error';

export interface DebugEntry {
	id: number;
	type: DebugEntryType;
	message: string;
	/** Optional extra context: stack trace, file:line, etc. */
	detail?: string;
	timestamp: Date;
}

const STORAGE_KEY = 'yield-debug-enabled';

function _loadEnabled(): boolean {
	if (typeof localStorage === 'undefined') return false;
	return localStorage.getItem(STORAGE_KEY) === 'true';
}

// Single reactive object — only ever mutated, never reassigned, so Svelte
// allows exporting it as a live binding.
const _state = $state({
enabled: _loadEnabled(),
	log: [] as DebugEntry[]
});
let _next = 0;

/**
 * Turn debug logging on or off. The setting is persisted to `localStorage`.
 * When turned off, the existing log is preserved until `clearDebugLog()` is called.
 */
export function setDebugEnabled(value: boolean): void {
	_state.enabled = value;
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem(STORAGE_KEY, String(value));
	}
}

/**
 * Append an entry to the debug log. Does nothing when debug is disabled.
 */
export function addDebugEntry(type: DebugEntryType, message: string, detail?: string): void {
	if (!_state.enabled) return;
	_state.log.push({ id: _next++, type, message, detail, timestamp: new Date() });
	console.debug(`[debug:${type}] ${message}${detail ? `\n  ${detail}` : ''}`);
}

/** Empty the in-memory debug log. */
export function clearDebugLog(): void {
	_state.log.splice(0, _state.log.length);
}

/**
 * Reactive references exposed for use in Svelte components.
 * Access: `debugEnabled` (boolean), `debugLog` (DebugEntry[]).
 * Use `setDebugEnabled()` to mutate — never assign to these directly.
 */
export const debugLog: typeof _state.log = _state.log as DebugEntry[];

// Getter function — components call `getDebugEnabled()` reactively in $derived
// or use the object property directly via `_state`.
export function getDebugEnabled(): boolean {
	return _state.enabled;
}

// Expose the whole state object so Nav / DebugCapture can read `debugState.enabled`
// reactively in Svelte templates.
export { _state as debugState };
