import puppeteer, { type PDFOptions } from 'puppeteer';

/** Stylesheet + font hosts the invoice/estimate templates load Inter from. */
const FONT_ORIGINS = new Set(['https://fonts.googleapis.com', 'https://fonts.gstatic.com']);

/**
 * Whether the PDF renderer may fetch `url`. Everything else is blocked, so
 * markup that slips into a document can't make the server request internal
 * addresses (SSRF) or phone home.
 */
export function isAllowedPdfRequest(url: string, allowedUrls: readonly string[] = []): boolean {
	if (url.startsWith('data:')) return true;
	if (allowedUrls.includes(url)) return true;
	try {
		return FONT_ORIGINS.has(new URL(url).origin);
	} catch {
		return false;
	}
}

/**
 * Renders a self-contained HTML document to an A4 PDF. JavaScript is disabled
 * and network requests are limited to fonts plus `allowedUrls` (e.g. the logo).
 */
export async function htmlToPdf(
	html: string,
	opts: { allowedUrls?: readonly string[]; margin?: PDFOptions['margin'] } = {}
): Promise<Buffer> {
	const browser = await puppeteer.launch({
		headless: true,
		// Chromium's sandbox needs privileges the Docker image doesn't grant; the
		// request allowlist and disabled JavaScript above limit what a page can do.
		args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
	});
	try {
		const page = await browser.newPage();
		await page.setJavaScriptEnabled(false);
		await page.setRequestInterception(true);
		page.on('request', (request) => {
			if (isAllowedPdfRequest(request.url(), opts.allowedUrls)) {
				void request.continue();
			} else {
				void request.abort('blockedbyclient');
			}
		});
		await page.setContent(html, { waitUntil: 'load' });
		await page.waitForNetworkIdle();
		const raw = await page.pdf({
			format: 'A4',
			printBackground: true,
			...(opts.margin ? { margin: opts.margin } : {})
		});
		return Buffer.from(raw);
	} finally {
		await browser.close();
	}
}
