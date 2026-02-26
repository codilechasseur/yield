<!--
  FormAlert — a themed error or success message banner for form feedback.
  Props:
    message  – the text to display; renders nothing when falsy
    variant  – 'error' (default) | 'success'
    class    – extra CSS classes (default 'mb-4')
-->
<script lang="ts">
	interface Props {
		message?: string | null | undefined;
		variant?: 'error' | 'success';
		class?: string;
	}

	let { message, variant = 'error', class: className = 'mb-4' }: Props = $props();

	const colorVar = $derived(variant === 'error' ? 'var(--color-destructive)' : 'var(--color-success)');
</script>

{#if message}
	<div
		role={variant === 'error' ? 'alert' : 'status'}
		class="flex items-start gap-2.5 px-4 py-3 rounded-lg text-sm {className}"
		style="background-color: color-mix(in oklch, {colorVar} 12%, transparent); color: {colorVar}; border: 1px solid color-mix(in oklch, {colorVar} 25%, transparent)"
	>
		{#if variant === 'error'}
			<!-- Info-circle icon -->
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="shrink-0 mt-0.5"
				width="15"
				height="15"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
				focusable="false"
			>
				<circle cx="12" cy="12" r="10" />
				<line x1="12" y1="8" x2="12" y2="12" />
				<line x1="12" y1="16" x2="12.01" y2="16" />
			</svg>
		{:else}
			<!-- Checkmark icon -->
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="shrink-0 mt-0.5"
				width="15"
				height="15"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
				focusable="false"
			>
				<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
				<polyline points="22 4 12 14.01 9 11.01" />
			</svg>
		{/if}
		<span>{message}</span>
	</div>
{/if}
