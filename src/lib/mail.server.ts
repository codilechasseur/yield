/**
 * Server-only mail utility.
 * Reads SMTP configuration from the `settings` PocketBase collection,
 * generates a PDF with Puppeteer, and sends it via nodemailer.
 */
import nodemailer from 'nodemailer';
import puppeteer from 'puppeteer';
import type PocketBase from 'pocketbase';
import type { Invoice, InvoiceItem, Client } from './types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SmtpSettings {
	id?: string;
	smtp_host: string;
	smtp_port: number;
	smtp_user: string;
	smtp_pass: string;
	smtp_from_name: string;
	smtp_from_email: string;
	smtp_secure: boolean;
	default_tax_percent?: number;
	income_tax_rate?: number;
	invoice_default_notes?: string;
	invoice_footer?: string;
	company_name?: string;
	company_address?: string;
	brand_hue?: number;
	default_currency?: string;
	/** Subject line template. Supports {invoice_number}, {client_name}, {company_name}. */
	email_subject?: string;
	/** Body template. Supports {invoice_number}, {client_name}, {total}, {due_date}, {issue_date}, {company_name}. */
	email_body?: string;
	/** scrypt hash of the app password. Empty = no auth required. */
	app_password_hash?: string;
	/** Invoice number format template, e.g. "INV-{number}". Use {number} as the placeholder. */
	invoice_number_format?: string;
	/** The next invoice number to use when creating an invoice. Auto-increments after each creation. */
	invoice_next_number?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtCurrency(amount: number, currency = 'USD'): string {
	return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

function fmtDate(d: string): string {
	if (!d) return '—';
	return new Date(d).toLocaleDateString('en-US', {
		month: 'long',
		day: 'numeric',
		year: 'numeric'
	});
}

/** Build OKLCH-based color palette from a hue value (0–360). */
function palette(hue: number) {
	const h = hue;
	return {
		accent:       `oklch(0.58 0.15 ${h})`,   // used only for the top bar + accent dot
		fg:           `oklch(0.10 0.010 ${h})`,
		mutedFg:      `oklch(0.48 0.010 ${h})`,
		subtleFg:     `oklch(0.64 0.007 ${h})`,
		bg:           `#ffffff`,
		border:       `oklch(0.88 0.006 ${h})`,
		borderLight:  `oklch(0.93 0.004 ${h})`,
		muted:        `oklch(0.965 0.003 ${h})`,
		// status badges — neutral tones, color only for paid/overdue
		draftBg:   `oklch(0.930 0.004 ${h})`,  draftFg: `oklch(0.38 0.012 ${h})`,
		sentBg:    `oklch(0.930 0.004 ${h})`,  sentFg:  `oklch(0.32 0.012 ${h})`,
		paidBg:    `oklch(0.915 0.08  145)`,   paidFg:  `oklch(0.30 0.16  145)`,
		overdueBg: `oklch(0.930 0.06  20)`,    overdueFg:`oklch(0.38 0.18  20)`,
	};
}

function statusBadgeStyle(status: string, c: ReturnType<typeof palette>): string {
	const map: Record<string, { bg: string; fg: string }> = {
		draft:   { bg: c.draftBg,   fg: c.draftFg },
		sent:    { bg: c.sentBg,    fg: c.sentFg },
		paid:    { bg: c.paidBg,    fg: c.paidFg },
		overdue: { bg: c.overdueBg, fg: c.overdueFg },
	};
	const colors = map[status] ?? { bg: c.draftBg, fg: c.draftFg };
	return `background:${colors.bg};color:${colors.fg};padding:4px 14px;border-radius:9999px;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;`;
}

export function buildInvoiceHtml(
	invoice: Invoice & { expand?: { client?: Client } },
	items: InvoiceItem[],
	client: Client | null,
	opts?: { invoiceFooter?: string; companyName?: string; companyAddress?: string; defaultNotes?: string; brandHue?: number }
): string {
	const hue = opts?.brandHue || 250;
	const c = palette(hue);
	const currency = client?.currency ?? 'USD';
	const companyName = opts?.companyName || 'Invoice';
	const companyAddress = opts?.companyAddress || '';
	const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
	const taxAmt = subtotal * (invoice.tax_percent / 100);
	const total = subtotal + taxAmt;

	const paidAmt = (invoice as Invoice & { paid_amount?: number }).paid_amount ?? 0;
	const remaining = Math.round((total - paidAmt) * 100) / 100;

	// ── Label / value helpers ──────────────────────────────────────────────
	const lbl = `font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:0.10em;color:${c.subtleFg};margin-bottom:5px;`;
	const val = `font-size:13px;font-weight:500;color:${c.fg};line-height:1.4;`;

	// ── Item rows ──────────────────────────────────────────────────────────
	const itemRows = items.map((i, idx) => {
		const rowBg = idx % 2 === 1 ? `background:${c.muted};` : '';
		return `
    <tr style="${rowBg}">
      <td style="padding:12px 28px 12px 24px;font-size:13px;color:${c.fg};border-bottom:1px solid ${c.borderLight};">${i.description || '—'}</td>
      <td style="padding:12px 16px;font-size:13px;color:${c.mutedFg};text-align:right;border-bottom:1px solid ${c.borderLight};${rowBg}">${i.quantity}</td>
      <td style="padding:12px 16px;font-size:13px;color:${c.mutedFg};text-align:right;border-bottom:1px solid ${c.borderLight};${rowBg}">${fmtCurrency(i.unit_price, currency)}</td>
      <td style="padding:12px 24px 12px 16px;font-size:13px;color:${c.fg};text-align:right;border-bottom:1px solid ${c.borderLight};font-weight:500;${rowBg}">${fmtCurrency(i.quantity * i.unit_price, currency)}</td>
    </tr>`;
	}).join('');

	// ── Totals block rows ──────────────────────────────────────────────────
	const rowLineStyle = `display:flex;justify-content:space-between;align-items:baseline;`;
	const subtotalRow = `<div style="${rowLineStyle}margin-bottom:8px;">
      <span style="font-size:12.5px;color:${c.mutedFg};">Subtotal</span>
      <span style="font-size:12.5px;color:${c.mutedFg};">${fmtCurrency(subtotal, currency)}</span>
    </div>`;
	const taxRow = invoice.tax_percent > 0
		? `<div style="${rowLineStyle}margin-bottom:8px;">
        <span style="font-size:12.5px;color:${c.mutedFg};">Tax (${invoice.tax_percent}%)</span>
        <span style="font-size:12.5px;color:${c.mutedFg};">${fmtCurrency(taxAmt, currency)}</span>
      </div>` : '';
	const partialRow = paidAmt > 0 && invoice.status !== 'paid'
		? `<div style="${rowLineStyle}margin-top:10px;margin-bottom:6px;">
          <span style="font-size:12.5px;color:${c.mutedFg};">Paid</span>
          <span style="font-size:12.5px;color:${c.mutedFg};">${fmtCurrency(paidAmt, currency)}</span>
        </div>
        <div style="${rowLineStyle}">
          <span style="font-size:13px;font-weight:600;color:${c.fg};">Balance Due</span>
          <span style="font-size:13px;font-weight:600;color:${c.fg};">${fmtCurrency(remaining, currency)}</span>
        </div>` : '';

	// ── Meta columns ─────────────────────────────────────────────────────
	const statusLabel = invoice.status.replace(/_/g, ' ').replace(/\b\w/g, (ch: string) => ch.toUpperCase());
	const metaHtml = `
    <div>
      <p style="${lbl}">Status</p>
      <span style="${statusBadgeStyle(invoice.status, c)}">${statusLabel}</span>
    </div>`;

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice ${invoice.number}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: ${c.fg};
      background: ${c.bg};
      font-size: 14px;
      line-height: 1.55;
      -webkit-font-smoothing: antialiased;
      font-synthesis: none;
    }
    @page { size: A4; margin: 0; }
    table { width: 100%; border-collapse: collapse; }
  </style>
</head>
<body>

  <!-- ═══ ACCENT TOP BAR ═══════════════════════════════════════════════ -->
  <div style="height:4px;background:${c.accent};"></div>

  <!-- ═══ HEADER ═══════════════════════════════════════════════════════ -->
  <div style="padding:36px 44px 30px;display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid ${c.border};">
    <!-- Company -->
    <div>
      <p style="font-size:20px;font-weight:700;color:${c.fg};letter-spacing:-0.3px;line-height:1.1;">${companyName}</p>
      ${companyAddress ? `<p style="font-size:11px;color:${c.mutedFg};margin-top:5px;white-space:pre-line;line-height:1.6;">${companyAddress}</p>` : ''}
    </div>
    <!-- Invoice label + number + issue date -->
    <div style="text-align:right;">
      <p style="font-size:10px;font-weight:600;color:${c.subtleFg};letter-spacing:0.14em;text-transform:uppercase;margin-bottom:4px;">Invoice</p>
      <p style="font-size:17px;font-weight:600;color:${c.fg};letter-spacing:0.01em;">${invoice.number}</p>
      ${invoice.issue_date ? `<p style="font-size:11px;color:${c.mutedFg};margin-top:6px;">Issued ${fmtDate(invoice.issue_date)}</p>` : ''}
    </div>
  </div>

  <!-- ═══ BODY ══════════════════════════════════════════════════════════ -->
  <div style="padding:36px 44px 0;">

    <!-- Billed-to + Due Date + Meta row -->
    <div style="display:flex;gap:36px;margin-bottom:40px;">
      <!-- Billed To -->
      <div style="flex:2;min-width:0;">
        <p style="${lbl}">Billed To</p>
        ${client
          ? `<p style="font-size:14px;font-weight:600;color:${c.fg};line-height:1.35;">${client.name}</p>
             ${client.email    ? `<p style="font-size:12px;color:${c.mutedFg};margin-top:3px;">${client.email}</p>` : ''}
             ${client.address  ? `<p style="font-size:12px;color:${c.mutedFg};margin-top:5px;white-space:pre-line;line-height:1.6;">${client.address}</p>` : ''}`
          : `<p style="color:${c.mutedFg};">—</p>`}
      </div>
      <!-- Due Date -->
      <div style="flex:1;min-width:0;">
        <p style="${lbl}">Due Date</p>
        <span style="${val}">${fmtDate(invoice.due_date)}</span>
      </div>
      <!-- Status -->
      <div style="flex:1;min-width:0;display:grid;grid-template-columns:1fr;gap:28px;align-content:start;">
        ${metaHtml}
      </div>
    </div>

    <!-- ── Line items table ── -->
    <div style="border:1px solid ${c.border};">

      <table>
        <thead>
          <tr style="background:${c.muted};">
            <th style="padding:10px 24px;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:0.10em;color:${c.subtleFg};text-align:left;border-bottom:1px solid ${c.border};">Description</th>
            <th style="padding:10px 16px;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:0.10em;color:${c.subtleFg};text-align:right;border-bottom:1px solid ${c.border};">Qty</th>
            <th style="padding:10px 16px;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:0.10em;color:${c.subtleFg};text-align:right;border-bottom:1px solid ${c.border};">Unit Price</th>
            <th style="padding:10px 24px 10px 16px;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:0.10em;color:${c.subtleFg};text-align:right;border-bottom:1px solid ${c.border};">Amount</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <!-- Totals -->
      <div style="display:flex;justify-content:flex-end;background:${c.muted};">
        <div style="width:280px;padding:18px 24px 18px 20px;">
          ${subtotalRow}
          ${taxRow}
          <div style="height:1px;background:${c.border};margin:8px 0 10px;"></div>
          <div style="${rowLineStyle}margin-bottom:0;">
            <span style="font-size:13.5px;font-weight:600;color:${c.fg};">Total</span>
            <span style="font-size:13.5px;font-weight:600;color:${c.fg};">${fmtCurrency(total, currency)}</span>
          </div>
          ${partialRow}
        </div>
      </div>

      <!-- Amount Due strip -->
      <div style="border-top:1px solid ${c.border};padding:16px 24px;display:flex;justify-content:space-between;align-items:center;background:${c.bg};">
        <span style="font-size:10px;font-weight:600;color:${c.subtleFg};letter-spacing:0.12em;text-transform:uppercase;">${paidAmt > 0 && invoice.status !== 'paid' ? 'Balance Due' : 'Amount Due'}</span>
        <span style="font-size:20px;font-weight:700;color:${c.fg};letter-spacing:-0.3px;">${fmtCurrency(paidAmt > 0 && invoice.status !== 'paid' ? remaining : total, currency)}</span>
      </div>

    </div><!-- /table block -->

  </div><!-- /body pad -->

  <!-- ═══ NOTES / FOOTER ═══════════════════════════════════════════════ -->
  <div style="padding:0 44px 100px;">
    ${invoice.notes || opts?.defaultNotes ? `
    <div style="margin-top:28px;padding:16px 20px;border:1px solid ${c.borderLight};">
      <p style="${lbl}margin-bottom:6px;">Notes</p>
      <p style="font-size:12.5px;color:${c.mutedFg};white-space:pre-line;line-height:1.7;">${invoice.notes || opts?.defaultNotes}</p>
    </div>` : ''}

    ${opts?.invoiceFooter ? `
    <div style="margin-top:${invoice.notes || opts?.defaultNotes ? '20px' : '28px'};padding-top:0;">
      <p style="font-size:10px;color:${c.subtleFg};white-space:pre-line;line-height:1.75;">${opts.invoiceFooter}</p>
    </div>` : ''}
  </div>

  <!-- ═══ PAGE FOOTER ══════════════════════════════════════════════════ -->
  <div style="position:fixed;bottom:0;left:0;right:0;background:${c.muted};border-top:1px solid ${c.border};padding:10px 44px;display:flex;justify-content:space-between;align-items:center;">
    <p style="font-size:10px;color:${c.subtleFg};font-weight:500;">${companyName}</p>
    <p style="font-size:10px;color:${c.subtleFg};font-weight:500;">${invoice.number}</p>
  </div>

</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Load (or return defaults for) SMTP settings from PocketBase. */
export async function getSmtpSettings(pb: PocketBase): Promise<SmtpSettings | null> {
	try {
		const list = await pb.collection('settings').getList(1, 1);
		if (list.items.length === 0) return null;
		const r = list.items[0];
		return {
			id: r.id,
			smtp_host: r.smtp_host ?? '',
			smtp_port: r.smtp_port ?? 587,
			smtp_user: r.smtp_user ?? '',
			smtp_pass: r.smtp_pass ?? '',
			smtp_from_name: r.smtp_from_name ?? '',
			smtp_from_email: r.smtp_from_email ?? '',
			smtp_secure: r.smtp_secure ?? false,
			default_tax_percent: r.default_tax_percent ?? 5,
			income_tax_rate: r.income_tax_rate ?? 0,
			invoice_default_notes: r.invoice_default_notes ?? '',
			invoice_footer: r.invoice_footer ?? '',
			company_name: r.company_name ?? '',
			company_address: r.company_address ?? '',
			brand_hue: r.brand_hue || 250,
			default_currency: r.default_currency ?? '',
			email_subject: r.email_subject ?? '',
			email_body: r.email_body ?? '',
			app_password_hash: r.app_password_hash ?? ''
		};
	} catch {
		return null;
	}
}

/**
 * Default email templates used when none are configured in Settings.
 */
export const DEFAULT_EMAIL_SUBJECT = 'Invoice {invoice_number}';
export const DEFAULT_EMAIL_BODY =
	`Hi {client_name},

Please find attached invoice {invoice_number} for {total}.

{due_date_line}Thank you for your business.`;

/**
 * Replace {placeholder} tokens in a template string.
 */
export function interpolateEmailTemplate(
	template: string,
	vars: Record<string, string>
): string {
	return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
}

interface SendInvoiceEmailOptions {
	pb: PocketBase;
	invoiceId: string;
	toEmail: string;
	toName: string;
	/** Extra message body written above the PDF note. */
	message?: string;
}

/**
 * Generate a PDF for the given invoice and email it as an attachment.
 * Throws on configuration or send error.
 */
export async function sendInvoiceEmail({
	pb,
	invoiceId,
	toEmail,
	toName,
	message
}: SendInvoiceEmailOptions): Promise<void> {
	// 1. Load SMTP settings
	const smtp = await getSmtpSettings(pb);
	if (!smtp || !smtp.smtp_host) {
		throw new Error('SMTP is not configured. Go to Settings → Email to set it up.');
	}
	if (!smtp.smtp_from_email) {
		throw new Error('SMTP "from" email is not configured.');
	}

	// 2. Load invoice data
	const [invoice, items] = await Promise.all([
		pb
			.collection('invoices')
			.getOne<Invoice & { expand?: { client?: Client } }>(invoiceId, { expand: 'client' }),
		pb
			.collection('invoice_items')
			.getFullList<InvoiceItem>({ filter: `invoice = "${invoiceId}"`, sort: 'created' })
	]);
	const client = invoice.expand?.client ?? null;

	// 3. Generate PDF
	const html = buildInvoiceHtml(invoice, items, client, {
		invoiceFooter: smtp.invoice_footer,
		companyName: smtp.company_name || smtp.smtp_from_name || undefined,
		companyAddress: smtp.company_address || undefined,
		defaultNotes: smtp.invoice_default_notes || undefined,
		brandHue: smtp.brand_hue || 250
	});
	let pdfBuffer: Buffer;

	const browser = await puppeteer.launch({
		headless: true,
		args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
	});
	try {
		const page = await browser.newPage();
		await page.setContent(html, { waitUntil: 'networkidle0' });
		const raw = await page.pdf({ format: 'A4', printBackground: true });
		pdfBuffer = Buffer.from(raw);
	} finally {
		await browser.close();
	}

	// 4. Build email
	const fromField = smtp.smtp_from_name
		? `"${smtp.smtp_from_name}" <${smtp.smtp_from_email}>`
		: smtp.smtp_from_email;

	const currency = client?.currency ?? 'USD';
	const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
	const total = subtotal * (1 + invoice.tax_percent / 100);

	const companyName = smtp.company_name || smtp.smtp_from_name || '';
	const vars: Record<string, string> = {
		invoice_number: invoice.number,
		client_name: toName || (client?.name ?? ''),
		total: fmtCurrency(total, currency),
		due_date: fmtDate(invoice.due_date),
		issue_date: fmtDate(invoice.issue_date),
		company_name: companyName,
		due_date_line: invoice.due_date ? `Due date: ${fmtDate(invoice.due_date)}\n\n` : ''
	};

	// Subject — use configured template or fall back to default
	const subjectTemplate = smtp.email_subject?.trim() || DEFAULT_EMAIL_SUBJECT;
	const subject = interpolateEmailTemplate(subjectTemplate, vars);

	// Body — if caller supplies a custom message use it verbatim,
	// otherwise render the settings template (or fall back to default)
	const bodyText = message
		? message
		: interpolateEmailTemplate(smtp.email_body?.trim() || DEFAULT_EMAIL_BODY, vars);

	// Plain-text → minimal HTML (preserve line breaks)
	const bodyHtml = bodyText
		.split('\n')
		.map((line) => (line.trim() === '' ? '<br>' : `<p style="margin:0 0 4px">${line}</p>`))
		.join('\n');

	// 5. Send
	const transporter = nodemailer.createTransport({
		host: smtp.smtp_host,
		port: smtp.smtp_port,
		secure: smtp.smtp_secure,
		auth: smtp.smtp_user ? { user: smtp.smtp_user, pass: smtp.smtp_pass } : undefined
	});

	await transporter.sendMail({
		from: fromField,
		to: toEmail,
		subject,
		text: bodyText,
		html: bodyHtml,
		attachments: [
			{
				filename: `invoice-${invoice.number}.pdf`,
				content: pdfBuffer,
				contentType: 'application/pdf'
			}
		]
	});
}
