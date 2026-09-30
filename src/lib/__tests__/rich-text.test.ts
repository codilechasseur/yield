import { describe, it, expect } from 'vitest';
import {
	sanitizeRichText,
	plainTextToRichText,
	renderRichText,
	renderMultilineText,
	escapeHtmlAttr,
	isRichText,
	richTextToPlainText
} from '../rich-text.js';

describe('sanitizeRichText', () => {
	it('returns empty string for empty input', () => {
		expect(sanitizeRichText('')).toBe('');
		expect(sanitizeRichText(null)).toBe('');
		expect(sanitizeRichText(undefined)).toBe('');
	});

	it('keeps allowed tags and strips all attributes', () => {
		expect(
			sanitizeRichText('<ul class="list" style="background:#000"><li data-x="1">One</li></ul>')
		).toBe('<ul><li>One</li></ul>');
		expect(sanitizeRichText('<b style="color:red">bold</b> <em>it</em> <code>x</code>')).toBe(
			'<b>bold</b> <em>it</em> <code>x</code>'
		);
	});

	it('unwraps unknown tags but keeps their text', () => {
		expect(sanitizeRichText('<span style="font:x">Hello <a href="https://x.y">link</a></span>')).toBe(
			'Hello link'
		);
	});

	it('removes scripts, styles and event handlers', () => {
		expect(sanitizeRichText('a<script>alert(1)</script>b')).toBe('ab');
		expect(sanitizeRichText('<style>p{}</style><p>x</p>')).toBe('<p>x</p>');
		expect(sanitizeRichText('<img src=x onerror="alert(1)">hi')).toBe('hi');
		expect(sanitizeRichText('<b onclick="alert(1)">x</b>')).toBe('<b>x</b>');
	});

	it('drops everything after an unterminated dangerous tag', () => {
		expect(sanitizeRichText('ok<script>alert(1)')).toBe('ok');
	});

	it('handles quoted > inside attributes', () => {
		expect(sanitizeRichText('<div title="a>b">x</div>')).toBe('<div>x</div>');
	});

	it('escapes stray angle brackets in text', () => {
		expect(sanitizeRichText('1 < 2 and 3 > 2')).toBe('1 &lt; 2 and 3 &gt; 2');
	});

	it('closes unclosed tags and ignores unmatched closing tags', () => {
		expect(sanitizeRichText('<ul><li><b>x')).toBe('<ul><li><b>x</b></li></ul>');
		expect(sanitizeRichText('x</b></ul>')).toBe('x');
		expect(sanitizeRichText('<ul><li>a</ul>')).toBe('<ul><li>a</li></ul>');
	});

	it('rewrites headings and strikethrough', () => {
		expect(sanitizeRichText('<h2 id="x">August</h2>')).toBe('<div><strong>August</strong></div>');
		expect(sanitizeRichText('<del>old</del>')).toBe('<s>old</s>');
	});

	it('normalises void tags', () => {
		expect(sanitizeRichText('a<br/>b<hr class="x">c</br>')).toBe('a<br>b<hr>c');
	});

	it('removes comments, including clipboard fragment markers', () => {
		expect(
			sanitizeRichText('<html><body><!--StartFragment--><p>x</p><!--EndFragment--></body></html>')
		).toBe('<p>x</p>');
	});

	it('trims leading and trailing empty blocks and breaks', () => {
		expect(sanitizeRichText('<div><br></div><p> </p><p>x</p><br><div>&nbsp;</div>')).toBe(
			'<p>x</p>'
		);
	});

	it('cleans a chat-style clipboard paste with nested lists', () => {
		const pasted = `<meta charset="utf-8"><div class="font-claude-message" style="background-color: rgb(38,38,36)">
<p style="color: #ccc">[C] means a client request.</p>
<h3 class="font-bold">September</h3>
<ul class="list-disc"><li class="whitespace-normal">Photo galleries:
<ul><li>Sub-category tiles. [C] (#141)</li></ul></li></ul></div>`;
		expect(sanitizeRichText(pasted)).toBe(
			`<div>
<p>[C] means a client request.</p>
<div><strong>September</strong></div>
<ul><li>Photo galleries:
<ul><li>Sub-category tiles. [C] (#141)</li></ul></li></ul></div>`
		);
	});
});

describe('plainTextToRichText', () => {
	it('returns empty string for empty input', () => {
		expect(plainTextToRichText('')).toBe('');
		expect(plainTextToRichText(null)).toBe('');
	});

	it('wraps plain lines in divs and escapes HTML', () => {
		expect(plainTextToRichText('Design work\n<b>not bold</b>')).toBe(
			'<div>Design work</div><div>&lt;b&gt;not bold&lt;/b&gt;</div>'
		);
	});

	it('converts dash, star and bullet lists', () => {
		expect(plainTextToRichText('- One\n* Two\n• Three')).toBe(
			'<ul><li>One</li><li>Two</li><li>Three</li></ul>'
		);
	});

	it('converts numbered lists', () => {
		expect(plainTextToRichText('1. One\n2) Two')).toBe('<ol><li>One</li><li>Two</li></ol>');
	});

	it('nests lists by indentation and unwinds back out', () => {
		expect(plainTextToRichText('- A\n  - A1\n    - A1a\n  - A2\n- B')).toBe(
			'<ul><li>A<ul><li>A1<ul><li>A1a</li></ul></li><li>A2</li></ul></li><li>B</li></ul>'
		);
	});

	it('starts a new list when the list type changes at the same level', () => {
		expect(plainTextToRichText('- a\n1. b')).toBe('<ul><li>a</li></ul><ol><li>b</li></ol>');
	});

	it('keeps a list going across blank lines and ends it at a paragraph', () => {
		expect(plainTextToRichText('- a\n\n- b\nAfter')).toBe(
			'<ul><li>a</li><li>b</li></ul><div>After</div>'
		);
	});

	it('converts headings, rules and blank lines', () => {
		expect(plainTextToRichText('## August\n---\nx\n\ny')).toBe(
			'<div><strong>August</strong></div><hr><div>x</div><div><br></div><div>y</div>'
		);
	});

	it('converts inline bold, italic and code', () => {
		expect(plainTextToRichText('**Bold** and __also__, *it*, `code`')).toBe(
			'<div><strong>Bold</strong> and <strong>also</strong>, <em>it</em>, <code>code</code></div>'
		);
	});

	it('does not treat lone asterisks or snake_case as emphasis', () => {
		expect(plainTextToRichText('2 * 3 * 4 and some_var_name')).toBe(
			'<div>2 * 3 * 4 and some_var_name</div>'
		);
	});

	it('does not treat a dash without a following space as a list', () => {
		expect(plainTextToRichText('-5 hours')).toBe('<div>-5 hours</div>');
	});

	it('trims leading and trailing blank lines and normalises CRLF', () => {
		expect(plainTextToRichText('\r\n\r\n- a\r\n\r\n')).toBe('<ul><li>a</li></ul>');
	});
});

describe('renderRichText', () => {
	it('returns empty string for empty input', () => {
		expect(renderRichText('')).toBe('');
		expect(renderRichText(undefined)).toBe('');
	});

	it('sanitizes values that contain HTML', () => {
		expect(renderRichText('<ul style="x"><li>a</li></ul><script>x</script>')).toBe(
			'<ul><li>a</li></ul>'
		);
	});

	it('applies markdown to plain-text values', () => {
		expect(renderRichText('- a\n- b')).toBe('<ul><li>a</li><li>b</li></ul>');
	});

	it('treats a lone < in plain text as text, not HTML', () => {
		expect(renderRichText('under < 5 hours')).toBe('<div>under &lt; 5 hours</div>');
	});
});

describe('renderMultilineText', () => {
	it('returns empty string for empty input', () => {
		expect(renderMultilineText('')).toBe('');
		expect(renderMultilineText(null)).toBe('');
		expect(renderMultilineText(undefined)).toBe('');
	});

	it('escapes plain text and keeps line breaks', () => {
		expect(renderMultilineText('1 Main St\r\nSuite <4> & Co\nCity')).toBe(
			'1 Main St<br>Suite &lt;4&gt; &amp; Co<br>City'
		);
	});

	it('does not apply markdown to plain text', () => {
		expect(renderMultilineText('- Suite 4\n# 12')).toBe('- Suite 4<br># 12');
	});

	it('sanitizes values that contain HTML', () => {
		expect(renderMultilineText('<p>Hi</p><img src=x onerror=alert(1)><script>x</script>')).toBe(
			'<p>Hi</p>'
		);
	});

	it('strips event-handler attributes from allowed tags', () => {
		expect(renderMultilineText('<b onclick="alert(1)">bold</b>')).toBe('<b>bold</b>');
	});
});

describe('escapeHtmlAttr', () => {
	it('escapes markup and both quote styles', () => {
		expect(escapeHtmlAttr(`<a href="x" title='y'>&</a>`)).toBe(
			'&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;'
		);
	});

	it('stringifies numbers and treats null/undefined as empty', () => {
		expect(escapeHtmlAttr(12.5)).toBe('12.5');
		expect(escapeHtmlAttr(null)).toBe('');
		expect(escapeHtmlAttr(undefined)).toBe('');
	});
});

describe('isRichText', () => {
	it('detects HTML tags', () => {
		expect(isRichText('<div>a</div>')).toBe(true);
		expect(isRichText('a<br>b')).toBe(true);
	});

	it('treats text without tags as plain', () => {
		expect(isRichText('a < 5 & b > 2')).toBe(false);
		expect(isRichText('')).toBe(false);
		expect(isRichText(null)).toBe(false);
		expect(isRichText(undefined)).toBe(false);
	});
});

describe('richTextToPlainText', () => {
	it('converts contenteditable divs and blank lines to newlines', () => {
		expect(richTextToPlainText('<div>Hi Burnkit,</div><div><br></div><div>Please pay.</div><div><br></div><div>Thanks</div>'))
			.toBe('Hi Burnkit,\n\nPlease pay.\n\nThanks');
	});

	it('handles leading bare text and trailing <br> inside blocks', () => {
		expect(richTextToPlainText('Hi<div>next<br></div><div>last</div>')).toBe('Hi\nnext\nlast');
	});

	it('bullets list items and renders rules', () => {
		expect(richTextToPlainText('<div>Items:</div><ul><li>one</li><li><b>two</b></li></ul><hr><p>end</p>'))
			.toBe('Items:\n- one\n- two\n---\nend');
	});

	it('decodes entities once', () => {
		expect(richTextToPlainText('<div>R&amp;D &lt;Co&gt;&nbsp;&quot;x&quot; &#39;y&#39; &amp;lt;</div>')).toBe('R&D <Co> "x" \'y\' &lt;');
	});

	it('collapses runs of blank lines', () => {
		expect(richTextToPlainText('<div>a</div><div><br></div><div><br></div><div><br></div><div>b</div>')).toBe('a\n\nb');
	});

	it('returns an empty string for empty input', () => {
		expect(richTextToPlainText('')).toBe('');
		expect(richTextToPlainText(null)).toBe('');
		expect(richTextToPlainText(undefined)).toBe('');
	});
});
