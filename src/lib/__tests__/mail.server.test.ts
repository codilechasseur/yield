import { describe, it, expect, vi, beforeEach } from 'vitest';
import nodemailerActual from 'nodemailer';
import puppeteerActual from 'puppeteer';

// Provide mock env before importing the module under test
vi.mock('$env/dynamic/private', () => ({ env: { PB_URL: 'http://pb.test:8090' } }));
// Avoid loading real nodemailer/puppeteer transports in tests
vi.mock('nodemailer', () => ({ default: { createTransport: vi.fn() } }));
vi.mock('puppeteer', () => ({ default: { launch: vi.fn() } }));

import { buildLogoUrl, buildInvoiceHtml, getSmtpSettings, sendInvoiceEmail } from '../mail.server.js';
import type { Invoice, InvoiceItem, Client } from '../types.js';

// ── Minimal fixtures ─────────────────────────────────────────────────────────

const baseInvoice: Invoice = {
	id: 'inv1',
	number: 'INV-001',
	client: 'cli1',
	issue_date: '2025-01-01',
	due_date: '2025-01-31',
	payment_terms: 'net_30',
	status: 'draft',
	tax_percent: 0,
	paid_amount: 0,
	notes: '',
	created: '2025-01-01T00:00:00Z',
	updated: '2025-01-01T00:00:00Z'
};

const baseClient: Client = {
	id: 'cli1',
	name: 'Acme Corp',
	email: 'billing@acme.com',
	address: '123 Main St',
	currency: 'USD',
	harvest_id: '',
	archived: false,
	created: '2025-01-01T00:00:00Z',
	updated: '2025-01-01T00:00:00Z'
};

const baseItems: InvoiceItem[] = [
	{
		id: 'item1',
		invoice: 'inv1',
		description: 'Design work',
		quantity: 2,
		unit_price: 500,
		created: '2025-01-01T00:00:00Z',
		updated: '2025-01-01T00:00:00Z'
	}
];

// ── buildLogoUrl ─────────────────────────────────────────────────────────────

describe('buildLogoUrl', () => {
	it('builds a correct URL from valid parts', () => {
		const url = buildLogoUrl('http://localhost:8090', 'abc123', 'logo.png');
		expect(url).toBe('http://localhost:8090/api/files/yieldsetts01/abc123/logo.png');
	});

	it('strips a trailing slash from the PocketBase URL', () => {
		const url = buildLogoUrl('http://localhost:8090/', 'abc123', 'logo.png');
		expect(url).toBe('http://localhost:8090/api/files/yieldsetts01/abc123/logo.png');
	});

	it('returns empty string when logo filename is empty', () => {
		expect(buildLogoUrl('http://localhost:8090', 'abc123', '')).toBe('');
	});

	it('returns empty string when logo filename is undefined', () => {
		expect(buildLogoUrl('http://localhost:8090', 'abc123', undefined)).toBe('');
	});

	it('returns empty string when settingsId is empty', () => {
		expect(buildLogoUrl('http://localhost:8090', '', 'logo.png')).toBe('');
	});

	it('falls back to localhost URL when pbUrl is empty', () => {
		const url = buildLogoUrl('', 'abc123', 'logo.png');
		expect(url).toBe('http://localhost:8090/api/files/yieldsetts01/abc123/logo.png');
	});
});

// ── buildInvoiceHtml – logo rendering ────────────────────────────────────────

describe('buildInvoiceHtml logo rendering', () => {
	it('does not include an <img> tag when no logoUrl is provided', () => {
		const html = buildInvoiceHtml(baseInvoice, baseItems, baseClient, {
			companyName: 'Acme'
		});
		expect(html).not.toContain('<img');
	});

	it('includes an <img> tag when logoUrl is provided', () => {
		const html = buildInvoiceHtml(baseInvoice, baseItems, baseClient, {
			companyName: 'Acme',
			logoUrl: 'http://pb.test/api/files/yieldsetts01/s1/logo.png'
		});
		expect(html).toContain('<img');
		expect(html).toContain('http://pb.test/api/files/yieldsetts01/s1/logo.png');
	});

	it('uses the companyName as alt text in the logo img', () => {
		const html = buildInvoiceHtml(baseInvoice, baseItems, baseClient, {
			companyName: 'My Brand',
			logoUrl: 'http://pb.test/logo.png'
		});
		expect(html).toContain('alt="My Brand logo"');
	});

	it('does not include <img> when logoUrl is an empty string', () => {
		const html = buildInvoiceHtml(baseInvoice, baseItems, baseClient, {
			companyName: 'Acme',
			logoUrl: ''
		});
		expect(html).not.toContain('<img');
	});

	it('still renders invoice number in generated HTML', () => {
		const html = buildInvoiceHtml(baseInvoice, baseItems, baseClient, {});
		expect(html).toContain('INV-001');
	});

	it('shows company name by default', () => {
		const html = buildInvoiceHtml(baseInvoice, baseItems, baseClient, {
			companyName: 'ACME Ltd',
			logoUrl: 'http://pb.test/logo.png'
		});
		expect(html).toContain('ACME Ltd');
	});

	it('hides company name text when hideCompanyName is true', () => {
		const html = buildInvoiceHtml(baseInvoice, baseItems, baseClient, {
			companyName: 'ACME Ltd',
			logoUrl: 'http://pb.test/logo.png',
			hideCompanyName: true
		});
		// The <p> with the company name should not appear…
		expect(html).not.toContain('<p style="font-size:20px');
		// …but the logo img should still be there
		expect(html).toContain('<img');
	});

	it('still shows company name in page footer even when hideCompanyName is true', () => {
		const html = buildInvoiceHtml(baseInvoice, baseItems, baseClient, {
			companyName: 'ACME Ltd',
			logoUrl: 'http://pb.test/logo.png',
			hideCompanyName: true
		});
		// Footer always shows company name
		expect(html).toContain('ACME Ltd');
	});
});

// ── getSmtpSettings – smtp_port fallback ─────────────────────────────────────

function makePb(items: Record<string, unknown>[]) {
	return {
		collection: () => ({ getList: async () => ({ items }) })
	} as unknown as import('pocketbase').default;
}

describe('getSmtpSettings', () => {
	it('returns null when no settings record exists', async () => {
		const result = await getSmtpSettings(makePb([]));
		expect(result).toBeNull();
	});

	it('defaults smtp_port to 587 when the stored value is 0', async () => {
		const result = await getSmtpSettings(makePb([{ id: 's1', smtp_port: 0 }]));
		expect(result?.smtp_port).toBe(587);
	});

	it('preserves a valid smtp_port from the database', async () => {
		const result = await getSmtpSettings(makePb([{ id: 's1', smtp_port: 465 }]));
		expect(result?.smtp_port).toBe(465);
	});

	it('defaults smtp_port to 587 when the stored value is null/undefined', async () => {
		const result = await getSmtpSettings(makePb([{ id: 's1', smtp_port: null }]));
		expect(result?.smtp_port).toBe(587);
	});
});

// ── sendInvoiceEmail – recipient addressing ───────────────────────────────────

function makeSendMailPb() {
	const smtpRecord = {
		id: 'sett1',
		smtp_host: 'smtp.example.com',
		smtp_port: 587,
		smtp_user: 'user',
		smtp_pass: 'pass',
		smtp_from_email: 'from@example.com',
		smtp_from_name: 'Sender',
		smtp_secure: false
	};
	const invoice = {
		...baseInvoice,
		expand: { client: baseClient }
	};
	return {
		collection: (name: string) => ({
			getOne: async () => invoice,
			getFullList: async () => baseItems,
			getList: async () => ({ items: name === 'settings' ? [smtpRecord] : [] })
		})
	} as unknown as import('pocketbase').default;
}

describe('sendInvoiceEmail', () => {
	let sendMailSpy: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		// Set up puppeteer mock: browser → page → setContent/pdf
		const pageMock = {
			setContent: vi.fn().mockResolvedValue(undefined),
			pdf: vi.fn().mockResolvedValue(Buffer.from('PDF'))
		};
		const browserMock = {
			newPage: vi.fn().mockResolvedValue(pageMock),
			close: vi.fn().mockResolvedValue(undefined)
		};
		vi.mocked(puppeteerActual.launch).mockResolvedValue(browserMock as any);

		// Set up nodemailer mock: transporter.sendMail resolves
		sendMailSpy = vi.fn().mockResolvedValue({});
		vi.mocked(nodemailerActual.createTransport).mockReturnValue({ sendMail: sendMailSpy } as any);
	});

	it('sends to a single email string directly', async () => {
		const pb = makeSendMailPb();
		await sendInvoiceEmail({ pb, invoiceId: 'inv1', toEmail: 'a@example.com', toName: 'Alice' });
		expect(sendMailSpy).toHaveBeenCalledOnce();
		expect(sendMailSpy.mock.calls[0][0].to).toBe('a@example.com');
	});

	it('joins an array of emails with ", " for the to field', async () => {
		const pb = makeSendMailPb();
		await sendInvoiceEmail({
			pb,
			invoiceId: 'inv1',
			toEmail: ['a@example.com', 'b@example.com', 'c@example.com'],
			toName: 'Alice'
		});
		expect(sendMailSpy).toHaveBeenCalledOnce();
		expect(sendMailSpy.mock.calls[0][0].to).toBe('a@example.com, b@example.com, c@example.com');
	});

	it('sends to a single-element array correctly', async () => {
		const pb = makeSendMailPb();
		await sendInvoiceEmail({ pb, invoiceId: 'inv1', toEmail: ['solo@example.com'], toName: 'Solo' });
		expect(sendMailSpy.mock.calls[0][0].to).toBe('solo@example.com');
	});

	it('attaches a PDF with the correct filename', async () => {
		const pb = makeSendMailPb();
		await sendInvoiceEmail({ pb, invoiceId: 'inv1', toEmail: 'x@example.com', toName: 'X' });
		const attachments = sendMailSpy.mock.calls[0][0].attachments as Array<{ filename: string }>;
		expect(attachments[0].filename).toBe(`invoice-${baseInvoice.number}.pdf`);
	});
});
