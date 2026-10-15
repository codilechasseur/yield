import { fail } from '@sveltejs/kit';
import type PocketBase from 'pocketbase';
import type { Expense, ExpenseCategory, RecurringExpense } from '$lib/types.js';
import { getPb } from '$lib/pb.server.js';
import { getSmtpSettings } from '$lib/mail.server.js';
import { isExpenseCategory, parseBusinessUse, summarizeExpenses } from '$lib/expenses.js';
import { annualCost, isFrequency, nextOccurrence, toIsoDate } from '$lib/recurring.js';
import { generateForRecurringExpense, generateRecurringExpenses, isUniqueViolation, todayIso } from '$lib/recurring.server.js';

const PER_PAGE = 20;
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

export interface RecurringRow extends RecurringExpense {
	nextDate: string | null;
	annualCost: number;
	chargeCount: number;
}

export async function load({ url }) {
	const pb = await getPb();
	// Several queries on the same collection run in parallel — don't let the SDK cancel them as duplicates.
	pb.autoCancellation(false);
	const today = todayIso();

	const currentYear = new Date().getFullYear();
	const year = parseInt(url.searchParams.get('year') ?? String(currentYear), 10) || currentYear;
	const availableYears = Array.from({ length: 8 }, (_, i) => currentYear - i);
	const month = parseInt(url.searchParams.get('month') ?? '', 10) || 0; // 0 = whole year
	const categoryParam = url.searchParams.get('category') ?? '';
	const category: ExpenseCategory | '' = isExpenseCategory(categoryParam) ? categoryParam : '';
	const q = (url.searchParams.get('q') ?? '').trim();
	const pageNum = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
	const filters = { year, month, category, q };

	const settings = await getSmtpSettings(pb).catch(() => null);
	const defaultTaxPercent = settings?.default_tax_percent ?? 5;

	// Create any recurring charges that have come due before reading totals.
	const generated = await generateRecurringExpenses(pb, today).catch((e) => ({
		created: 0,
		errors: [(e as Error).message]
	}));

	const yearFilter = pb.filter('expense_date >= {:from} && expense_date <= {:to}', {
		from: `${year}-01-01 00:00:00`,
		to: `${year}-12-31 23:59:59`
	});
	const listFilter = buildListFilter(pb, filters);
	const hasFilters = Boolean(month || category || q);

	try {
		const [list, yearRows, filteredRows, schedules, linked] = await Promise.all([
			pb.collection('expenses').getList<Expense>(pageNum, PER_PAGE, { filter: listFilter, sort: '-expense_date,-created' }),
			pb.collection('expenses').getFullList<Expense>({ filter: yearFilter, fields: 'amount,gst_paid,category,business_use_percent' }),
			hasFilters
				? pb.collection('expenses').getFullList<Expense>({ filter: listFilter, fields: 'amount,gst_paid,category,business_use_percent' })
				: Promise.resolve(null),
			pb.collection('recurring_expenses').getFullList<RecurringExpense>({ sort: 'description' }).catch(() => [] as RecurringExpense[]),
			pb.collection('expenses').getFullList<Expense>({ filter: "recurring != ''", fields: 'recurring' }).catch(() => [] as Expense[])
		]);

		const chargeCounts = new Map<string, number>();
		for (const e of linked) chargeCounts.set(e.recurring, (chargeCounts.get(e.recurring) ?? 0) + 1);

		const recurring: RecurringRow[] = schedules
			.map((s) => ({
				...s,
				nextDate: nextOccurrence(s, today),
				annualCost: annualCost(s.amount, s.frequency),
				chargeCount: chargeCounts.get(s.id) ?? 0
			}))
			// Active schedules first, soonest charge first
			.sort((a, b) => (a.nextDate ?? '9999').localeCompare(b.nextDate ?? '9999') || a.description.localeCompare(b.description));

		return {
			expenses: list.items,
			page: list.page,
			totalPages: list.totalPages,
			totalItems: list.totalItems,
			filters,
			hasFilters,
			yearTotals: summarizeExpenses(yearRows),
			filteredTotals: filteredRows ? summarizeExpenses(filteredRows) : null,
			recurring,
			recurringAnnual: recurring.filter((r) => r.nextDate).reduce((s, r) => s + r.annualCost, 0),
			year,
			availableYears,
			defaultTaxPercent,
			today,
			loadError: generated.errors.length ? 'Some recurring expenses could not be created: ' + generated.errors.join('; ') : (null as string | null)
		};
	} catch (e) {
		return {
			expenses: [] as Expense[],
			page: 1,
			totalPages: 1,
			totalItems: 0,
			filters,
			hasFilters,
			yearTotals: summarizeExpenses([]),
			filteredTotals: null,
			recurring: [] as RecurringRow[],
			recurringAnnual: 0,
			year,
			availableYears,
			defaultTaxPercent,
			today,
			loadError: 'Could not load expenses: ' + (e as Error).message
		};
	}
}

function buildListFilter(
	pb: PocketBase,
	f: { year: number; month: number; category: ExpenseCategory | ''; q: string }
): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	const from = f.month ? `${f.year}-${pad(f.month)}-01 00:00:00` : `${f.year}-01-01 00:00:00`;
	const lastDay = f.month ? new Date(Date.UTC(f.year, f.month, 0)).getUTCDate() : 31;
	const to = f.month ? `${f.year}-${pad(f.month)}-${pad(lastDay)} 23:59:59` : `${f.year}-12-31 23:59:59`;

	const parts = [pb.filter('expense_date >= {:from} && expense_date <= {:to}', { from, to })];
	if (f.category === 'other') parts.push("(category = 'other' || category = '')");
	else if (f.category) parts.push(pb.filter('category = {:category}', { category: f.category }));
	if (f.q) parts.push(pb.filter('(description ~ {:q} || notes ~ {:q})', { q: f.q }));
	return parts.join(' && ');
}

interface ExpenseFields {
	description: string;
	amount: number;
	gst_paid: number;
	category: ExpenseCategory;
	business_use_percent: number;
	notes: string;
}

/** Validates the fields shared by expenses and recurring schedules. Returns an error message or the parsed values. */
function parseExpenseFields(fd: FormData): ExpenseFields | string {
	const description = fd.get('description')?.toString().trim() ?? '';
	const amount = parseFloat(fd.get('amount')?.toString() ?? '');
	const gstRaw = fd.get('gst_paid')?.toString().trim() ?? '';
	const gst_paid = gstRaw === '' ? 0 : parseFloat(gstRaw);
	const categoryRaw = fd.get('category')?.toString() ?? '';
	const business_use_percent = parseBusinessUse(fd.get('business_use_percent')?.toString());
	const notes = fd.get('notes')?.toString().trim() ?? '';

	if (!description) return 'Enter a description.';
	if (!Number.isFinite(amount) || amount <= 0) return 'Enter a valid amount.';
	if (!Number.isFinite(gst_paid) || gst_paid < 0) return 'GST/HST paid must be zero or more.';
	if (categoryRaw && !isExpenseCategory(categoryRaw)) return 'Choose a category from the list.';
	if (business_use_percent === null) return 'Business use must be between 1 and 100%.';

	return {
		description,
		amount: round2(amount),
		gst_paid: round2(gst_paid),
		category: isExpenseCategory(categoryRaw) ? categoryRaw : 'other',
		business_use_percent,
		notes
	};
}

/** Returns the uploaded receipt, null when none was chosen, or an error message. */
function parseReceipt(fd: FormData): File | null | string {
	const file = fd.get('receipt');
	if (!(file instanceof File) || file.size === 0) return null;
	if (file.size > MAX_RECEIPT_BYTES) return 'Receipts must be 10 MB or smaller.';
	if (!/^(application\/pdf|image\/(jpeg|png|webp|heic|heif))$/.test(file.type)) {
		return 'Receipts must be a PDF or an image (JPEG, PNG, WebP, HEIC).';
	}
	return file;
}

function isIsoDate(s: string): boolean {
	return toIsoDate(s) === s && !Number.isNaN(Date.parse(s));
}

function round2(n: number): number {
	return Math.round(n * 100) / 100;
}

export const actions = {
	create: async ({ request }) => {
		const pb = await getPb();
		const fd = await request.formData();

		const fields = parseExpenseFields(fd);
		if (typeof fields === 'string') return fail(400, { createError: fields });
		const expense_date = fd.get('expense_date')?.toString() ?? '';
		if (!isIsoDate(expense_date)) return fail(400, { createError: 'Select a date.' });
		const receipt = parseReceipt(fd);
		if (typeof receipt === 'string') return fail(400, { createError: receipt });

		const repeat = fd.get('repeat') === 'on';
		if (!repeat) {
			try {
				await pb.collection('expenses').create({ ...fields, expense_date, ...(receipt ? { receipt } : {}) });
			} catch (e) {
				return fail(500, { createError: 'Failed to save: ' + (e as Error).message });
			}
			return { createSuccess: true, chargesCreated: 1 };
		}

		const frequency = fd.get('frequency')?.toString();
		const end_date = fd.get('end_date')?.toString().trim() ?? '';
		if (!isFrequency(frequency)) return fail(400, { createError: 'Choose how often it repeats.' });
		if (end_date && (!isIsoDate(end_date) || end_date < expense_date)) {
			return fail(400, { createError: 'The end date must be on or after the start date.' });
		}

		try {
			const schedule = await pb.collection('recurring_expenses').create<RecurringExpense>({
				...fields,
				frequency,
				start_date: expense_date,
				end_date
			});
			const result = await generateForRecurringExpense(pb, schedule.id);
			if (result.errors.length) throw new Error(result.errors.join('; '));
			if (receipt) {
				const first = await pb
					.collection('expenses')
					.getFirstListItem<Expense>(pb.filter('recurring = {:id}', { id: schedule.id }), { sort: 'expense_date' })
					.catch(() => null);
				if (first) await pb.collection('expenses').update(first.id, { receipt });
			}
			return { createSuccess: true, chargesCreated: result.created };
		} catch (e) {
			return fail(500, { createError: 'Failed to save: ' + (e as Error).message });
		}
	},

	update: async ({ request }) => {
		const pb = await getPb();
		const fd = await request.formData();
		const id = fd.get('id')?.toString();
		if (!id) return fail(400, { updateError: 'Missing ID.' });

		const fields = parseExpenseFields(fd);
		if (typeof fields === 'string') return fail(400, { updateError: fields });
		const expense_date = fd.get('expense_date')?.toString() ?? '';
		if (!isIsoDate(expense_date)) return fail(400, { updateError: 'Select a date.' });
		const receipt = parseReceipt(fd);
		if (typeof receipt === 'string') return fail(400, { updateError: receipt });
		const removeReceipt = fd.get('remove_receipt') === 'on';

		try {
			await pb.collection('expenses').update(id, {
				...fields,
				expense_date,
				...(receipt ? { receipt } : removeReceipt ? { receipt: null } : {})
			});
		} catch (e) {
			// Moving a recurring charge onto a date that already has one trips the unique index.
			if (isUniqueViolation(e)) {
				return fail(400, { updateError: 'This recurring expense already has a charge on that date.' });
			}
			return fail(500, { updateError: 'Failed to save: ' + (e as Error).message });
		}
		return { updateSuccess: true };
	},

	delete: async ({ request }) => {
		const pb = await getPb();
		const fd = await request.formData();
		const id = fd.get('id')?.toString();
		if (!id) return fail(400, { deleteError: 'Missing ID.' });

		try {
			await pb.collection('expenses').delete(id);
		} catch (e) {
			return fail(500, { deleteError: 'Failed to delete: ' + (e as Error).message });
		}

		return { deleteSuccess: true };
	},

	updateRecurring: async ({ request }) => {
		const pb = await getPb();
		const fd = await request.formData();
		const id = fd.get('id')?.toString();
		if (!id) return fail(400, { recurringError: 'Missing ID.' });

		const fields = parseExpenseFields(fd);
		if (typeof fields === 'string') return fail(400, { recurringError: fields });
		const frequency = fd.get('frequency')?.toString();
		const start_date = fd.get('expense_date')?.toString() ?? '';
		const end_date = fd.get('end_date')?.toString().trim() ?? '';
		if (!isFrequency(frequency)) return fail(400, { recurringError: 'Choose how often it repeats.' });
		if (!isIsoDate(start_date)) return fail(400, { recurringError: 'Select a start date.' });
		if (end_date && (!isIsoDate(end_date) || end_date < start_date)) {
			return fail(400, { recurringError: 'The end date must be on or after the start date.' });
		}

		try {
			await pb.collection('recurring_expenses').update(id, { ...fields, frequency, start_date, end_date });
			const result = await generateForRecurringExpense(pb, id);
			if (result.errors.length) throw new Error(result.errors.join('; '));
		} catch (e) {
			return fail(500, { recurringError: 'Failed to save: ' + (e as Error).message });
		}
		return { recurringSuccess: true };
	},

	/** Ends a schedule today: charges already created stay, nothing new is created. */
	stopRecurring: async ({ request }) => {
		const pb = await getPb();
		const fd = await request.formData();
		const id = fd.get('id')?.toString();
		if (!id) return fail(400, { recurringError: 'Missing ID.' });

		try {
			const s = await pb.collection('recurring_expenses').getOne<RecurringExpense>(id);
			const today = todayIso();
			// Never end before the start date or before a charge that already exists.
			const floor = [toIsoDate(s.start_date), toIsoDate(s.last_generated)].filter(Boolean).sort().at(-1) ?? today;
			await pb.collection('recurring_expenses').update(id, { end_date: floor > today ? floor : today });
		} catch (e) {
			return fail(500, { recurringError: 'Failed to stop: ' + (e as Error).message });
		}
		return { recurringSuccess: true };
	},

	deleteRecurring: async ({ request }) => {
		const pb = await getPb();
		const fd = await request.formData();
		const id = fd.get('id')?.toString();
		if (!id) return fail(400, { recurringError: 'Missing ID.' });
		const deleteCharges = fd.get('delete_charges') === 'on';

		try {
			if (deleteCharges) {
				const charges = await pb
					.collection('expenses')
					.getFullList<Expense>({ filter: pb.filter('recurring = {:id}', { id }), fields: 'id' });
				for (const c of charges) await pb.collection('expenses').delete(c.id);
			}
			// Remaining charges keep their data; PocketBase clears their link to the schedule.
			await pb.collection('recurring_expenses').delete(id);
		} catch (e) {
			return fail(500, { recurringError: 'Failed to delete: ' + (e as Error).message });
		}
		return { recurringSuccess: true };
	}
};
