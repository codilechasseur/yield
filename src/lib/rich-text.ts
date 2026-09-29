// Rich-text helpers for line item descriptions (and anything else edited with RichTextarea).
// Pure string functions with no DOM dependency, so they run in the browser, in SvelteKit
// server code, and when building PDF/email HTML.

/** Tags kept as-is (attributes are always stripped). */
const ALLOWED_TAGS = new Set([
	'b', 'strong', 'i', 'em', 'u', 's', 'code', 'br', 'hr',
	'p', 'div', 'ul', 'ol', 'li', 'blockquote', 'pre'
]);

/** Tags rewritten to an allowed equivalent. */
const RENAMED_TAGS: Record<string, { open: string; close: string }> = {
	h1: { open: '<div><strong>', close: '</strong></div>' },
	h2: { open: '<div><strong>', close: '</strong></div>' },
	h3: { open: '<div><strong>', close: '</strong></div>' },
	h4: { open: '<div><strong>', close: '</strong></div>' },
	h5: { open: '<div><strong>', close: '</strong></div>' },
	h6: { open: '<div><strong>', close: '</strong></div>' },
	del: { open: '<s>', close: '</s>' },
	strike: { open: '<s>', close: '</s>' }
};

/** Tags whose content is dropped along with the tag itself. */
const DROP_WITH_CONTENT = new Set([
	'script', 'style', 'head', 'title', 'template', 'iframe', 'object', 'embed',
	'svg', 'math', 'noscript', 'textarea', 'select', 'button'
]);

const VOID_TAGS = new Set(['br', 'hr']);

// Comments, or a tag whose attribute values may contain quoted `>` characters.
const TAG_RE = /<!--[\s\S]*?(?:-->|$)|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;

function escapeText(s: string): string {
	return s.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Removes leading/trailing whitespace, `<br>`s and empty blocks. */
function trimEmpty(html: string): string {
	const edge = '(?:\\s|&nbsp;|<br>|<(p|div)>(?:\\s|&nbsp;|<br>)*</\\1>)+';
	return html.replace(new RegExp(`^${edge}`), '').replace(new RegExp(`${edge}$`), '');
}

/**
 * Reduces arbitrary HTML (e.g. clipboard content from a chat app or web page) to a small,
 * attribute-free subset: bold/italic/code, paragraphs, lists and rules. Unknown tags are
 * unwrapped (their text kept), dangerous ones are removed with their content, and unclosed
 * tags are closed so the result can't leak formatting into surrounding markup.
 */
export function sanitizeRichText(html: string | null | undefined): string {
	if (!html) return '';

	let out = '';
	const stack: string[] = [];
	let last = 0;
	TAG_RE.lastIndex = 0;

	for (let m = TAG_RE.exec(html); m; m = TAG_RE.exec(html)) {
		out += escapeText(html.slice(last, m.index));
		last = TAG_RE.lastIndex;

		const [raw, slash, rawName] = m;
		if (raw.startsWith('<!--')) continue;
		const name = rawName.toLowerCase();
		const closing = slash === '/';

		if (DROP_WITH_CONTENT.has(name)) {
			if (!closing) {
				const end = html.toLowerCase().indexOf(`</${name}`, last);
				if (end === -1) {
					last = html.length;
					break;
				}
				const gt = html.indexOf('>', end);
				last = gt === -1 ? html.length : gt + 1;
				TAG_RE.lastIndex = last;
			}
			continue;
		}

		const renamed = RENAMED_TAGS[name];
		if (!renamed && !ALLOWED_TAGS.has(name)) continue;

		if (VOID_TAGS.has(name)) {
			if (!closing) out += `<${name}>`;
			continue;
		}

		if (!closing) {
			stack.push(name);
			out += renamed ? renamed.open : `<${name}>`;
		} else if (stack.includes(name)) {
			// Close everything opened since the matching tag.
			while (stack.length) {
				const top = stack.pop()!;
				out += RENAMED_TAGS[top]?.close ?? `</${top}>`;
				if (top === name) break;
			}
		}
	}

	out += escapeText(html.slice(last));
	while (stack.length) {
		const top = stack.pop()!;
		out += RENAMED_TAGS[top]?.close ?? `</${top}>`;
	}

	return trimEmpty(out.trim());
}

function inlineMarkdown(escaped: string): string {
	return escaped
		.replace(/`([^`]+)`/g, '<code>$1</code>')
		.replace(/\*\*(.+?)\*\*|__(.+?)__/g, (_, a, b) => `<strong>${a ?? b}</strong>`)
		.replace(/(^|[^*\w])\*(?!\s)([^*]+?)\*(?![*\w])/g, '$1<em>$2</em>');
}

const LIST_ITEM_RE = /^(\s*)([-*+•]|\d+[.)])\s+(.*)$/;

/**
 * Converts plain text with light markdown (`- ` / `1. ` lists with indentation-based nesting,
 * `#` headings, `---` rules, `**bold**`, `*italic*`, `` `code` ``) into the same HTML subset
 * that {@link sanitizeRichText} produces. Other lines become `<div>`s, matching what the
 * contenteditable editor generates.
 */
export function plainTextToRichText(text: string | null | undefined): string {
	if (!text) return '';

	const lines = text.replace(/\r\n?/g, '\n').split('\n');
	let out = '';
	// Open lists, innermost last. `indent` is the item's leading whitespace width.
	const lists: { tag: 'ul' | 'ol'; indent: number }[] = [];

	const closeListsTo = (depth: number) => {
		while (lists.length > depth) out += `</li></${lists.pop()!.tag}>`;
	};

	for (const line of lines) {
		const item = LIST_ITEM_RE.exec(line);
		if (item) {
			const indent = item[1].replace(/\t/g, '  ').length;
			const tag = /\d/.test(item[2]) ? 'ol' : 'ul';
			const content = inlineMarkdown(escapeHtml(item[3]));

			// Pop lists nested deeper than this item.
			while (lists.length && lists[lists.length - 1].indent > indent) closeListsTo(lists.length - 1);

			const top = lists[lists.length - 1];
			if (!top || indent > top.indent) {
				lists.push({ tag, indent });
				out += `<${tag}><li>${content}`;
			} else if (top.tag !== tag) {
				closeListsTo(lists.length - 1);
				lists.push({ tag, indent });
				out += `<${tag}><li>${content}`;
			} else {
				out += `</li><li>${content}`;
			}
			continue;
		}

		const trimmed = line.trim();
		// Blank lines inside a list don't end it (markdown "loose" lists).
		if (!trimmed && lists.length) continue;
		closeListsTo(0);

		if (!trimmed) {
			out += '<div><br></div>';
		} else if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
			out += '<hr>';
		} else {
			const heading = /^#{1,6}\s+(.*)$/.exec(trimmed);
			out += heading
				? `<div><strong>${inlineMarkdown(escapeHtml(heading[1]))}</strong></div>`
				: `<div>${inlineMarkdown(escapeHtml(line))}</div>`;
		}
	}
	closeListsTo(0);

	return trimEmpty(out);
}

/**
 * Safe HTML for displaying a stored rich-text value. Values containing tags are sanitized;
 * plain-text values (older records, API-created items) get the light markdown treatment.
 */
export function renderRichText(value: string | null | undefined): string {
	if (!value) return '';
	return /<[a-zA-Z!/]/.test(value) ? sanitizeRichText(value) : plainTextToRichText(value);
}
