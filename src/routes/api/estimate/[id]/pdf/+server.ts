import { error } from '@sveltejs/kit';
import type { Estimate, EstimateItem, Client } from '$lib/types.js';
import { getSmtpSettings, buildEstimateHtml, buildLogoUrl } from '$lib/mail.server.js';
import { getPreset } from '$lib/presets.js';
import { getPb, pbUrl } from '$lib/pb.server.js';
import { htmlToPdf } from '$lib/pdf.server.js';

export async function GET({ params }) {
	const pb = await getPb();

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
				.getFullList<EstimateItem>({ filter: pb.filter('estimate = {:id}', { id: params.id }), sort: 'created' })
		]);
		client = estimate.expand?.client ?? null;
	} catch {
		throw error(404, 'Estimate not found');
	}

	const settings = await getSmtpSettings(pb).catch(() => null);
	const logoUrl = settings?.logo && settings?.id
		? buildLogoUrl(pbUrl(), settings.id, settings.logo)
		: undefined;
	const html = buildEstimateHtml(estimate, items, client, {
		estimateFooter: settings?.invoice_footer,
		companyName: settings?.company_name || settings?.smtp_from_name || undefined,
		companyAddress: settings?.company_address || undefined,
		defaultNotes: settings?.invoice_default_notes || undefined,
		brandHue: settings?.brand_hue || 250,
		accentColor: getPreset(settings?.brand_preset).pdfAccent,
		logoUrl,
		hideCompanyName: settings?.logo_hide_company_name
	});

	try {
		const pdfBuffer = await htmlToPdf(html, {
			allowedUrls: logoUrl ? [logoUrl] : [],
			margin: { top: '0', right: '0', bottom: '0', left: '0' }
		});
		// Numbers are user-entered — keep the header filename to safe characters.
		const filename = `estimate-${estimate.number.replace(/[^\w.-]+/g, '_')}.pdf`;
		return new Response(new Uint8Array(pdfBuffer), {
			headers: {
				'Content-Type': 'application/pdf',
				'Content-Disposition': `attachment; filename="${filename}"`
			}
		});
	} catch (e) {
		console.error('PDF generation error:', e);
		throw error(500, 'Failed to generate PDF');
	}
}
