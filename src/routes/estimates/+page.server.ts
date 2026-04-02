import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import { calcSubtotal, calcTotal } from '$lib/pocketbase.js';
import type { Estimate, EstimateItem, Client } from '$lib/types.js';

const PER_PAGE = 25;

type EstimateExpand = { client?: Client; estimate_items_via_estimate?: EstimateItem[] };

export async function load({ url }) {
	const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');

	const status = url.searchParams.get('status') || '';
	const clientId = url.searchParams.get('client') || '';
	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));

	const filters: string[] = [];
	if (status && status !== 'expired') filters.push(`status = "${status}"`);
	if (clientId) filters.push(`client = "${clientId}"`);
	const filter = filters.join(' && ');

	const [estimatesResult, clients] = await Promise.all([
		pb
			.collection('estimates')
			.getList<Estimate & { expand: EstimateExpand }>(page, PER_PAGE, {
				sort: '-issue_date',
				expand: 'client,estimate_items_via_estimate',
				filter,
				requestKey: 'estimates-list'
			})
			.catch(() => null),
		pb
			.collection('clients')
			.getFullList<Client>({ sort: 'name', requestKey: 'clients-list' })
			.catch(() => [] as Client[])
	]);

	const empty = {
		estimates: [] as (Estimate & { total: number })[],
		clients,
		statusFilter: status,
		clientFilter: clientId,
		page: 1,
		totalPages: 1,
		totalItems: 0
	};

	if (!estimatesResult) return empty;

	const now = new Date();
	const estimates = estimatesResult.items
		.map((est) => {
			const items = est.expand?.estimate_items_via_estimate ?? [];
			const subtotal = calcSubtotal(items);
			return { ...est, total: calcTotal(subtotal, est.tax_percent ?? 0) };
		})
		.filter((est) => {
			// When filtering by 'expired' status, compute it locally (sent + past expiry_date)
			if (status === 'expired') {
				return est.status === 'sent' && !!est.expiry_date && new Date(est.expiry_date) < now;
			}
			return true;
		});

	return {
		estimates,
		clients,
		statusFilter: status,
		clientFilter: clientId,
		page: estimatesResult.page,
		totalPages: estimatesResult.totalPages,
		totalItems: status === 'expired' ? estimates.length : estimatesResult.totalItems
	};
}
