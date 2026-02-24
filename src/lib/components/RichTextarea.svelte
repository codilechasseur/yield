<script lang="ts">
	import { Bold, Italic, Code2, List, Minus } from 'lucide-svelte';

	let {
		value = $bindable(''),
		name,
		id,
		rows = 3,
		placeholder = '',
		class: className = '',
		style = '',
		'aria-label': ariaLabel,
		...rest
	}: {
		value?: string;
		name?: string;
		id?: string;
		rows?: number;
		placeholder?: string;
		class?: string;
		style?: string;
		'aria-label'?: string;
		[key: string]: unknown;
	} = $props();

	let textarea: HTMLTextAreaElement;
	let focused = $state(false);
	let blurTimer: ReturnType<typeof setTimeout>;

	function handleFocus() {
		clearTimeout(blurTimer);
		focused = true;
	}

	function handleBlur() {
		blurTimer = setTimeout(() => {
			focused = false;
		}, 120);
	}

	function applyFormat(before: string, after = before) {
		clearTimeout(blurTimer);
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const sel = value.slice(start, end);
		value = value.slice(0, start) + before + sel + after + value.slice(end);
		requestAnimationFrame(() => {
			textarea.focus();
			const cursor = sel ? start + before.length : start + before.length;
			textarea.setSelectionRange(cursor, cursor + sel.length);
		});
	}

	function applyBullet() {
		clearTimeout(blurTimer);
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		// Expand to full lines
		const lineStart = value.lastIndexOf('\n', start - 1) + 1;
		const lineEnd = value.indexOf('\n', end);
		const block = value.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
		const lines = block.split('\n');
		const allBulleted = lines.every((l) => l.startsWith('• '));
		const replaced = lines.map((l) => (allBulleted ? l.slice(2) : '• ' + l)).join('\n');
		value =
			value.slice(0, lineStart) +
			replaced +
			(lineEnd === -1 ? '' : value.slice(lineEnd));
		requestAnimationFrame(() => {
			textarea.focus();
		});
	}

	function applyHRule() {
		clearTimeout(blurTimer);
		const pos = textarea.selectionStart;
		const before = value.slice(0, pos);
		const after = value.slice(pos);
		const prefix = before.length && !before.endsWith('\n') ? '\n' : '';
		const suffix = after.length && !after.startsWith('\n') ? '\n' : '';
		const rule = prefix + '─────────────────────' + suffix;
		value = before + rule + after;
		requestAnimationFrame(() => {
			textarea.focus();
		});
	}

	const tools = [
		{ label: 'Bold', icon: Bold, action: () => applyFormat('**') },
		{ label: 'Italic', icon: Italic, action: () => applyFormat('_') },
		{ label: 'Code', icon: Code2, action: () => applyFormat('`') },
		{ label: 'Bullet list', icon: List, action: applyBullet },
		{ label: 'Divider', icon: Minus, action: applyHRule }
	];
</script>

<div class="rich-textarea-root">
	<!-- Toolbar -->
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
				<tool.icon size={13} aria-hidden="true" />
			</button>
		{/each}
	</div>

	<!-- Textarea -->
	<textarea
		bind:this={textarea}
		bind:value
		{name}
		{id}
		{rows}
		{placeholder}
		aria-label={ariaLabel}
		class={className}
		{style}
		onfocus={handleFocus}
		onblur={handleBlur}
		{...rest}
	></textarea>
</div>

<style>
	.rich-textarea-root {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.rich-toolbar {
		display: flex;
		gap: 1px;
		padding: 3px 4px;
		border: 1px solid var(--color-border);
		border-bottom: none;
		border-radius: 0.5rem 0.5rem 0 0;
		background: var(--color-muted);
		opacity: 0;
		transform: translateY(4px);
		pointer-events: none;
		transition:
			opacity 150ms ease,
			transform 150ms ease;
	}

	.rich-toolbar.visible {
		opacity: 1;
		transform: translateY(0);
		pointer-events: auto;
	}

	.tool-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
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

	/* When toolbar is visible, square off the top corners of the textarea */
	.rich-textarea-root:has(.rich-toolbar.visible) :global(textarea) {
		border-top-left-radius: 0 !important;
		border-top-right-radius: 0 !important;
	}

	/* Use a slightly softer corner to join with toolbar when not focused */
	:global(.rich-textarea-root textarea) {
		transition: border-radius 150ms ease;
	}
</style>
