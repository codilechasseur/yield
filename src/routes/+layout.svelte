<script lang="ts">
	import '../app.css';
	// Must come after app.css: preset token blocks win the cascade by order.
	import '../presets.css';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { getPreset } from '$lib/presets.js';
	import Nav from '$lib/components/Nav.svelte';
	import Toaster from '$lib/components/Toaster.svelte';
	import DebugCapture from '$lib/components/DebugCapture.svelte';
	import type { LayoutData } from './$types.js';

	let { children, data }: { children: any; data: LayoutData } = $props();

	const isLogin = $derived($page.url.pathname === '/login');
	const themeColor = $derived(getPreset(data.brandPreset).themeColor);

	// Escape "</" so admin CSS can't close the style tag and inject markup.
	// The tag is assembled here (not in the template) because Svelte's markup
	// parser would treat a literal <style> inside an expression as a real tag.
	const safeCss = $derived((data.customCss ?? '').replaceAll('</', '<\\/'));
	const customStyleTag = $derived(safeCss ? '<style>' + safeCss + '</' + 'style>' : '');

	function syncAttr(attr: string, storageKey: string, value: string) {
		if (value) {
			localStorage.setItem(storageKey, value);
			document.documentElement.setAttribute(attr, value);
		} else {
			localStorage.removeItem(storageKey);
			document.documentElement.removeAttribute(attr);
		}
	}

	onMount(() => {
		// Sync brand settings from DB (source of truth); localStorage is just
		// the FOUC-free boot cache read by the inline script in app.html.
		const hue = String(data.brandHue ?? 250);
		localStorage.setItem('yield-hue', hue);
		document.documentElement.style.setProperty('--hue', hue);
		syncAttr('data-preset', 'yield-preset', data.brandPreset ?? '');
		syncAttr('data-font', 'yield-font', data.brandFont ?? '');
	});
</script>

<svelte:head>
	<meta name="description" content="{data.appName} — Self-hosted invoicing" />
	<meta name="theme-color" content={themeColor} />
	<meta name="apple-mobile-web-app-title" content={data.appName} />
	{#if data.faviconUrl}
		<!-- Later link wins over the static /favicon.svg from app.html -->
		<link rel="icon" href={data.faviconUrl} />
	{/if}
	{#if customStyleTag}
		{@html customStyleTag}
	{/if}
</svelte:head>

{#if isLogin}
	{@render children()}
{:else}
	<a
		href="#main-content"
		class="sr-only focus:not-sr-only focus:absolute focus:z-100 focus:top-3 focus:left-3 focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-medium"
		style="background-color: var(--color-primary); color: var(--color-primary-foreground)"
	>
		Skip to main content
	</a>
	<div class="min-h-screen flex" style="background-color: var(--color-background)">
		<Nav authEnabled={data.authEnabled} appName={data.appName} />
		<main id="main-content" class="flex-1 min-w-0 md:ml-56 p-4 md:p-8 pt-18 md:pt-8 md:pb-8 overflow-x-clip" tabindex="-1">
			{@render children()}
		</main>
		<Toaster />		<DebugCapture />	</div>
{/if}
