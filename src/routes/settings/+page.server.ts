import { fail } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import { getSmtpSettings, DEFAULT_EMAIL_SUBJECT, DEFAULT_EMAIL_BODY, buildLogoUrl } from '$lib/mail.server.js';

export async function load() {
	const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
	const smtp = await getSmtpSettings(pb);
	const hasPassword = Boolean(smtp?.app_password_hash);
	const logoUrl = buildLogoUrl(env.PB_URL || 'http://localhost:8090', smtp?.id ?? '', smtp?.logo);
	return { smtp, DEFAULT_EMAIL_SUBJECT, DEFAULT_EMAIL_BODY, hasPassword, logoUrl };
}

export const actions = {
	saveTax: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const fd = await request.formData();
		const default_tax_percent = parseFloat(fd.get('default_tax_percent')?.toString() ?? '5') || 5;

		try {
			const existing = await getSmtpSettings(pb);
			if (existing?.id) {
				await pb.collection('settings').update(existing.id, { default_tax_percent });
			} else {
				await pb.collection('settings').create({ default_tax_percent });
			}
		} catch (e) {
			return fail(500, { taxError: 'Failed to save tax setting: ' + (e as Error).message });
		}

		return { taxSuccess: true };
	},

	testSmtp_unused: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const fd = await request.formData();
		const testTo = fd.get('test_to')?.toString().trim();

		if (!testTo) return fail(400, { testError: 'Enter a recipient email for the test.' });

		// Use saved settings
		const smtp = await getSmtpSettings(pb);
		if (!smtp?.smtp_host) {
			return fail(400, { testError: 'Save SMTP settings first before sending a test.' });
		}

		try {
			const nodemailer = await import('nodemailer');
			const fromField = smtp.smtp_from_name
				? `"${smtp.smtp_from_name}" <${smtp.smtp_from_email}>`
				: smtp.smtp_from_email;
			const transporter = nodemailer.default.createTransport({
				host: smtp.smtp_host,
				port: smtp.smtp_port,
				secure: smtp.smtp_secure,
				auth: smtp.smtp_user ? { user: smtp.smtp_user, pass: smtp.smtp_pass } : undefined
			});
			await transporter.sendMail({
				from: fromField,
				to: testTo,
				subject: 'Yield – SMTP test',
				text: 'This is a test email from Yield. Your SMTP configuration is working correctly.'
			});
		} catch (e) {
			return fail(500, { testError: 'Test failed: ' + (e as Error).message });
		}

		return { testSuccess: true };
	},

	saveInvoiceDefaults: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const fd = await request.formData();
		const invoice_default_notes = fd.get('invoice_default_notes')?.toString() ?? '';
		const invoice_footer = fd.get('invoice_footer')?.toString() ?? '';
		const company_name = fd.get('company_name')?.toString() ?? '';
		const company_address = fd.get('company_address')?.toString() ?? '';

		try {
			const existing = await getSmtpSettings(pb);
			if (existing?.id) {
				await pb.collection('settings').update(existing.id, { invoice_default_notes, invoice_footer, company_name, company_address });
			} else {
				await pb.collection('settings').create({ invoice_default_notes, invoice_footer, company_name, company_address });
			}
		} catch (e) {
			return fail(500, { invoiceDefaultsError: 'Failed to save: ' + (e as Error).message });
		}

		return { invoiceDefaultsSuccess: true };
	},

	saveInvoiceNumbering: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const fd = await request.formData();
		const invoice_number_format = fd.get('invoice_number_format')?.toString().trim() || 'INV-{number}';
		const invoice_next_number = parseInt(fd.get('invoice_next_number')?.toString() ?? '1', 10) || 1;

		try {
			const existing = await getSmtpSettings(pb);
			if (existing?.id) {
				await pb.collection('settings').update(existing.id, { invoice_number_format, invoice_next_number });
			} else {
				await pb.collection('settings').create({ invoice_number_format, invoice_next_number });
			}
		} catch (e) {
			return fail(500, { invoiceNumberingError: 'Failed to save: ' + (e as Error).message });
		}

		return { invoiceNumberingSuccess: true };
	},

	saveEmailTemplate: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const fd = await request.formData();
		const email_subject = fd.get('email_subject')?.toString() ?? '';
		const email_body = fd.get('email_body')?.toString() ?? '';

		try {
			const existing = await getSmtpSettings(pb);
			if (existing?.id) {
				await pb.collection('settings').update(existing.id, { email_subject, email_body });
			} else {
				await pb.collection('settings').create({ email_subject, email_body });
			}
		} catch (e) {
			return fail(500, { emailTemplateError: 'Failed to save: ' + (e as Error).message });
		}

		return { emailTemplateSuccess: true };
	},

	saveIncomeTaxRate: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const fd = await request.formData();
		const income_tax_rate = parseFloat(fd.get('income_tax_rate')?.toString() ?? '0') || 0;

		try {
			const existing = await getSmtpSettings(pb);
			if (existing?.id) {
				await pb.collection('settings').update(existing.id, { income_tax_rate });
			} else {
				await pb.collection('settings').create({ income_tax_rate });
			}
		} catch (e) {
			return fail(500, { incomeTaxRateError: 'Failed to save: ' + (e as Error).message });
		}

		return { incomeTaxRateSuccess: true };
	},

	saveClientDefaults: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const fd = await request.formData();
		const default_currency = fd.get('default_currency')?.toString().trim() || 'CAD';

		try {
			const existing = await getSmtpSettings(pb);
			if (existing?.id) {
				await pb.collection('settings').update(existing.id, { default_currency });
			} else {
				await pb.collection('settings').create({ default_currency });
			}
		} catch (e) {
			return fail(500, { clientDefaultsError: 'Failed to save: ' + (e as Error).message });
		}

		return { clientDefaultsSuccess: true };
	},

	saveAppearance: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const fd = await request.formData();
		const brand_hue = parseFloat(fd.get('brand_hue')?.toString() ?? '250') || 250;
		const rawTheme = fd.get('brand_theme')?.toString() ?? '';
		const brand_theme = ['light', 'dark', 'system'].includes(rawTheme) ? rawTheme : undefined;

		try {
			const existing = await getSmtpSettings(pb);
			const payload: Record<string, unknown> = { brand_hue };
			if (brand_theme) payload.brand_theme = brand_theme;
			if (existing?.id) {
				await pb.collection('settings').update(existing.id, payload);
			} else {
				await pb.collection('settings').create(payload);
			}
		} catch {
			// silently ignore — appearance is cosmetic only
		}

		return {};
	},

	saveLogo: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const fd = await request.formData();
		const logoFile = fd.get('logo');

		if (!logoFile || !(logoFile instanceof File) || logoFile.size === 0) {
			return fail(400, { logoError: 'Please select an image file.' });
		}

		const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'];
		if (!allowedTypes.includes(logoFile.type)) {
			return fail(400, { logoError: 'Only JPEG, PNG, GIF, SVG, and WebP images are allowed.' });
		}

		if (logoFile.size > 5 * 1024 * 1024) {
			return fail(400, { logoError: 'Logo must be under 5 MB.' });
		}

		try {
			const existing = await getSmtpSettings(pb);
			const uploadData = new FormData();
			uploadData.append('logo', logoFile);
			if (existing?.id) {
				await pb.collection('settings').update(existing.id, uploadData);
			} else {
				await pb.collection('settings').create(uploadData);
			}
		} catch (e) {
			return fail(500, { logoError: 'Failed to save logo: ' + (e as Error).message });
		}

		return { logoSuccess: true };
	},

	removeLogo: async () => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		try {
			const existing = await getSmtpSettings(pb);
			if (existing?.id) {
				// PocketBase file-delete convention: send `fieldName-` with the filename to remove.
				// Using an empty string as a fallback clears the field even if the filename is unknown.
				await pb.collection('settings').update(existing.id, { 'logo-': existing.logo ?? '' });
			}
		} catch (e) {
			return fail(500, { logoError: 'Failed to remove logo: ' + (e as Error).message });
		}
		return { logoRemoved: true };
	},

	saveAll: async ({ request }) => {
		const pb = new PocketBase(env.PB_URL || 'http://localhost:8090');
		const fd = await request.formData();

		const data = {

			// Email template
			email_subject: fd.get('email_subject')?.toString() ?? '',
			email_body: fd.get('email_body')?.toString() ?? '',
			// Invoice defaults
			company_name: fd.get('company_name')?.toString() ?? '',
			company_address: fd.get('company_address')?.toString() ?? '',
			invoice_default_notes: fd.get('invoice_default_notes')?.toString() ?? '',
			invoice_footer: fd.get('invoice_footer')?.toString() ?? '',
			// Invoice numbering
			invoice_number_format: fd.get('invoice_number_format')?.toString().trim() || 'INV-{number}',
			invoice_next_number: parseInt(fd.get('invoice_next_number')?.toString() ?? '1', 10) || 1,
			// Tax / rates
			default_tax_percent: parseFloat(fd.get('default_tax_percent')?.toString() ?? '5') || 5,
			income_tax_rate: parseFloat(fd.get('income_tax_rate')?.toString() ?? '0') || 0,
			default_hourly_rate: parseFloat(fd.get('default_hourly_rate')?.toString() ?? '0') || 0,
			// Client defaults
			default_currency: fd.get('default_currency')?.toString().trim() || 'CAD',
			// Appearance
			brand_hue: parseFloat(fd.get('brand_hue')?.toString() ?? '250') || 250,
			brand_theme: (['light', 'dark', 'system'].includes(fd.get('brand_theme')?.toString() ?? '') ? fd.get('brand_theme')!.toString() : 'system'),
			// Logo
			logo_hide_company_name: fd.get('logo_hide_company_name') === 'on',
		};

		try {
			const existing = await getSmtpSettings(pb);
			if (existing?.id) {
				await pb.collection('settings').update(existing.id, data);
			} else {
				await pb.collection('settings').create(data);
			}
		} catch (e) {
			return fail(500, { saveAllError: 'Failed to save settings: ' + (e as Error).message });
		}

		return { saveAllSuccess: true };
	}
};
