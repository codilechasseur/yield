// All PocketBase API calls are made server-side (in +page.server.ts / +server.ts).
// This file only exports shared utilities used in both client and server code.

export function formatCurrency(amount: number, currency = 'USD'): string {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency
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
	written_off: 'status-badge status-written-off'
};
