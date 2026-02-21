<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import Nav from '$lib/components/Nav.svelte';
	import type { LayoutData } from './$types.js';

	let { children, data }: { children: any; data: LayoutData } = $props();

	const isLogin = $derived($page.url.pathname === '/login');
</script>

{#if isLogin}
	{@render children()}
{:else}
	<div class="min-h-screen flex" style="background-color: var(--color-background)">
		<Nav authEnabled={data.authEnabled} />
		<main class="flex-1 md:ml-56 p-4 md:p-8 pt-18 md:pt-8 md:pb-8 overflow-x-hidden">
			{@render children()}
		</main>
	</div>
{/if}
