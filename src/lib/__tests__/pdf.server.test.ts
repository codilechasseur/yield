import { describe, it, expect, vi, beforeEach } from 'vitest';
import puppeteer from 'puppeteer';

vi.mock('puppeteer', () => ({ default: { launch: vi.fn() } }));

import { extractPdfFooter, htmlToPdf, isAllowedPdfRequest } from '../pdf.server.js';

describe('isAllowedPdfRequest', () => {
	it('allows data: URLs', () => {
		expect(isAllowedPdfRequest('data:image/png;base64,AAAA')).toBe(true);
	});

	it('allows Google Fonts stylesheets and font files', () => {
		expect(isAllowedPdfRequest('https://fonts.googleapis.com/css2?family=Inter')).toBe(true);
		expect(isAllowedPdfRequest('https://fonts.gstatic.com/s/inter/v1/a.woff2')).toBe(true);
	});

	it('allows explicitly listed URLs only', () => {
		const logo = 'http://pocketbase:8090/api/files/yieldsetts01/abc/logo.png';
		expect(isAllowedPdfRequest(logo, [logo])).toBe(true);
		expect(isAllowedPdfRequest('http://pocketbase:8090/api/collections/settings/records', [logo])).toBe(false);
	});

	it('blocks internal and arbitrary hosts', () => {
		expect(isAllowedPdfRequest('http://169.254.169.254/latest/meta-data/')).toBe(false);
		expect(isAllowedPdfRequest('http://localhost:8090/api/admins')).toBe(false);
		expect(isAllowedPdfRequest('https://evil.example/pixel.gif')).toBe(false);
		expect(isAllowedPdfRequest('file:///etc/passwd')).toBe(false);
	});

	it('blocks look-alike font hosts', () => {
		expect(isAllowedPdfRequest('https://fonts.googleapis.com.evil.example/x')).toBe(false);
		expect(isAllowedPdfRequest('http://fonts.gstatic.com/x')).toBe(false);
	});

	it('blocks unparseable URLs', () => {
		expect(isAllowedPdfRequest('not a url')).toBe(false);
		expect(isAllowedPdfRequest('')).toBe(false);
	});
});

describe('extractPdfFooter', () => {
	it('returns the trimmed contents of the pdf-footer template', () => {
		const html = '<body><p>Hi</p><template id="pdf-footer">\n  <div>Acme · <span class="pageNumber"></span></div>\n</template></body>';
		expect(extractPdfFooter(html)).toBe('<div>Acme · <span class="pageNumber"></span></div>');
	});

	it('returns undefined when there is no footer template', () => {
		expect(extractPdfFooter('<p>Hi</p>')).toBeUndefined();
		expect(extractPdfFooter('')).toBeUndefined();
		expect(extractPdfFooter('<template id="other">x</template>')).toBeUndefined();
	});

	it('returns undefined for an empty footer template', () => {
		expect(extractPdfFooter('<template id="pdf-footer">  </template>')).toBeUndefined();
	});
});

describe('htmlToPdf', () => {
	let page: Record<string, ReturnType<typeof vi.fn>>;
	let browser: { newPage: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };

	beforeEach(() => {
		page = {
			setJavaScriptEnabled: vi.fn().mockResolvedValue(undefined),
			setRequestInterception: vi.fn().mockResolvedValue(undefined),
			on: vi.fn(),
			setContent: vi.fn().mockResolvedValue(undefined),
			waitForNetworkIdle: vi.fn().mockResolvedValue(undefined),
			pdf: vi.fn().mockResolvedValue(new Uint8Array([37, 80, 68, 70]))
		};
		browser = { newPage: vi.fn().mockResolvedValue(page), close: vi.fn().mockResolvedValue(undefined) };
		vi.mocked(puppeteer.launch).mockResolvedValue(browser as never);
	});

	it('renders the HTML and returns the PDF bytes', async () => {
		const pdf = await htmlToPdf('<p>Hi</p>');
		expect(page.setContent).toHaveBeenCalledWith('<p>Hi</p>', { waitUntil: 'load' });
		expect(pdf.toString()).toBe('%PDF');
		expect(browser.close).toHaveBeenCalled();
	});

	it('disables JavaScript and enables request interception before loading content', async () => {
		await htmlToPdf('<p>Hi</p>');
		expect(page.setJavaScriptEnabled).toHaveBeenCalledWith(false);
		expect(page.setRequestInterception).toHaveBeenCalledWith(true);
		const loadOrder = page.setContent.mock.invocationCallOrder[0];
		expect(page.setJavaScriptEnabled.mock.invocationCallOrder[0]).toBeLessThan(loadOrder);
		expect(page.setRequestInterception.mock.invocationCallOrder[0]).toBeLessThan(loadOrder);
	});

	it('continues allowed requests and aborts everything else', async () => {
		const logo = 'http://pb.test/logo.png';
		await htmlToPdf('<p>Hi</p>', { allowedUrls: [logo] });
		const handler = page.on.mock.calls.find(([event]) => event === 'request')![1];

		const request = (url: string) => ({ url: () => url, continue: vi.fn(), abort: vi.fn() });
		const allowed = request(logo);
		const blocked = request('http://169.254.169.254/');
		handler(allowed);
		handler(blocked);

		expect(allowed.continue).toHaveBeenCalled();
		expect(allowed.abort).not.toHaveBeenCalled();
		expect(blocked.abort).toHaveBeenCalledWith('blockedbyclient');
		expect(blocked.continue).not.toHaveBeenCalled();
	});

	it('passes margins through only when given', async () => {
		await htmlToPdf('<p/>');
		expect(page.pdf).toHaveBeenLastCalledWith({ format: 'A4', printBackground: true });
		const margin = { top: '0', right: '0', bottom: '0', left: '0' };
		await htmlToPdf('<p/>', { margin });
		expect(page.pdf).toHaveBeenLastCalledWith({ format: 'A4', printBackground: true, margin });
	});

	it('renders a pdf-footer template as the repeating page footer', async () => {
		await htmlToPdf('<p>Hi</p><template id="pdf-footer"><div>Foot</div></template>');
		expect(page.pdf).toHaveBeenLastCalledWith({
			format: 'A4',
			printBackground: true,
			displayHeaderFooter: true,
			headerTemplate: '<span></span>',
			footerTemplate: '<div>Foot</div>'
		});
	});

	it('closes the browser when rendering fails', async () => {
		page.pdf.mockRejectedValueOnce(new Error('boom'));
		await expect(htmlToPdf('<p/>')).rejects.toThrow('boom');
		expect(browser.close).toHaveBeenCalled();
	});
});
