import { fail } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import type { Expense } from '$lib/types.js';

export async function load({ url }) {
	const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');

	const currentYear = new Date().getFullYear();
	const year = parseInt(url.searchParams.get('year') ?? String(currentYear), 10);
	const availableYears = Array.from({ length: 8 }, (_, i) => currentYear - i);

	try {
		const expenses = await pb.collection('expenses').getFullList<Expense>({
			filter: `expense_date >= "${year}-01-01 00:00:00" && expense_date <= "${year}-12-31 23:59:59"`,
			sort: '-expense_date'
		});
		return { expenses, year, availableYears, loadError: null as string | null };
	} catch (e) {
		return {
			expenses: [] as Expense[],
			year,
			availableYears,
			loadError: 'Could not load expenses: ' + (e as Error).message
		};
	}
}

export const actions = {
	create: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const fd = await request.formData();

		const description = fd.get('description')?.toString().trim();
		const amount = parseFloat(fd.get('amount')?.toString() ?? '');
		const gst_paid = parseFloat(fd.get('gst_paid')?.toString() ?? '0') || 0;
		const expense_date = fd.get('expense_date')?.toString();
		const notes = fd.get('notes')?.toString() ?? '';

		if (!description) return fail(400, { createError: 'Enter a description.' });
		if (!amount || isNaN(amount) || amount <= 0) {
			return fail(400, { createError: 'Enter a valid amount.' });
		}
		if (gst_paid < 0) return fail(400, { createError: 'GST paid cannot be negative.' });
		if (!expense_date) return fail(400, { createError: 'Select a date.' });

		try {
			await pb.collection('expenses').create({ description, amount, gst_paid, expense_date, notes });
		} catch (e) {
			return fail(500, { createError: 'Failed to save: ' + (e as Error).message });
		}

		return { createSuccess: true };
	},

	/** Re-log an existing expense with today's date — quick path for recurring monthly services. */
	duplicate: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const fd = await request.formData();
		const id = fd.get('id')?.toString();
		if (!id) return fail(400, { duplicateError: 'Missing ID.' });

		try {
			const src = await pb.collection('expenses').getOne<Expense>(id);
			await pb.collection('expenses').create({
				description: src.description,
				amount: src.amount,
				gst_paid: src.gst_paid ?? 0,
				expense_date: new Date().toISOString().slice(0, 10),
				notes: src.notes ?? ''
			});
		} catch (e) {
			return fail(500, { duplicateError: 'Failed to duplicate: ' + (e as Error).message });
		}

		return { duplicateSuccess: true };
	},

	delete: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const fd = await request.formData();
		const id = fd.get('id')?.toString();
		if (!id) return fail(400, { deleteError: 'Missing ID.' });

		try {
			await pb.collection('expenses').delete(id);
		} catch (e) {
			return fail(500, { deleteError: 'Failed to delete: ' + (e as Error).message });
		}

		return { deleteSuccess: true };
	}
};
