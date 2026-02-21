<script lang="ts">
	import { HelpCircle } from 'lucide-svelte';
	let { tip }: { tip: string } = $props();
	let show = $state(false);
</script>

<!--
  Inline tooltip trigger. Renders a HelpCircle icon next to a label.
  Keyboard-accessible: focus shows the tooltip; Escape hides it.
  Usage:  <label>Address <Tip tip="Shown below your name…" /></label>
-->
<span class="relative inline-flex items-center align-middle ml-1">
	<button
		type="button"
		aria-label="More information"
		aria-expanded={show}
		class="inline-flex items-center justify-center cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 rounded-full transition-opacity hover:opacity-70 select-none"
		style="color: var(--color-primary); opacity: 0.6"
		onmouseenter={() => (show = true)}
		onmouseleave={() => (show = false)}
		onfocus={() => (show = true)}
		onblur={() => (show = false)}
		onkeydown={(e) => { if (e.key === 'Escape') { show = false; (e.currentTarget as HTMLElement).blur(); } }}
	><HelpCircle size={13} aria-hidden="true" /></button>

	{#if show}
		<span
			role="tooltip"
			class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 z-50 w-56 rounded-xl px-3 py-2.5 text-xs leading-relaxed shadow-lg pointer-events-none whitespace-normal"
			style="background-color: var(--color-card); color: var(--color-muted-foreground); border: 1px solid var(--color-border); box-shadow: 0 4px 16px -2px color-mix(in srgb, var(--color-foreground) 12%, transparent)"
		>
			{tip}
			<!-- Arrow -->
			<span
				class="absolute top-full left-1/2 -translate-x-1/2"
				style="
					width: 0; height: 0;
					border-left: 5px solid transparent;
					border-right: 5px solid transparent;
					border-top: 5px solid var(--color-border);
				"
			></span>
		</span>
	{/if}
</span>
