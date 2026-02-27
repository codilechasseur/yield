/**
 * Server-side error ring buffer.
 *
 * Stores the most recent MAX_ENTRIES unhandled server errors so the client
 * debug page can fetch and display them. Entries are keyed by a monotonic id
 * and a UTC timestamp so the client can de-duplicate across polls.
 */

export interface ServerErrorEntry {
	id: number;
	message: string;
	stack?: string;
	url?: string;
	timestamp: string; // ISO-8601
}

const MAX_ENTRIES = 50;
const _log: ServerErrorEntry[] = [];
let _next = 0;

/**
 * Append an error to the ring buffer. Called from the `handleError` hook.
 */
export function pushServerError(message: string, stack?: string, url?: string): void {
	if (_log.length >= MAX_ENTRIES) {
		_log.shift();
	}
	_log.push({ id: _next++, message, stack, url, timestamp: new Date().toISOString() });
}

/**
 * Return a shallow copy of the current error log.
 * Optionally return only entries with id > afterId for incremental polling.
 */
export function getServerErrors(afterId?: number): ServerErrorEntry[] {
	if (afterId === undefined) return [..._log];
	return _log.filter((e) => e.id > afterId);
}
