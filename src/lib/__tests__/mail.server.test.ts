import { describe, it, expect, vi, beforeEach } from 'vitest';
import nodemailerActual from 'nodemailer';
import puppeteerActual from 'puppeteer';
import PocketBase from 'pocketbase';

// Provide mock env before importing the module under test
vi.mock('$env/dynamic/private', () => ({ env: { PB_URL: 'http://pb.test:8090' } }));
// Avoid loading real nodemailer/puppeteer transports in tests
vi.mock('nodemailer', () => ({ default: { createTransport: vi.fn() } }));
vi.mock('puppeteer', () => ({ default: { launch: vi.fn() } }));

import { buildLogoUrl, buildInvoiceHtml, buildEstimateHtml, DEFAULT_ESTIMATE_EMAIL_SUBJECT, getSmtpSettings, sendInvoiceEmail, subjectVars, interpolateEmailTemplate, DEFAULT_EMAIL_SUBJECT, fromAddress, emailBodyHtml } from '../mail.server.js';
import type { Invoice, InvoiceItem, Client, Estimate, EstimateItem } from '../types.js';

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

describe('buildInvoiceHtml subject rendering', () => {
	it('renders the subject when set', () => {
		const html = buildInvoiceHtml({ ...baseInvoice, subject: 'Retainer for Acme — August 2026' }, baseItems, baseClient);
		expect(html).toContain('Retainer for Acme — August 2026');
	});

	it('omits the subject block when empty or whitespace', () => {
		expect(buildInvoiceHtml({ ...baseInvoice, subject: '' }, baseItems, baseClient)).not.toContain('<!-- Subject -->');
		expect(buildInvoiceHtml({ ...baseInvoice, subject: '   ' }, baseItems, baseClient)).not.toContain('<!-- Subject -->');
		expect(buildInvoiceHtml(baseInvoice, baseItems, baseClient)).not.toContain('<!-- Subject -->');
	});

	it('escapes HTML in the subject', () => {
		const html = buildInvoiceHtml({ ...baseInvoice, subject: '<b>R&D</b>' }, baseItems, baseClient);
		expect(html).toContain('&lt;b&gt;R&amp;D&lt;/b&gt;');
		expect(html).not.toContain('<b>R&D</b>');
	});
});

describe('buildEstimateHtml subject rendering', () => {
	const estimate: Estimate = {
		id: 'est1', client: 'cli1', number: 'EST-001', issue_date: '2025-01-01', expiry_date: '2025-02-01',
		status: 'draft', tax_percent: 0, notes: '', created: '', updated: ''
	};
	const items: EstimateItem[] = [
		{ id: 'e1', estimate: 'est1', description: 'Design', quantity: 1, unit_price: 100, created: '', updated: '' }
	];

	it('renders the subject when set', () => {
		expect(buildEstimateHtml({ ...estimate, subject: 'Phase 2' }, items, baseClient)).toContain('Phase 2');
	});

	it('omits the subject block when empty', () => {
		expect(buildEstimateHtml(estimate, items, baseClient)).not.toContain('<!-- Subject -->');
	});
});

// ── subjectVars ───────────────────────────────────────────────────────

describe('subjectVars', () => {
	it('returns the subject and an em-dash suffix when set', () => {
		expect(subjectVars('August retainer')).toEqual({ subject: 'August retainer', subject_suffix: ' — August retainer' });
	});

	it('trims surrounding whitespace', () => {
		expect(subjectVars('  August retainer  ').subject).toBe('August retainer');
	});

	it('returns empty strings for empty, whitespace, null and undefined', () => {
		for (const v of ['', '   ', null, undefined]) {
			expect(subjectVars(v)).toEqual({ subject: '', subject_suffix: '' });
		}
	});

	it('produces a clean default email subject with and without a subject', () => {
		const vars = (subject?: string) => ({ invoice_number: '654', ...subjectVars(subject) });
		expect(interpolateEmailTemplate(DEFAULT_EMAIL_SUBJECT, vars('Retainer for August 2026'))).toBe('Invoice 654 — Retainer for August 2026');
		expect(interpolateEmailTemplate(DEFAULT_EMAIL_SUBJECT, vars())).toBe('Invoice 654');
	});

	it('produces a clean default estimate email subject with and without a subject', () => {
		const vars = (subject?: string) => ({ estimate_number: 'EST-9', ...subjectVars(subject) });
		expect(interpolateEmailTemplate(DEFAULT_ESTIMATE_EMAIL_SUBJECT, vars('Phase 2'))).toBe('Estimate EST-9 — Phase 2');
		expect(interpolateEmailTemplate(DEFAULT_ESTIMATE_EMAIL_SUBJECT, vars())).toBe('Estimate EST-9');
	});
});

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

	it('returns default_hourly_rate from the database record', async () => {
		const result = await getSmtpSettings(makePb([{ id: 's1', default_hourly_rate: 125 }]));
		expect(result?.default_hourly_rate).toBe(125);
	});

	it('defaults default_hourly_rate to 0 when absent', async () => {
		const result = await getSmtpSettings(makePb([{ id: 's1' }]));
		expect(result?.default_hourly_rate).toBe(0);
	});
});

// ── sendInvoiceEmail – recipient addressing ───────────────────────────────────

function makeSendMailPb(settingsOverrides: Record<string, unknown> = {}, invoiceOverrides: Partial<Invoice> = {}) {
	const smtpRecord = {
		id: 'sett1',
		smtp_host: 'smtp.example.com',
		smtp_port: 587,
		smtp_user: 'user',
		smtp_pass: 'pass',
		smtp_from_email: 'from@example.com',
		smtp_from_name: 'Sender',
		smtp_secure: false,
		...settingsOverrides
	};
	const invoice = {
		...baseInvoice,
		...invoiceOverrides,
		expand: { client: baseClient }
	};
	const realPb = new PocketBase('http://pb.test:8090');
	return {
		filter: realPb.filter.bind(realPb),
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
			setJavaScriptEnabled: vi.fn().mockResolvedValue(undefined),
			setRequestInterception: vi.fn().mockResolvedValue(undefined),
			on: vi.fn(),
			setContent: vi.fn().mockResolvedValue(undefined),
			waitForNetworkIdle: vi.fn().mockResolvedValue(undefined),
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

	it('applies the configured From name as a structured address', async () => {
		const pb = makeSendMailPb();
		await sendInvoiceEmail({ pb, invoiceId: 'inv1', toEmail: 'a@example.com', toName: 'Alice' });
		expect(sendMailSpy.mock.calls[0][0].from).toEqual({ name: 'Sender', address: 'from@example.com' });
	});

	it('sets Reply-To when configured', async () => {
		const pb = makeSendMailPb({ smtp_reply_to: 'codi@example.com' });
		await sendInvoiceEmail({ pb, invoiceId: 'inv1', toEmail: 'a@example.com', toName: 'Alice' });
		expect(sendMailSpy.mock.calls[0][0].replyTo).toBe('codi@example.com');
	});

	it('omits Reply-To when not configured', async () => {
		const pb = makeSendMailPb();
		await sendInvoiceEmail({ pb, invoiceId: 'inv1', toEmail: 'a@example.com', toName: 'Alice' });
		expect(sendMailSpy.mock.calls[0][0].replyTo).toBeUndefined();
	});

	it('sets BCC when configured', async () => {
		const pb = makeSendMailPb({ smtp_bcc: 'archive@example.com' });
		await sendInvoiceEmail({ pb, invoiceId: 'inv1', toEmail: 'a@example.com', toName: 'Alice' });
		expect(sendMailSpy.mock.calls[0][0].bcc).toBe('archive@example.com');
	});

	it('omits BCC when not configured', async () => {
		const pb = makeSendMailPb();
		await sendInvoiceEmail({ pb, invoiceId: 'inv1', toEmail: 'a@example.com', toName: 'Alice' });
		expect(sendMailSpy.mock.calls[0][0].bcc).toBeUndefined();
	});

	it('includes the invoice subject in the default email subject', async () => {
		const pb = makeSendMailPb({}, { subject: 'Retainer for August 2026' });
		await sendInvoiceEmail({ pb, invoiceId: 'inv1', toEmail: 'a@example.com', toName: 'Alice' });
		expect(sendMailSpy.mock.calls[0][0].subject).toBe('Invoice INV-001 — Retainer for August 2026');
	});

	it('uses a plain default email subject when the invoice has no subject', async () => {
		const pb = makeSendMailPb();
		await sendInvoiceEmail({ pb, invoiceId: 'inv1', toEmail: 'a@example.com', toName: 'Alice' });
		expect(sendMailSpy.mock.calls[0][0].subject).toBe('Invoice INV-001');
	});

	it('supports {subject} in a custom subject template', async () => {
		const pb = makeSendMailPb({ email_subject: '{subject} ({invoice_number})' }, { subject: 'August retainer' });
		await sendInvoiceEmail({ pb, invoiceId: 'inv1', toEmail: 'a@example.com', toName: 'Alice' });
		expect(sendMailSpy.mock.calls[0][0].subject).toBe('August retainer (INV-001)');
	});

	it('attaches a PDF with the correct filename', async () => {
		const pb = makeSendMailPb();
		await sendInvoiceEmail({ pb, invoiceId: 'inv1', toEmail: 'x@example.com', toName: 'X' });
		const attachments = sendMailSpy.mock.calls[0][0].attachments as Array<{ filename: string }>;
		expect(attachments[0].filename).toBe(`invoice-${baseInvoice.number}.pdf`);
	});
});

describe('HTML escaping in invoice/estimate documents', () => {
	const baseEstimate: Estimate = {
		id: 'est1', client: 'cli1', number: 'EST-001', issue_date: '2025-01-01', expiry_date: '2025-02-01',
		status: 'draft', tax_percent: 0, notes: '', created: '', updated: ''
	};
	const evil = '<img src=x onerror=alert(1)>';
	const evilClient: Client = {
		...baseClient,
		name: `Acme ${evil}`,
		email: `a@example.com${evil}`,
		address: `1 Main St\n${evil}`
	};

	it('escapes client, company and number fields in invoices', () => {
		const html = buildInvoiceHtml(
			{ ...baseInvoice, number: `INV-1${evil}`, notes: `Thanks${evil}` },
			baseItems,
			evilClient,
			{
				companyName: `Co ${evil}`,
				companyAddress: `HQ\n${evil}`,
				invoiceFooter: `Footer ${evil}`,
				logoUrl: 'http://pb.test/logo.png" onload="alert(1)'
			}
		);
		expect(html).not.toContain(evil);
		expect(html).not.toContain('" onload="');
		expect(html).toContain('Acme &lt;img src=x onerror=alert(1)&gt;');
		expect(html).toContain('1 Main St');
	});

	it('sanitizes HTML notes and footers instead of dropping them', () => {
		const html = buildInvoiceHtml(
			{ ...baseInvoice, notes: '<p>Pay by <b>Friday</b></p><script>alert(1)</script>' },
			baseItems,
			baseClient,
			{ invoiceFooter: '<em>Footer</em><iframe src="x"></iframe>' }
		);
		expect(html).toContain('<p>Pay by <b>Friday</b></p>');
		expect(html).toContain('<em>Footer</em>');
		expect(html).not.toContain('<script>alert(1)');
		expect(html).not.toContain('<iframe');
	});

	it('escapes client, company and number fields in estimates', () => {
		const html = buildEstimateHtml(
			{ ...baseEstimate, number: `EST-1${evil}`, notes: evil },
			[],
			evilClient,
			{ companyName: evil, companyAddress: evil, estimateFooter: evil }
		);
		expect(html).not.toContain(evil);
		expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
	});
});

describe('fromAddress', () => {
	it('returns a structured address when a From name is set', () => {
		expect(fromAddress({ smtp_from_name: 'Ann "Boss" <x@evil>', smtp_from_email: 'a@example.com' })).toEqual({
			name: 'Ann "Boss" <x@evil>',
			address: 'a@example.com'
		});
	});

	it('returns the bare email when no From name is set', () => {
		expect(fromAddress({ smtp_from_name: '', smtp_from_email: 'a@example.com' })).toBe('a@example.com');
	});
});

describe('emailBodyHtml', () => {
	it('escapes each line and wraps it in a paragraph', () => {
		expect(emailBodyHtml('Hi <b>Ann</b> & co')).toBe('<p style="margin:0 0 4px">Hi &lt;b&gt;Ann&lt;/b&gt; &amp; co</p>');
	});

	it('turns blank lines into <br>', () => {
		expect(emailBodyHtml('a\n\nb')).toBe('<p style="margin:0 0 4px">a</p>\n<br>\n<p style="margin:0 0 4px">b</p>');
	});

	it('returns a single <br> for an empty body', () => {
		expect(emailBodyHtml('')).toBe('<br>');
	});
});
