<script lang="ts">
	import { fly } from 'svelte/transition';
	import { Check, X, AlertCircle } from 'lucide-svelte';
	import { toasts, removeToast } from '$lib/toasts.svelte.js';
</script>

<!--
  Two separate live regions: assertive for errors, polite for success.
  Mixing role="alert" (implicit assertive) inside aria-live="polite" causes
  conflicting live-region semantics in some screen readers.
-->
<div
	aria-label="Error notifications"
	aria-live="assertive"
	aria-atomic="false"
	class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col-reverse items-center gap-2 pointer-events-none"
>
	{#each toasts.filter(t => t.type === 'error') as toast (toast.id)}
		<div
			role="alert"
			in:fly={{ y: 16, duration: 200 }}
			out:fly={{ y: 8, duration: 150 }}
			class="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium min-w-52 max-w-sm"
			style="background-color: var(--color-destructive); color: #fff"
		>
			<AlertCircle size={15} aria-hidden="true" class="shrink-0" />
			<span class="flex-1">{toast.message}</span>
			<button
				type="button"
				onclick={() => removeToast(toast.id)}
				aria-label="Dismiss notification"
				class="shrink-0 opacity-70 hover:opacity-100 transition-opacity -mr-1"
			>
				<X size={14} aria-hidden="true" />
			</button>
		</div>
	{/each}
</div>

<div
	aria-label="Notifications"
	aria-live="polite"
	aria-atomic="false"
	class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col-reverse items-center gap-2 pointer-events-none"
>
	{#each toasts.filter(t => t.type !== 'error') as toast (toast.id)}
		<div
			role="status"
			in:fly={{ y: 16, duration: 200 }}
			out:fly={{ y: 8, duration: 150 }}
			class="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium min-w-52 max-w-sm"
			style="background-color: var(--color-primary); color: var(--color-primary-foreground)"
		>
			<Check size={15} aria-hidden="true" class="shrink-0" />
			<span class="flex-1">{toast.message}</span>
			<button
				type="button"
				onclick={() => removeToast(toast.id)}
				aria-label="Dismiss notification"
				class="shrink-0 opacity-70 hover:opacity-100 transition-opacity -mr-1"
			>
				<X size={14} aria-hidden="true" />
			</button>
		</div>
	{/each}
</div>
