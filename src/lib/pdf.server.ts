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
 * Pulls the page-footer markup out of a document's `<template id="pdf-footer">`. Chromium
 * draws it in every page's bottom margin (which the document's `@page` rule must reserve);
 * `pageNumber` / `totalPages` spans inside it are filled in per page.
 */
export function extractPdfFooter(html: string): string | undefined {
	return html.match(/<template id="pdf-footer">([\s\S]*?)<\/template>/)?.[1].trim() || undefined;
}

/**
 * Renders a self-contained HTML document to an A4 PDF. JavaScript is disabled
 * and network requests are limited to fonts plus `allowedUrls` (e.g. the logo).
 * A `<template id="pdf-footer">` in the document becomes the repeating page footer.
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
		const footer = extractPdfFooter(html);
		const raw = await page.pdf({
			format: 'A4',
			printBackground: true,
			...(footer ? { displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: footer } : {}),
			...(opts.margin ? { margin: opts.margin } : {})
		});
		return Buffer.from(raw);
	} finally {
		await browser.close();
	}
}
