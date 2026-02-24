<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import Nav from '$lib/components/Nav.svelte';
	import Toaster from '$lib/components/Toaster.svelte';
	import type { LayoutData } from './$types.js';

	let { children, data }: { children: any; data: LayoutData } = $props();

	const isLogin = $derived($page.url.pathname === '/login');
</script>

{#if isLogin}
	{@render children()}
{:else}
	<a
		href="#main-content"
		class="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-3 focus:left-3 focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-medium"
		style="background-color: var(--color-primary); color: var(--color-primary-foreground)"
	>
		Skip to main content
	</a>
	<div class="min-h-screen flex" style="background-color: var(--color-background)">
		<Nav authEnabled={data.authEnabled} />
		<main id="main-content" class="flex-1 min-w-0 md:ml-56 p-4 md:p-8 pt-18 md:pt-8 md:pb-8 overflow-x-clip" tabindex="-1">
			{@render children()}
		</main>
		<Toaster />
	</div>
{/if}
