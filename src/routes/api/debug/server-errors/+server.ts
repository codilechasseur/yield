import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getServerErrors } from '$lib/server-error-log.server.js';

/**
 * GET /api/debug/server-errors
 *
 * Returns the server-side error ring buffer as JSON. Accepts an optional
 * `after` query param (integer id) so callers can poll for new entries only.
 *
 * This endpoint is guarded by the global auth hook — no extra checks needed.
 */
export const GET: RequestHandler = ({ url }) => {
	const afterParam = url.searchParams.get('after');
	const afterId = afterParam !== null ? parseInt(afterParam, 10) : undefined;
	const errors = getServerErrors(Number.isNaN(afterId) ? undefined : afterId);
	return json(errors);
};
