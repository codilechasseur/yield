import { error } from '@sveltejs/kit';
import type { Expense } from '$lib/types.js';
import { getPb } from '$lib/pb.server.js';

/**
 * Serves an expense's receipt. The receipt field is `protected` in PocketBase,
 * so the file needs a short-lived superuser file token — the browser never
 * sees PB_URL or the token, only this authenticated app route.
 */
export async function GET({ params }) {
	const pb = await getPb();
	const expense = await pb
		.collection('expenses')
		.getOne<Expense>(params.id)
		.catch(() => null);
	if (!expense?.receipt) throw error(404, 'No receipt attached');

	const token = await pb.files.getToken();
	const res = await fetch(pb.files.getURL(expense, expense.receipt, { token }));
	if (!res.ok) throw error(404, 'Receipt file not found');

	const safeName = expense.receipt.replace(/["\\\r\n]/g, '');
	return new Response(res.body, {
		headers: {
			'Content-Type': res.headers.get('Content-Type') ?? 'application/octet-stream',
			'Content-Disposition': `inline; filename="${safeName}"`,
			'Cache-Control': 'private, max-age=300',
			'X-Content-Type-Options': 'nosniff'
		}
	});
}
