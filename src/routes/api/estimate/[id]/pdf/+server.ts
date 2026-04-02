import { error } from '@sveltejs/kit';
import puppeteer from 'puppeteer';
import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import type { Estimate, EstimateItem, Client } from '$lib/types.js';
import { getSmtpSettings, buildEstimateHtml, buildLogoUrl } from '$lib/mail.server.js';

export async function GET({ params }) {
	const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');

	let estimate: (Estimate & { expand?: { client?: Client } }) | null = null;
	let items: EstimateItem[] = [];
	let client: Client | null = null;

	try {
		[estimate, items] = await Promise.all([
			pb
				.collection('estimates')
				.getOne<Estimate & { expand?: { client?: Client } }>(params.id, { expand: 'client' }),
			pb
				.collection('estimate_items')
				.getFullList<EstimateItem>({ filter: `estimate = "${params.id}"`, sort: 'created' })
		]);
		client = estimate.expand?.client ?? null;
	} catch {
		throw error(404, 'Estimate not found');
	}

	const settings = await getSmtpSettings(pb).catch(() => null);
	const logoUrl = settings?.logo && settings?.id
		? buildLogoUrl(env.PB_URL || 'http://localhost:8090', settings.id, settings.logo)
		: undefined;
	const html = buildEstimateHtml(estimate, items, client, {
		estimateFooter: settings?.invoice_footer,
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
				'Content-Disposition': `attachment; filename="estimate-${estimate.number}.pdf"`
			}
		});
	} catch (e) {
		console.error('PDF generation error:', e);
		throw error(500, 'Failed to generate PDF');
	} finally {
		await browser?.close();
	}
}
