<script lang="ts">
	import { Bug, Trash2 } from 'lucide-svelte';
	import {
		debugState,
		setDebugEnabled,
		debugLog,
		clearDebugLog,
		addDebugEntry
	} from '$lib/debug.svelte.js';
	import type { DebugEntryType } from '$lib/debug.svelte.js';

	// ── Filter ──────────────────────────────────────────────────────────
	type Filter =  'all' | DebugEntryType;
	let activeFilter = $state<Filter>('all');

	const filterPills: { value: Filter; label: string }[] = [
		{ value: 'all',                  label: 'All' },
		{ value: 'toast:success',        label: 'Toast: success' },
		{ value: 'toast:error',          label: 'Toast: error' },
		{ value: 'js-error',             label: 'JS error' },
		{ value: 'unhandled-rejection',  label: 'Unhandled rejection' },
		{ value: 'server:error',         label: 'Server error' }
	];

	// ── Server error polling ─────────────────────────────────────────────
	// When debug is enabled, poll the server-error ring buffer every 5 s so
	// that exceptions thrown during server load functions and actions show up
	// in the log alongside client-side events.
	let _lastServerId = -1;

	async function fetchServerErrors() {
		try {
			const res = await fetch(`/api/debug/server-errors?after=${_lastServerId}`);
			if (!res.ok) return;
			const entries: Array<{ id: number; message: string; stack?: string; url?: string; timestamp: string }> = await res.json();
			for (const e of entries) {
				const detail = [e.stack, e.url ? `route: ${e.url}` : undefined].filter(Boolean).join('\n') || undefined;
				addDebugEntry('server:error', e.message, detail);
				if (e.id > _lastServerId) _lastServerId = e.id;
			}
		} catch {
			// silently ignore — server may be temporarily unreachable
		}
	}

	$effect(() => {
		if (!debugState.enabled) return;
		// Fetch immediately then poll every 5 s
		fetchServerErrors();
		const id = setInterval(fetchServerErrors, 5000);
		return () => clearInterval(id);
	});

	const filteredLog = $derived(
		activeFilter === 'all'
			? [...debugLog].reverse()
			: [...debugLog].filter(e => e.type === activeFilter).reverse()
	);

	// ── Badge colours ────────────────────────────────────────────────────
	function badgeStyle(type: DebugEntryType): string {
		switch (type) {
			case 'toast:success':
				return 'background-color: color-mix(in srgb, var(--color-primary) 15%, transparent); color: var(--color-primary)';
			case 'toast:error':
				return 'background-color: color-mix(in srgb, var(--color-destructive) 15%, transparent); color: var(--color-destructive)';
			case 'js-error':
				return 'background-color: color-mix(in srgb, orange 20%, transparent); color: darkorange';
			case 'unhandled-rejection':
				return 'background-color: color-mix(in srgb, var(--color-destructive) 15%, transparent); color: var(--color-destructive)';
			case 'server:error':
				return 'background-color: color-mix(in srgb, purple 15%, transparent); color: purple';
		}
	}

	function badgeLabel(type: DebugEntryType): string {
		switch (type) {
			case 'toast:success':       return 'toast ✓';
			case 'toast:error':         return 'toast ✗';
			case 'js-error':            return 'js error';
			case 'unhandled-rejection': return 'rejection';
			case 'server:error':        return 'server err';
		}
	}
</script>

<svelte:head>
	<title>Debug Log — Yield</title>
</svelte:head>

<div class="max-w-4xl mx-auto space-y-8">

	<!-- Page header -->
	<div class="flex items-start justify-between gap-4">
		<div>
			<div class="flex items-center gap-2 mb-1">
				<Bug size={20} style="color: var(--color-primary)" aria-hidden="true" />
				<h2 class="text-2xl font-bold" style="color: var(--color-foreground)">Debug Log</h2>
			</div>
			<p class="text-sm" style="color: var(--color-muted-foreground)">
				Captures toast notifications, JavaScript errors, and unhandled promise rejections in real time.
				Enable logging in <a href="/settings#debug" class="underline hover:opacity-80 transition-opacity">Settings → Debug</a>.
			</p>
		</div>
	</div>

	<!-- Enable toggle card -->
	<div class="rounded-xl border p-4 md:p-5 flex items-center justify-between gap-4" style="background-color: var(--color-card); border-color: var(--color-border)">
		<div>
			<p class="text-sm font-medium" style="color: var(--color-foreground)">Debug logging</p>
			<p class="text-xs mt-0.5" style="color: var(--color-muted-foreground)">
				{debugState.enabled ? 'Active — new events will be captured below.' : 'Disabled — enable to start capturing events.'}
			</p>
		</div>
		<button
			type="button"
			role="switch"
			aria-checked={debugState.enabled}
			onclick={() => setDebugEnabled(!debugState.enabled)}
			class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
			style={debugState.enabled
				? 'background-color: var(--color-primary); outline-color: var(--color-primary)'
				: 'background-color: var(--color-muted); outline-color: var(--color-primary)'}
			aria-label="Toggle debug logging"
		>
			<span
				aria-hidden="true"
				class="pointer-events-none inline-block size-5 rounded-full shadow-sm ring-0 transition-transform"
				style="background-color: white; transform: translateX({debugState.enabled ? '20px' : '0px'})"
			></span>
		</button>
	</div>

	<!-- Log panel -->
	<div class="rounded-xl border overflow-hidden" style="background-color: var(--color-card); border-color: var(--color-border)">

		<!-- Toolbar -->
		<div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b" style="border-color: var(--color-border)">
			<!-- Filter pills -->
			<div role="group" aria-label="Filter log by type" class="flex flex-wrap gap-1.5">
				{#each filterPills as pill}
					{@const active = activeFilter === pill.value}
					<button
						type="button"
						onclick={() => (activeFilter = pill.value)}
						class="px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
						style={active
							? 'background-color: var(--color-primary); color: var(--color-primary-foreground); border-color: var(--color-primary)'
							: 'background-color: transparent; color: var(--color-muted-foreground); border-color: var(--color-border)'}
						aria-pressed={active}
					>{pill.label}</button>
				{/each}
			</div>

			<!-- Entry count + clear -->
			<div class="flex items-center gap-3 shrink-0">
				{#if debugLog.length > 0}
					<span class="text-xs tabular-nums" style="color: var(--color-muted-foreground)">
						{filteredLog.length} of {debugLog.length} entr{debugLog.length === 1 ? 'y' : 'ies'}
					</span>
				{/if}
				<button
					type="button"
					onclick={clearDebugLog}
					disabled={debugLog.length === 0}
					class="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
					style="border-color: var(--color-border); color: var(--color-muted-foreground)"
					aria-label="Clear debug log"
				>
					<Trash2 size={12} aria-hidden="true" />
					Clear
				</button>
			</div>
		</div>

		<!-- Entries -->
		{#if debugLog.length === 0}
			<div class="px-4 py-12 text-center space-y-1">
				<p class="text-sm font-medium" style="color: var(--color-foreground)">
					{debugState.enabled ? 'No entries yet' : 'Logging is disabled'}
				</p>
				<p class="text-xs" style="color: var(--color-muted-foreground)">
					{debugState.enabled
						? 'Trigger a toast or cause an error to see it here.'
						: 'Toggle the switch above to start capturing events.'}
				</p>
			</div>
		{:else if filteredLog.length === 0}
			<p class="px-4 py-8 text-sm text-center" style="color: var(--color-muted-foreground)">
				No entries match the selected filter.
			</p>
		{:else}
			<ul role="list" class="divide-y max-h-[600px] overflow-y-auto" style="border-color: var(--color-border)">
				{#each filteredLog as entry (entry.id)}
					<li class="px-4 py-3 space-y-1">
						<div class="flex items-start gap-3">
							<span
								class="mt-0.5 shrink-0 px-1.5 py-0.5 rounded text-xs font-medium"
								style={badgeStyle(entry.type)}
							>{badgeLabel(entry.type)}</span>
							<span class="flex-1 text-sm break-all" style="color: var(--color-foreground)">{entry.message}</span>
							<time
								datetime={entry.timestamp.toISOString()}
								class="shrink-0 text-xs tabular-nums"
								style="color: var(--color-muted-foreground)"
							>{entry.timestamp.toLocaleTimeString()}</time>
						</div>
						{#if entry.detail}
							<pre class="ml-[calc(theme(spacing.3)+theme(spacing.3)+44px)] text-xs overflow-x-auto rounded p-2 mt-1" style="background-color: var(--color-muted); color: var(--color-muted-foreground)">{entry.detail}</pre>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
