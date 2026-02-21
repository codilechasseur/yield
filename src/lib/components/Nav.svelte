<script lang="ts">
	import { page } from '$app/stores';
	import { LayoutDashboard, Users, FileText, PlusCircle, Settings, BarChart2, Landmark, LogOut, Menu, X } from 'lucide-svelte';

	let { authEnabled = false }: { authEnabled?: boolean } = $props();

	const links = [
		{ href: '/', label: 'Dashboard', icon: LayoutDashboard },
		{ href: '/invoices', label: 'Invoices', icon: FileText },
		{ href: '/reports', label: 'Reports', icon: BarChart2 },
		{ href: '/taxes', label: 'Taxes Paid', icon: Landmark },
		{ href: '/clients', label: 'Clients', icon: Users },
		{ href: '/settings', label: 'Settings', icon: Settings }
	];

	let drawerOpen = $state(false);

	function close() { drawerOpen = false; }
</script>

<!-- ── Desktop sidebar ─────────────────────────────────────────── -->
<aside
	class="hidden md:flex fixed left-0 top-0 h-screen w-56 flex-col"
	style="background-color: var(--color-card); border-right: 1px solid var(--color-border)"
>
	<!-- Brand -->
	<div class="px-6 py-5 border-b" style="border-color: var(--color-border)">
		<a href="/" class="flex items-center gap-2.5 no-underline hover:opacity-80 transition-opacity">
			<div class="w-8 h-8 shrink-0" style="color: var(--color-primary)">
				<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
					<polyline points="2.7 22.7 11.3 14 18 20.7 29.3 9.3" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
					<polyline points="21.3 9.3 29.3 9.3 29.3 17.3" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			</div>
			<div>
				<h1 class="text-xl font-bold tracking-tight leading-none" style="color: var(--color-primary)">Yield</h1>
				<p class="text-xs mt-0.5" style="color: var(--color-muted-foreground)">Invoice Manager</p>
			</div>
		</a>
	</div>

	<!-- Nav links -->
	<nav class="flex-1 px-2 py-4 space-y-0.5">
		{#each links as link}
			{@const active = $page.url.pathname === link.href || ($page.url.pathname.startsWith(link.href) && link.href !== '/')}
			<a
				href={link.href}
				class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative"
				style={active
					? 'background-color: var(--color-accent); color: var(--color-primary); font-weight: 600'
					: 'color: var(--color-muted-foreground)'}
			>
				{#if active}
					<span class="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full" style="background-color: var(--color-primary)"></span>
				{/if}
				<link.icon size={17} />
				{link.label}
			</a>
		{/each}
	</nav>

	<!-- Quick action -->
	<div class="px-3 py-4 border-t" style="border-color: var(--color-border)">
		<a
			href="/invoices/new"
			class="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
			style="background-color: var(--color-primary); color: var(--color-primary-foreground)"
		>
			<PlusCircle size={16} />
			New Invoice
		</a>

		{#if authEnabled}
			<form method="POST" action="/login?/logout" class="mt-2">
				<button
					type="submit"
					class="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg text-xs font-medium transition-colors hover:opacity-80"
					style="color: var(--color-muted-foreground)"
				>
					<LogOut size={13} />
					Sign out
				</button>
			</form>
		{/if}
	</div>
</aside>

<!-- ── Mobile top header ───────────────────────────────────────── -->
<header
	class="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 h-14"
	style="background-color: var(--color-card); border-bottom: 1px solid var(--color-border)"
>
	<button
		type="button"
		onclick={() => drawerOpen = true}
		class="p-1.5 rounded-lg -ml-1"
		style="color: var(--color-foreground)"
		aria-label="Open menu"
	>
		<Menu size={22} />
	</button>

	<a href="/" class="flex items-center gap-2 flex-1 no-underline hover:opacity-80 transition-opacity">
		<div class="w-6 h-6 shrink-0" style="color: var(--color-primary)">
			<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
				<polyline points="2.7 22.7 11.3 14 18 20.7 29.3 9.3" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
				<polyline points="21.3 9.3 29.3 9.3 29.3 17.3" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>
		</div>
		<span class="font-bold text-base tracking-tight" style="color: var(--color-primary)">Yield</span>
	</a>
</header>

<!-- ── Mobile drawer ───────────────────────────────────────────── -->
{#if drawerOpen}
	<!-- Backdrop -->
	<button
		type="button"
		class="md:hidden fixed inset-0 z-50"
		style="background: rgba(0,0,0,0.4)"
		onclick={close}
		aria-label="Close menu"
	></button>

	<!-- Panel -->
	<div
		class="md:hidden fixed top-0 left-0 h-full w-72 z-50 flex flex-col"
		style="background-color: var(--color-card); border-right: 1px solid var(--color-border)"
	>
		<!-- Drawer header -->
		<div class="flex items-center justify-between px-5 py-4 border-b" style="border-color: var(--color-border)">
			<a href="/" onclick={close} class="flex items-center gap-2.5 no-underline hover:opacity-80 transition-opacity">
				<div class="w-7 h-7 shrink-0" style="color: var(--color-primary)">
					<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
						<polyline points="2.7 22.7 11.3 14 18 20.7 29.3 9.3" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
						<polyline points="21.3 9.3 29.3 9.3 29.3 17.3" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
				</div>
				<div>
					<p class="font-bold text-base leading-none" style="color: var(--color-primary)">Yield</p>
					<p class="text-xs mt-0.5" style="color: var(--color-muted-foreground)">Invoice Manager</p>
				</div>
			</a>
			<button type="button" onclick={close} class="p-1.5 rounded-lg" style="color: var(--color-muted-foreground)" aria-label="Close menu">
				<X size={18} />
			</button>
		</div>

		<!-- Links -->
		<nav class="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
			{#each links as link}
				{@const active = $page.url.pathname === link.href || ($page.url.pathname.startsWith(link.href) && link.href !== '/')}
				<a
					href={link.href}
					onclick={close}
					class="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors relative"
					style={active
						? 'background-color: var(--color-accent); color: var(--color-primary); font-weight: 600'
						: 'color: var(--color-muted-foreground)'}
				>
					{#if active}
						<span class="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full" style="background-color: var(--color-primary)"></span>
					{/if}
					<link.icon size={18} />
					{link.label}
				</a>
			{/each}
		</nav>

		<!-- Drawer footer -->
		<div class="px-3 py-4 border-t" style="border-color: var(--color-border)">
			<a
				href="/invoices/new"
				onclick={close}
				class="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium"
				style="background-color: var(--color-primary); color: var(--color-primary-foreground)"
			>
				<PlusCircle size={16} />
				New Invoice
			</a>

			{#if authEnabled}
				<form method="POST" action="/login?/logout" class="mt-2">
					<button
						type="submit"
						class="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg text-xs font-medium hover:opacity-80"
						style="color: var(--color-muted-foreground)"
					>
						<LogOut size={13} />
						Sign out
					</button>
				</form>
			{/if}
		</div>
	</div>
{/if}


<aside
	class="hidden md:flex fixed left-0 top-0 h-screen w-56 flex-col"
	style="background-color: var(--color-card); border-right: 1px solid var(--color-border)"
>
	<!-- Brand -->
	<div class="px-6 py-5 border-b" style="border-color: var(--color-border)">
		<a href="/" class="flex items-center gap-2.5 no-underline hover:opacity-80 transition-opacity">
			<div class="w-8 h-8 shrink-0" style="color: var(--color-primary)">
				<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
					<polyline points="2.7 22.7 11.3 14 18 20.7 29.3 9.3" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
					<polyline points="21.3 9.3 29.3 9.3 29.3 17.3" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			</div>
			<div>
				<h1 class="text-xl font-bold tracking-tight leading-none" style="color: var(--color-primary)">Yield</h1>
				<p class="text-xs mt-0.5" style="color: var(--color-muted-foreground)">Invoice Manager</p>
			</div>
		</a>
	</div>

	<!-- Nav links -->
	<nav class="flex-1 px-2 py-4 space-y-0.5">
		{#each links as link}
			{@const active = $page.url.pathname === link.href || ($page.url.pathname.startsWith(link.href) && link.href !== '/')}
			<a
				href={link.href}
				class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative"
				style={active
					? 'background-color: var(--color-accent); color: var(--color-primary); font-weight: 600'
					: 'color: var(--color-muted-foreground)'}
			>
				{#if active}
					<span class="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full" style="background-color: var(--color-primary)"></span>
				{/if}
				<link.icon size={17} />
				{link.label}
			</a>
		{/each}
	</nav>

	<!-- Quick action -->
	<div class="px-3 py-4 border-t" style="border-color: var(--color-border)">
		<a
			href="/invoices/new"
			class="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
			style="background-color: var(--color-primary); color: var(--color-primary-foreground)"
		>
			<PlusCircle size={16} />
			New Invoice
		</a>

		{#if authEnabled}
			<form method="POST" action="/login?/logout" class="mt-2">
				<button
					type="submit"
					class="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg text-xs font-medium transition-colors hover:opacity-80"
					style="color: var(--color-muted-foreground)"
				>
					<LogOut size={13} />
					Sign out
				</button>
			</form>
		{/if}
	</div>
</aside>


