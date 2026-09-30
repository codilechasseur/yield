/** Human-readable names for invoice/estimate header fields, used in activity log entries. */
export const FIELD_LABELS: Record<string, string> = {
	client: 'client',
	number: 'number',
	subject: 'subject',
	issue_date: 'issue date',
	due_date: 'due date',
	expiry_date: 'expiry date',
	payment_terms: 'payment terms',
	status: 'status',
	tax_percent: 'tax rate',
	notes: 'notes'
};

export interface LineItemValues {
	description: string;
	quantity: number;
	unit_price: number;
}

function normalize(value: unknown, isDate: boolean): string | number {
	if (value === null || value === undefined) return '';
	if (typeof value === 'number') return value;
	const s = String(value).trim();
	// PocketBase returns "2026-09-30 00:00:00.000Z"; forms submit "2026-09-30".
	return isDate ? s.slice(0, 10) : s;
}

function sameValue(a: unknown, b: unknown, isDate = false): boolean {
	const x = normalize(a, isDate);
	const y = normalize(b, isDate);
	if (typeof x === 'number' || typeof y === 'number') return Number(x) === Number(y);
	return x === y;
}

/**
 * Return the keys of `submitted` whose values differ from `current`, in `submitted` key order.
 * Missing/null values compare equal to empty strings; numbers compare numerically.
 */
export function changedFields<K extends string>(
	current: Partial<Record<K, unknown>>,
	submitted: Record<K, unknown>,
	dateFields: readonly K[] = []
): K[] {
	return (Object.keys(submitted) as K[]).filter(
		(key) => !sameValue(current[key], submitted[key], dateFields.includes(key))
	);
}

/** True when the submitted line items differ from the stored ones (order matters). */
export function lineItemsChanged(current: LineItemValues[], submitted: LineItemValues[]): boolean {
	if (current.length !== submitted.length) return true;
	return current.some(
		(item, i) =>
			!sameValue(item.description, submitted[i].description) ||
			!sameValue(item.quantity, submitted[i].quantity) ||
			!sameValue(item.unit_price, submitted[i].unit_price)
	);
}

/** Build an activity log detail such as "Updated due date, notes and line items". */
export function describeChanges(changes: string[]): string {
	if (changes.length === 0) return '';
	const list =
		changes.length === 1
			? changes[0]
			: `${changes.slice(0, -1).join(', ')} and ${changes[changes.length - 1]}`;
	return `Updated ${list}`;
}
