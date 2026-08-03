<script lang="ts">
	import { page } from '$app/state';
	import { getPreset } from '$lib/presets.js';

	let { class: klass = 'w-8 h-8' }: { class?: string } = $props();

	const appLogoUrl = $derived((page.data.appLogoUrl as string) ?? '');
	const mark = $derived(getPreset(page.data.brandPreset as string).mark);
</script>

{#if appLogoUrl}
	<img src={appLogoUrl} alt="" class="{klass} shrink-0 object-contain" style="display: block" />
{:else if mark === 'block-cursor'}
	<!-- Solid block cursor at a 2:5 ratio, painted with the signal colour. -->
	<div class="{klass} shrink-0 flex items-center justify-center" aria-hidden="true">
		<svg viewBox="0 0 28 70" class="brand-cursor h-full" xmlns="http://www.w3.org/2000/svg" focusable="false">
			<rect class="brand-cursor__rect" width="28" height="70" />
		</svg>
	</div>
{:else}
	<div class="{klass} shrink-0" style="color: var(--color-primary)" aria-hidden="true">
		<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false">
			<polyline points="2.7 22.7 11.3 14 18 20.7 29.3 9.3" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
			<polyline points="21.3 9.3 29.3 9.3 29.3 17.3" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
		</svg>
	</div>
{/if}
