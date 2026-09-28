import type PocketBase from 'pocketbase';
import type { SmtpSettings } from '$lib/mail.server.js';

// Sequential numbering for invoices and estimates. Suggestions skip numbers
// that are already taken (e.g. by a Harvest import), so the unique index on
// `number` is never hit just by accepting the suggested value.

export type DocKind = 'invoice' | 'estimate';

const KINDS = {
	invoice: {
		collection: 'invoices',
		formatField: 'invoice_number_format',
		nextField: 'invoice_next_number',
		prefix: 'INV'
	},
	estimate: {
		collection: 'estimates',
		formatField: 'estimate_number_format',
		nextField: 'estimate_next_number',
		prefix: 'EST'
	}
} as const;

/** The configured number format for a kind, defaulting to e.g. "INV-{number}". */
export function numberFormat(kind: DocKind, settings: SmtpSettings | null | undefined): string {
	const k = KINDS[kind];
	return settings?.[k.formatField]?.trim() || `${k.prefix}-{number}`;
}

/** Substitute a counter value into a format like "INV-{number}". */
export function formatDocNumber(format: string, n: number): string {
	return format.replace('{number}', String(n));
}

/**
 * Extract the counter value from a number produced by `format`, or null if the
 * value doesn't match the format (e.g. "INV-7" under "{number}").
 */
export function parseDocNumber(format: string, value: string): number | null {
	if (!format.includes('{number}')) return null;
	const [before, after] = format.split('{number}', 2).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
	const m = new RegExp(`^${before}(\\d+)${after}$`).exec(value.trim());
	return m ? parseInt(m[1], 10) : null;
}

/**
 * Pick the first free number. With a configured counter (`nextNum` > 0) that is
 * the lowest counter value ≥ nextNum not already taken; otherwise a date-based
 * `PREFIX-YYYYMMDD-NNN` with the lowest free NNN.
 */
export function pickNextNumber(
	taken: Set<string>,
	opts: { format: string; nextNum: number | null | undefined; prefix: string; today: string }
): string {
	const { format, nextNum, prefix, today } = opts;
	if (nextNum && nextNum > 0 && format.includes('{number}')) {
		for (let n = nextNum; ; n++) {
			const candidate = formatDocNumber(format, n);
			if (!taken.has(candidate)) return candidate;
		}
	}
	const datePart = today.replace(/-/g, '');
	for (let n = 1; ; n++) {
		const candidate = `${prefix}-${datePart}-${String(n).padStart(3, '0')}`;
		if (!taken.has(candidate)) return candidate;
	}
}

async function takenNumbers(pb: PocketBase, kind: DocKind): Promise<Set<string>> {
	const records = await pb
		.collection(KINDS[kind].collection)
		.getFullList<{ number: string }>({ fields: 'number', requestKey: null })
		.catch(() => [] as { number: string }[]);
	return new Set(records.map((r) => r.number));
}

/** Suggest the next free invoice/estimate number from settings. */
export async function suggestNextNumber(
	pb: PocketBase,
	kind: DocKind,
	settings: SmtpSettings | null | undefined
): Promise<string> {
	return pickNextNumber(await takenNumbers(pb, kind), {
		format: numberFormat(kind, settings),
		nextNum: settings?.[KINDS[kind].nextField],
		prefix: KINDS[kind].prefix,
		today: new Date(Date.now()).toISOString().split('T')[0]
	});
}

/**
 * After creating a document numbered `used`, move the configured counter past
 * it when `used` follows the format and is at or beyond the counter. Does
 * nothing when no counter is configured. Non-critical: errors are swallowed.
 */
export async function advanceCounter(
	pb: PocketBase,
	kind: DocKind,
	settings: SmtpSettings | null | undefined,
	used: string | string[]
): Promise<void> {
	const field = KINDS[kind].nextField;
	const current = settings?.[field];
	if (!settings?.id || !current || current <= 0) return;
	const format = numberFormat(kind, settings);
	const values = (Array.isArray(used) ? used : [used])
		.map((u) => parseDocNumber(format, u))
		.filter((n): n is number => n !== null);
	if (values.length === 0) return;
	const highest = Math.max(...values);
	if (highest < current) return;
	await pb
		.collection('settings')
		.update(settings.id, { [field]: highest + 1 })
		.catch(() => { /* non-critical */ });
}

/** True when a PocketBase error is a unique-index clash on the `number` field. */
export function isNumberTaken(e: unknown): boolean {
	const data = (e as { response?: { data?: { number?: { code?: string } } } })?.response?.data;
	return data?.number?.code === 'validation_not_unique';
}

/**
 * Create a record with an auto-assigned number. If the number was taken in the
 * meantime (another tab, a concurrent Quick Add), pick the next free one and
 * retry. `number` is the value to try first — typically the suggestion the
 * user accepted. Returns the created record and the number it got.
 */
export async function createWithAutoNumber<T>(
	pb: PocketBase,
	kind: DocKind,
	settings: SmtpSettings | null | undefined,
	number: string,
	create: (number: string) => Promise<T>,
	maxAttempts = 5
): Promise<{ record: T; number: string }> {
	for (let attempt = 1; ; attempt++) {
		try {
			return { record: await create(number), number };
		} catch (e) {
			if (!isNumberTaken(e) || attempt >= maxAttempts) throw e;
			number = await suggestNextNumber(pb, kind, settings);
		}
	}
}
