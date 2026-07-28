/**
 * Server-only background job: marks sent invoices as overdue once they pass
 * their due date, and (when enabled in settings) emails clients payment
 * reminders on a configurable cadence.
 */
import PocketBase from 'pocketbase';
import nodemailer from 'nodemailer';
import { env } from '$env/dynamic/private';
import { getSmtpSettings } from './mail.server.js';
import { pushServerError } from './server-error-log.server.js';
import type { Client, Invoice, InvoiceItem, InvoiceLog } from './types.js';

const SWEEP_INTERVAL_MS = 12 * 60 * 60 * 1000; // twice a day
const INITIAL_DELAY_MS = 30_000; // let PocketBase come up first on boot
/** Marker embedded in invoice_logs detail so we can find the last reminder sent. */
const REMINDER_MARKER = 'Payment reminder sent to';
/** Don't email about invoices due further back than this — protects against
 * blasting clients about ancient invoices when reminders are first enabled. */
const MAX_REMINDER_AGE_DAYS = 180;

function fmtCurrency(amount: number, currency = 'CAD'): string {
	return new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(amount);
}

function fmtDate(d: string): string {
	return new Date(d).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export interface SweepResult {
	markedOverdue: number;
	remindersSent: number;
}

export async function runReminderSweep(): Promise<SweepResult> {
	const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
	pb.autoCancellation(false);

	const now = new Date();
	const todayIso = now.toISOString().slice(0, 10);
	const result: SweepResult = { markedOverdue: 0, remindersSent: 0 };

	// ── 1. Mark past-due "sent" invoices as overdue ────────────────────────
	const pastDue = await pb.collection('invoices').getFullList<Invoice>({
		filter: `status = "sent" && due_date != "" && due_date < "${todayIso} 00:00:00"`
	});
	for (const inv of pastDue) {
		await pb.collection('invoices').update(inv.id, { status: 'overdue' });
		await pb.collection('invoice_logs').create({
			invoice: inv.id,
			action: 'status_changed',
			detail: 'sent → overdue (automatic — past due date)',
			occurred_at: now.toISOString()
		});
		result.markedOverdue++;
	}

	// ── 2. Send reminder emails for overdue invoices (opt-in) ──────────────
	const smtp = await getSmtpSettings(pb);
	if (!smtp?.reminders_enabled || !smtp.smtp_host || !smtp.smtp_from_email) return result;
	const reminderDays = smtp.reminder_days || 7;

	const overdue = await pb.collection('invoices').getFullList<Invoice & { expand?: { client?: Client } }>({
		filter: 'status = "overdue"',
		expand: 'client'
	});
	if (overdue.length === 0) return result;

	const transporter = nodemailer.createTransport({
		host: smtp.smtp_host,
		port: smtp.smtp_port,
		secure: smtp.smtp_secure,
		auth: smtp.smtp_user ? { user: smtp.smtp_user, pass: smtp.smtp_pass } : undefined
	});
	const fromField = smtp.smtp_from_name
		? `"${smtp.smtp_from_name}" <${smtp.smtp_from_email}>`
		: smtp.smtp_from_email;
	const companyName = smtp.company_name || smtp.smtp_from_name || '';

	for (const inv of overdue) {
		const client = inv.expand?.client;
		if (!client?.email || !inv.due_date) continue;

		const daysPastDue = (now.getTime() - new Date(inv.due_date).getTime()) / 86_400_000;
		if (daysPastDue > MAX_REMINDER_AGE_DAYS) continue;

		// Last reminder for this invoice, via the marker in its log entries
		let lastSent: Date | null = null;
		const logs = await pb.collection('invoice_logs').getList<InvoiceLog>(1, 1, {
			filter: `invoice = "${inv.id}" && action = "email_sent" && detail ~ "${REMINDER_MARKER}"`,
			sort: '-occurred_at'
		});
		if (logs.items[0]?.occurred_at) lastSent = new Date(logs.items[0].occurred_at);

		// First reminder goes out as soon as the invoice is overdue; after that,
		// wait the configured number of days between reminders.
		if (lastSent && (now.getTime() - lastSent.getTime()) / 86_400_000 < reminderDays) continue;

		const items = await pb.collection('invoice_items').getFullList<InvoiceItem>({
			filter: `invoice = "${inv.id}"`
		});
		const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
		const total = subtotal * (1 + (inv.tax_percent ?? 0) / 100);
		const remaining = Math.max(0, total - (inv.paid_amount ?? 0));
		if (remaining <= 0) continue;
		const currency = client.currency || 'CAD';

		const bodyText = `Hi ${client.name},

This is a friendly reminder that invoice ${inv.number} for ${fmtCurrency(remaining, currency)} was due on ${fmtDate(inv.due_date)} and remains unpaid.

If you've already sent payment, please disregard this note.

Thank you,
${companyName}`;

		await transporter.sendMail({
			from: fromField,
			replyTo: smtp.smtp_reply_to || undefined,
			to: client.email,
			subject: `Reminder: Invoice ${inv.number} is past due`,
			text: bodyText
		});
		await pb.collection('invoice_logs').create({
			invoice: inv.id,
			action: 'email_sent',
			detail: `${REMINDER_MARKER} ${client.email}`,
			occurred_at: new Date().toISOString()
		});
		result.remindersSent++;
	}

	return result;
}

async function safeSweep() {
	try {
		const r = await runReminderSweep();
		if (r.markedOverdue || r.remindersSent) {
			console.log(`[yield:reminders] marked ${r.markedOverdue} overdue, sent ${r.remindersSent} reminder(s)`);
		}
	} catch (e) {
		const err = e as Error;
		pushServerError('Reminder sweep failed: ' + err.message, err.stack, '(reminder scheduler)');
	}
}

/** Start the twice-daily sweep. Safe to call more than once (dev HMR, multiple imports). */
export function startReminderScheduler(): void {
	const g = globalThis as { __yieldReminderScheduler?: boolean };
	if (g.__yieldReminderScheduler) return;
	g.__yieldReminderScheduler = true;
	setTimeout(safeSweep, INITIAL_DELAY_MS);
	setInterval(safeSweep, SWEEP_INTERVAL_MS);
}
