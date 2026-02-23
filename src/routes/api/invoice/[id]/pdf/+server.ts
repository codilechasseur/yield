import { error } from '@sveltejs/kit';
import puppeteer from 'puppeteer';
import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import type { Invoice, InvoiceItem, Client } from '$lib/types.js';
import { getSmtpSettings, buildInvoiceHtml, buildLogoUrl } from '$lib/mail.server.js';

export async function GET({ params }) {
	const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');

	let invoice: (Invoice & { expand?: { client?: Client } }) | null = null;
	let items: InvoiceItem[] = [];
	let client: Client | null = null;

	try {
		[invoice, items] = await Promise.all([
			pb
				.collection('invoices')
				.getOne<Invoice & { expand?: { client?: Client } }>(params.id, { expand: 'client' }),
			pb
				.collection('invoice_items')
				.getFullList<InvoiceItem>({ filter: `invoice = "${params.id}"`, sort: 'created' })
		]);
		client = invoice.expand?.client ?? null;
	} catch {
		throw error(404, 'Invoice not found');
	}

	const settings = await getSmtpSettings(pb).catch(() => null);
	const logoUrl = settings?.logo && settings?.id
		? buildLogoUrl(env.PB_URL || 'http://localhost:8090', settings.id, settings.logo)
		: undefined;
	const html = buildInvoiceHtml(invoice, items, client, {
		invoiceFooter: settings?.invoice_footer,
		companyName: settings?.company_name || settings?.smtp_from_name || undefined,
		companyAddress: settings?.company_address || undefined,
		defaultNotes: settings?.invoice_default_notes || undefined,
		brandHue: settings?.brand_hue || 250,
		logoUrl,
		hideCompanyName: settings?.logo_hide_company_name
	});

	let browser;
	try {
		browser = await puppeteer.launch({
			headless: true,
			args: [
				'--no-sandbox',
				'--disable-setuid-sandbox',
				'--disable-dev-shm-usage',
				'--disable-gpu'
			]
		});

		const page = await browser.newPage();
		await page.setContent(html, { waitUntil: 'networkidle0' });

		const pdfBuffer = await page.pdf({
			format: 'A4',
			printBackground: true,
			margin: { top: '0', right: '0', bottom: '0', left: '0' }
		});

		return new Response(Buffer.from(pdfBuffer) as unknown as BodyInit, {
			headers: {
				'Content-Type': 'application/pdf',
				'Content-Disposition': `attachment; filename="invoice-${invoice.number}.pdf"`
			}
		});
	} catch (e) {
		console.error('PDF generation error:', e);
		throw error(500, 'Failed to generate PDF');
	} finally {
		await browser?.close();
	}
}
