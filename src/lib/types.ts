export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'written_off';

export interface Client {
	id: string;
	name: string;
	email: string;
	address: string;
	currency: string;
	harvest_id: string;
	default_hourly_rate?: number;
	archived: boolean;
	created: string;
	updated: string;
}

export interface Contact {
	id: string;
	client: string;
	first_name: string;
	last_name: string;
	email: string;
	title: string;
	phone: string;
	harvest_id: string;
	created: string;
	updated: string;
}

export type PaymentTerms = 'upon_receipt' | 'net_15' | 'net_30' | 'net_45' | 'net_60' | 'custom' | '';

export interface Invoice {
	id: string;
	client: string;
	expand?: { client?: Client };
	number: string;
	/** Optional one-line description, e.g. "Retainer for Acme — August 2026". */
	subject?: string;
	issue_date: string;
	due_date: string;
	payment_terms: PaymentTerms;
	status: InvoiceStatus;
	tax_percent: number;
	paid_amount: number;
	notes: string;
	created: string;
	updated: string;
}

export interface InvoiceItem {
	id: string;
	invoice: string;
	description: string;
	quantity: number;
	unit_price: number;
	created: string;
	updated: string;
}

export interface InvoiceWithItems extends Invoice {
	items: InvoiceItem[];
	client_data?: Client;
}

export type InvoiceLogAction = 'status_changed' | 'note' | 'edited' | 'email_sent' | 'invoice_created' | 'payment_recorded';

export interface InvoiceLog {
	id: string;
	invoice: string;
	action: InvoiceLogAction;
	detail: string;
	occurred_at: string;
	created: string;
}

/** Expense categories, keyed to CRA form T2125 lines — see EXPENSE_CATEGORIES in $lib/expenses.ts. */
export type ExpenseCategory =
	| 'advertising'
	| 'meals'
	| 'insurance'
	| 'interest'
	| 'fees'
	| 'office'
	| 'supplies'
	| 'professional'
	| 'rent'
	| 'repairs'
	| 'travel'
	| 'telephone'
	| 'vehicle'
	| 'software'
	| 'home_office'
	| 'other';

export interface Expense {
	id: string;
	description: string;
	/** Pre-tax amount of the expense. */
	amount: number;
	/** GST/HST paid on the expense (input tax credit). */
	gst_paid: number;
	expense_date: string;
	notes: string;
	/** Empty on expenses logged before categories existed — treated as 'other'. */
	category: ExpenseCategory | '';
	/** Share of the expense used for the business, 1–100. 0/unset means 100 (older records). */
	business_use_percent: number;
	/** Filename of the attached receipt (empty = none). Served via /api/expenses/[id]/receipt. */
	receipt: string;
	/** The recurring_expenses schedule that generated this expense (empty = entered by hand). */
	recurring: string;
	created: string;
	updated: string;
}

export type RecurrenceFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

/** A schedule that materialises a normal Expense record each time a charge comes due. */
export interface RecurringExpense {
	id: string;
	description: string;
	amount: number;
	gst_paid: number;
	category: ExpenseCategory | '';
	business_use_percent: number;
	notes: string;
	frequency: RecurrenceFrequency;
	/** First charge date; later charges keep its day of month (clamped to short months). */
	start_date: string;
	/** Last charge date, inclusive (empty = runs indefinitely). */
	end_date: string;
	/** Date of the most recent charge created. Charges up to here are never recreated, so deleting one sticks. */
	last_generated: string;
	created: string;
	updated: string;
}

export type TaxPaymentType = 'income_tax' | 'gst';

export interface TaxPayment {
	id: string;
	type: TaxPaymentType;
	amount: number;
	payment_date: string;
	notes: string;
	/**
	 * The period this payment is for — "2026" (income tax / annual GST), "2026-Q3" or "2026-07".
	 * Empty on older records; those count toward the year of payment_date.
	 */
	period: string;
	created: string;
	updated: string;
}

export type GstFilingFrequency = 'monthly' | 'quarterly' | 'annual';

export interface ChartPeriod {
	period: string; // e.g. "2024"
	invoiced: number;
	paid: number;
	/** Total of draft (not yet issued) invoices — shown as pipeline, excluded from revenue totals. */
	draft: number;
}

export interface DashboardStats {
	outstanding: number;
	overdueTotal: number;
	paidThisMonth: number;
	paidYTD: number;
	recentInvoices: (Invoice & { expand: { client: Client }; total: number })[];
	overdueInvoices: (Invoice & { expand: { client: Client }; total: number })[];
	chartData: ChartPeriod[];       // yearly, e.g. "2024"
	chartDataByMonth: ChartPeriod[]; // monthly, e.g. "2024-03"
}

export interface Backup {
	key: string;
	size: number;
	modified: string; // ISO date string
}

export type EstimateStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';

export interface Estimate {
	id: string;
	client: string;
	expand?: { client?: Client };
	number: string;
	/** Optional one-line description; copied to the invoice on conversion. */
	subject?: string;
	issue_date: string;
	expiry_date: string;
	status: EstimateStatus;
	tax_percent: number;
	notes: string;
	/** ID of the invoice created from this estimate, if any. */
	invoice?: string;
	created: string;
	updated: string;
}

export interface EstimateItem {
	id: string;
	estimate: string;
	description: string;
	quantity: number;
	unit_price: number;
	created: string;
	updated: string;
}

export type EstimateLogAction =
	| 'status_changed'
	| 'note'
	| 'edited'
	| 'email_sent'
	| 'estimate_created'
	| 'converted_to_invoice';

export interface EstimateLog {
	id: string;
	estimate: string;
	action: EstimateLogAction;
	detail: string;
	occurred_at: string;
	created: string;
}
