<script lang="ts">
	import { ClipboardList, Plus, ChevronLeft, ChevronRight, X } from 'lucide-svelte';
	import { page as pageStore } from '$app/stores';
	import { goto } from '$app/navigation';
	import { STATUS_COLORS, formatCurrency } from '$lib/pocketbase.js';
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();

	const statuses = ['', 'draft', 'sent', 'accepted', 'declined', 'expired'];
	const statusLabels: Record<string, string> = {
		'': 'All',
		draft: 'Draft',
		sent: 'Sent',
		accepted: 'Accepted',
		declined: 'Declined',
		expired: 'Expired'
	};

	function formatDate(d: string) {
		return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
	}

	function filterUrl(overrides: Record<string, string>) {
		const params = new URLSearchParams($pageStore.url.searchParams);
		for (const [k, v] of Object.entries(overrides)) {
			if (v) params.set(k, v);
			else params.delete(k);
		}
		params.delete('page');
		return `?${params}`;
	}

	function pageUrl(p: number) {
		const params = new URLSearchParams($pageStore.url.searchParams);
		params.set('page', String(p));
		return `?${params}`;
	}

	function navigate(overrides: Record<string, string>) {
		goto(filterUrl(overrides));
	}

	const now = new Date();

	function displayStatus(est: typeof data.estimates[0]): string {
		if (est.status === 'sent' && est.expiry_date && new Date(est.expiry_date) < now) return 'expired';
		return est.status;
	}

	const activeClients = $derived(data.clients.filter(c => !c.archived));
	const archivedClients = $derived(data.clients.filter(c => c.archived));
	const hasFilters = $derived(!!(data.clientFilter));
</script>

<svelte:head>
	<title>Estimates — Yield</title>
</svelte:head>

<div class="max-w-5xl mx-auto">
	<!-- Header -->
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h2 class="text-2xl font-bold" style="color: var(--color-foreground)">Estimates</h2>
			<p class="mt-1 text-sm" style="color: var(--color-muted-foreground)">
				{data.totalItems} estimate{data.totalItems !== 1 ? 's' : ''}
				{data.statusFilter ? `· ${statusLabels[data.statusFilter] ?? data.statusFilter}` : ''}
				{data.clientFilter ? `· ${data.clients.find(c => c.id === data.clientFilter)?.name ?? data.clientFilter}` : ''}
			</p>
		</div>
		<a
			href="/estimates/new"
			class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
			style="background-color: var(--color-primary); color: var(--color-primary-foreground)"
		>
			<Plus size={16} /> New Estimate
		</a>
	</div>

	<!-- Status tabs -->
	<div class="mb-4">
		<div class="sm:hidden">
			<label for="estimate-status-filter" class="sr-only">Filter by status</label>
			<select
				id="estimate-status-filter"
				class="w-full px-3 py-2 rounded-lg text-sm font-medium border"
				style="background: var(--color-card); color: var(--color-foreground); border-color: var(--color-border)"
				onchange={(e) => navigate({ status: (e.target as HTMLSelectElement).value })}
			>
				{#each statuses as s}
					<option value={s} selected={data.statusFilter === s}>{statusLabels[s]}</option>
				{/each}
			</select>
		</div>
		<div class="hidden sm:block overflow-x-auto">
			<div class="flex gap-1 p-1 rounded-lg w-fit min-w-max" style="background: var(--color-muted)">
				{#each statuses as s}
					<a
						href={filterUrl({ status: s })}
						class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
						style={data.statusFilter === s
							? 'background: var(--color-card); color: var(--color-foreground); box-shadow: 0 1px 2px rgba(0,0,0,0.05)'
							: 'color: var(--color-muted-foreground)'}
					>
						{statusLabels[s]}
					</a>
				{/each}
			</div>
		</div>
	</div>

	<!-- Client filter -->
	<div class="mb-6 flex flex-wrap items-center gap-3">
		<div class="flex flex-col gap-1">
			<label for="estimate-client-filter" class="text-xs font-medium" style="color: var(--color-muted-foreground)">Client</label>
			<select
				id="estimate-client-filter"
				class="px-3 py-2 rounded-lg text-sm border min-w-48"
				style="background: var(--color-card); color: var(--color-foreground); border-color: var(--color-border)"
				onchange={(e) => navigate({ client: (e.target as HTMLSelectElement).value })}
			>
				<option value="" selected={!data.clientFilter}>All clients</option>
				{#if activeClients.length > 0}
					<optgroup label="Active">
						{#each activeClients as c}
							<option value={c.id} selected={data.clientFilter === c.id}>{c.name}</option>
						{/each}
					</optgroup>
				{/if}
				{#if archivedClients.length > 0}
					<optgroup label="Archived">
						{#each archivedClients as c}
							<option value={c.id} selected={data.clientFilter === c.id}>{c.name}</option>
						{/each}
					</optgroup>
				{/if}
			</select>
		</div>

		{#if hasFilters}
			<div class="flex flex-col gap-1">
				<span class="text-xs" style="color: transparent">Clear</span>
				<a
					href={filterUrl({ client: '' })}
					class="flex items-center gap-1 px-3 py-2 rounded-lg text-sm border transition-colors hover:bg-muted"
					style="border-color: var(--color-border); color: var(--color-muted-foreground)"
				>
					<X size={13} /> Clear filters
				</a>
			</div>
		{/if}
	</div>

	<!-- Estimates table -->
	{#if data.estimates.length === 0}
		<div class="rounded-xl border p-16 text-center" style="background: var(--color-card); border-color: var(--color-border)">
			<ClipboardList size={40} class="mx-auto mb-4 opacity-20" style="color: var(--color-foreground)" />
			<p class="font-medium" style="color: var(--color-foreground)">No estimates found</p>
			<p class="text-sm mt-1" style="color: var(--color-muted-foreground)">
				{data.statusFilter || data.clientFilter ? 'Try adjusting or clearing your filters.' : 'Create your first estimate to get started.'}
			</p>
		</div>
	{:else}
		<div class="rounded-xl border overflow-hidden" style="background: var(--color-card); border-color: var(--color-border)">
			<div class="overflow-x-auto">
				<table class="w-full">
					<thead>
						<tr style="border-bottom: 1px solid var(--color-border); background: var(--color-muted)">
							<th class="text-left px-4 py-3" style="color: var(--color-muted-foreground)">Number</th>
							<th class="text-left px-4 py-3 hidden sm:table-cell" style="color: var(--color-muted-foreground)">Client</th>
							<th class="text-left px-4 py-3 hidden md:table-cell" style="color: var(--color-muted-foreground)">Issued</th>
							<th class="text-left px-4 py-3 hidden md:table-cell" style="color: var(--color-muted-foreground)">Valid Until</th>
							<th class="text-left px-4 py-3" style="color: var(--color-muted-foreground)">Status</th>
							<th class="text-right px-4 py-3" style="color: var(--color-muted-foreground)">Total</th>
						</tr>
					</thead>
					<tbody>
						{#each data.estimates as est}
							{@const ds = displayStatus(est)}
							<tr
								onclick={() => goto(`/estimates/${est.id}`)}
								class="border-b cursor-pointer transition-colors hover:bg-muted"
								style="border-color: var(--color-border)"
							>
								<td class="px-4 py-3 font-medium" style="color: var(--color-foreground)">
									{est.number}
									<span class="sm:hidden block text-xs mt-0.5" style="color: var(--color-muted-foreground)">
										{est.expand?.client?.name ?? '—'}
									</span>
								</td>
								<td class="px-4 py-3 hidden sm:table-cell" style="color: var(--color-foreground)">{est.expand?.client?.name ?? '—'}</td>
								<td class="px-4 py-3 hidden md:table-cell text-sm" style="color: var(--color-muted-foreground)">{formatDate(est.issue_date)}</td>
								<td class="px-4 py-3 hidden md:table-cell text-sm" style="color: var(--color-muted-foreground)">{formatDate(est.expiry_date)}</td>
								<td class="px-4 py-3">
									<span class="{STATUS_COLORS[ds] ?? 'status-badge status-draft'}">
										{ds === 'written_off' ? 'Written Off' : ds.replace(/\b\w/g, c => c.toUpperCase())}
									</span>
								</td>
								<td class="px-4 py-3 text-right font-medium" style="color: var(--color-foreground)">
									{formatCurrency(est.total, est.expand?.client?.currency ?? 'USD')}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<!-- Pagination -->
		{#if data.totalPages > 1}
			<div class="mt-4 flex items-center justify-between">
				<p class="text-sm" style="color: var(--color-muted-foreground)">
					Page {data.page} of {data.totalPages}
				</p>
				<div class="flex gap-2">
					{#if data.page > 1}
						<a href={pageUrl(data.page - 1)} class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border transition-colors hover:bg-muted" style="border-color: var(--color-border); color: var(--color-foreground)">
							<ChevronLeft size={14} /> Prev
						</a>
					{/if}
					{#if data.page < data.totalPages}
						<a href={pageUrl(data.page + 1)} class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border transition-colors hover:bg-muted" style="border-color: var(--color-border); color: var(--color-foreground)">
							Next <ChevronRight size={14} />
						</a>
					{/if}
				</div>
			</div>
		{/if}
	{/if}
</div>
