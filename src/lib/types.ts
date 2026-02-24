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

export type PaymentTerms = 'upon_receipt' | 'net_15' | 'net_30' | 'net_45' | 'net_60' | 'custom' | '';

export interface Invoice {
	id: string;
	client: string;
	expand?: { client?: Client };
	number: string;
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

export type TaxPaymentType = 'income_tax' | 'gst';

export interface TaxPayment {
	id: string;
	type: TaxPaymentType;
	amount: number;
	payment_date: string;
	notes: string;
	created: string;
	updated: string;
}

export interface ChartPeriod {
	period: string; // e.g. "2024"
	invoiced: number;
	paid: number;
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
