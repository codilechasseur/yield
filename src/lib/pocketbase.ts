// All PocketBase API calls are made server-side (in +page.server.ts / +server.ts).
// This file only exports shared utilities used in both client and server code.

export function formatCurrency(amount: number, currency = 'USD'): string {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		// Guard against empty-string currency (e.g. unset client/settings currency)
		currency: currency || 'USD'
	}).format(amount);
}

export function calcSubtotal(items: { quantity: number; unit_price: number }[]): number {
	return items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
}

export function calcTax(subtotal: number, taxPercent: number): number {
	return subtotal * (taxPercent / 100);
}

export function calcTotal(subtotal: number, taxPercent: number): number {
	return subtotal + calcTax(subtotal, taxPercent);
}

export const STATUS_COLORS: Record<string, string> = {
	draft: 'status-badge status-draft',
	sent: 'status-badge status-sent',
	paid: 'status-badge status-paid',
	overdue: 'status-badge status-overdue',
	written_off: 'status-badge status-written-off',
	accepted: 'status-badge status-accepted',
	declined: 'status-badge status-declined',
	expired: 'status-badge status-expired'
};

// Turn a PocketBase ClientResponseError into a user-facing message. Field-level
// validation errors (e.g. a unique-index clash on invoice number) live in
// `response.data.<field>`; fall back to the given message for anything else.
export function pbErrorMessage(e: unknown, fallback: string): string {
	const data = (e as { response?: { data?: Record<string, { code?: string; message?: string }> } })
		?.response?.data;
	if (data && typeof data === 'object') {
		for (const [field, err] of Object.entries(data)) {
			if (!err || typeof err !== 'object') continue;
			const label = field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, ' ');
			if (err.code === 'validation_not_unique') return `${label} is already in use`;
			if (err.message) return `${label}: ${err.message}`;
		}
	}
	return fallback;
}
