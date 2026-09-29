<script lang="ts">
	import { Bold, Italic, Code2, List, ListOrdered, Minus } from 'lucide-svelte';
	import { renderRichText, sanitizeRichText, plainTextToRichText } from '$lib/rich-text.js';

	let {
		value = $bindable(''),
		name,
		id,
		form,
		rows = 3,
		placeholder = '',
		class: className = '',
		style = '',
		'aria-label': ariaLabel,
	}: {
		value?: string;
		name?: string;
		id?: string;
		form?: string;
		rows?: number;
		placeholder?: string;
		class?: string;
		style?: string;
		'aria-label'?: string;
	} = $props();

	let editor: HTMLDivElement;
	let focused = $state(false);
	let blurTimer: ReturnType<typeof setTimeout>;

	$effect(() => {
		if (editor) {
			const html = value ?? '';
			if (editor.innerHTML !== html) {
				editor.innerHTML = renderRichText(html);
			}
		}
	});

	function syncValue() {
		const html = editor.innerHTML;
		value = html === '<br>' ? '' : html;
	}

	// Pasted content (e.g. from a chat app) arrives with inline styles, wrapper divs and
	// backgrounds. Reduce it to the supported subset; plain text gets markdown lists.
	function handlePaste(e: ClipboardEvent) {
		const data = e.clipboardData;
		if (!data) return;
		const html = data.getData('text/html');
		const clean = html ? sanitizeRichText(html) : plainTextToRichText(data.getData('text/plain'));
		e.preventDefault();
		if (clean) document.execCommand('insertHTML', false, clean);
		syncValue();
	}

	// Typing "- ", "* " or "1. " at the start of a line starts a list.
	function handleInput(e: Event) {
		const ie = e as InputEvent;
		if (ie.inputType === 'insertText' && ie.data === ' ') applyListShortcut();
		syncValue();
	}

	function applyListShortcut() {
		const sel = window.getSelection();
		const node = sel?.anchorNode;
		if (!sel?.isCollapsed || !node || node.nodeType !== Node.TEXT_NODE) return;
		if (node.previousSibling && node.previousSibling.nodeName !== 'BR') return;
		if (node.parentElement?.closest('li')) return;

		const match = (node.textContent ?? '').slice(0, sel.anchorOffset).match(/^([-*]|1[.)])[\s\u00a0]$/);
		if (!match) return;

		const range = document.createRange();
		range.setStart(node, 0);
		range.setEnd(node, sel.anchorOffset);
		sel.removeAllRanges();
		sel.addRange(range);
		document.execCommand('delete', false);
		document.execCommand(match[1].startsWith('1') ? 'insertOrderedList' : 'insertUnorderedList', false);
	}

	function handleFocus() {
		clearTimeout(blurTimer);
		focused = true;
	}

	function handleBlur() {
		blurTimer = setTimeout(() => {
			focused = false;
		}, 120);
	}

	function cmd(command: string) {
		clearTimeout(blurTimer);
		document.execCommand(command, false);
		editor.focus();
		syncValue();
	}

	function applyCode() {
		clearTimeout(blurTimer);
		const sel = window.getSelection();
		if (!sel || sel.rangeCount === 0) { editor.focus(); return; }
		const range = sel.getRangeAt(0);
		const code = document.createElement('code');
		try {
			range.surroundContents(code);
		} catch {
			const frag = range.extractContents();
			code.appendChild(frag);
			range.insertNode(code);
		}
		editor.focus();
		syncValue();
	}

	function applyHRule() {
		clearTimeout(blurTimer);
		document.execCommand('insertHorizontalRule', false);
		editor.focus();
		syncValue();
	}

	const tools = [
		{ label: 'Bold',    icon: Bold,   action: () => cmd('bold') },
		{ label: 'Italic',  icon: Italic, action: () => cmd('italic') },
		{ label: 'Code',    icon: Code2,  action: applyCode },
		{ label: 'List',    icon: List,   action: () => cmd('insertUnorderedList') },
		{ label: 'Numbered list', icon: ListOrdered, action: () => cmd('insertOrderedList') },
		{ label: 'Divider', icon: Minus,  action: applyHRule },
	];

	const minHeight = $derived(`calc(${rows} * 1.6em + 0.5rem)`);
</script>

<div class="rich-textarea-root">
	<div
		class="rich-toolbar"
		class:visible={focused}
		role="toolbar"
		aria-label="Text formatting"
		aria-hidden={!focused}
	>
		{#each tools as tool}
			<button
				type="button"
				aria-label={tool.label}
				title={tool.label}
				onmousedown={(e) => {
					e.preventDefault();
					tool.action();
				}}
				class="tool-btn"
			>
				<tool.icon size={16} aria-hidden="true" />
			</button>
		{/each}
	</div>

	<div
		bind:this={editor}
		contenteditable="true"
		role="textbox"
		aria-multiline="true"
		{id}
		aria-label={ariaLabel}
		data-placeholder={placeholder}
		class="rich-editor rich-text {className}"
		class:ce-focused={focused}
		style="{style}; min-height: {minHeight};"
		oninput={handleInput}
		onpaste={handlePaste}
		onfocus={handleFocus}
		onblur={handleBlur}
	></div>

	{#if name}
		<input type="hidden" {name} {form} bind:value />
	{/if}
</div>

<style>
	.rich-textarea-root {
		position: relative;
	}

	.rich-toolbar {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		display: flex;
		gap: 1px;
		padding: 3px 4px;
		border: 1px solid var(--color-border);
		border-top: none;
		border-radius: 0 0 0.5rem 0.5rem;
		background: var(--color-muted);
		z-index: 10;
		visibility: hidden;
		opacity: 0;
		pointer-events: none;
		transition: none;
	}

	.rich-toolbar.visible {
		visibility: visible;
		opacity: 1;
		pointer-events: auto;
		transition: none;
	}

	.tool-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 4px;
		border: none;
		background: transparent;
		color: var(--color-muted-foreground);
		cursor: pointer;
		transition:
			background 120ms,
			color 120ms;
	}

	.tool-btn:hover {
		background: var(--color-border);
		color: var(--color-foreground);
	}

	.tool-btn:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -1px;
	}

	.rich-editor.ce-focused {
		border-bottom-left-radius: 0 !important;
		border-bottom-right-radius: 0 !important;
	}

	.rich-editor:empty::before {
		content: attr(data-placeholder);
		color: var(--color-muted-foreground);
		opacity: 0.5;
		pointer-events: none;
		cursor: text;
	}
</style>
