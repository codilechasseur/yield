<script lang="ts">
	import { FileText, Plus, Download, ChevronLeft, ChevronRight, X } from 'lucide-svelte';
	import { page as pageStore } from '$app/stores';
	import { goto } from '$app/navigation';
	import { STATUS_COLORS, formatCurrency } from '$lib/pocketbase.js';
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();

	const statuses = ['', 'draft', 'sent', 'paid', 'overdue', 'written_off'];
	const statusLabels: Record<string, string> = {
		'': 'All',
		draft: 'Draft',
		sent: 'Sent',
		paid: 'Paid',
		overdue: 'Overdue',
		written_off: 'Written Off'
	};

	function formatDate(d: string) {
		return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
	}

	/** Build a URL that merges overrides into current search params, resetting page to 1. */
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

	const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

	const activeClients = $derived(data.clients.filter(c => !c.archived));
	const archivedClients = $derived(data.clients.filter(c => c.archived));

	const hasSecondaryFilters = $derived(!!(data.clientFilter || data.yearFilter));

	// When year is cleared, also clear month
	function navigateYear(year: string) {
		navigate({ year, month: '' });
	}

	function navigateMonth(month: string) {
		navigate({ month });
	}
</script>

<svelte:head>
	<title>Invoices — Yield</title>
</svelte:head>

<div class="max-w-5xl mx-auto">
	<!-- Header -->
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h2 class="text-2xl font-bold" style="color: var(--color-foreground)">Invoices</h2>
			<p class="mt-1 text-sm" style="color: var(--color-muted-foreground)">
				{data.totalItems} invoice{data.totalItems !== 1 ? 's' : ''}
				{data.statusFilter ? `· ${statusLabels[data.statusFilter] ?? data.statusFilter}` : ''}
				{data.clientFilter ? `· ${data.clients.find(c => c.id === data.clientFilter)?.name ?? data.clientFilter}` : ''}
			{data.yearFilter ? `· ${data.yearFilter}${data.monthFilter ? ` / ${MONTH_NAMES[data.monthFilter - 1]}` : ''}` : ''}
			</p>
		</div>
		<a
			href="/invoices/new"
			class="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
			style="background-color: var(--color-primary); color: var(--color-primary-foreground)"
		>
			<Plus size={16} /> New Invoice
		</a>
	</div>

	<!-- Status filter — dropdown on mobile, tabs on desktop -->
	<div class="mb-4">
		<!-- Mobile dropdown -->
		<div class="sm:hidden">
			<label for="invoice-status-filter" class="sr-only">Filter by status</label>
			<select
				id="invoice-status-filter"
				class="w-full px-3 py-2 rounded-lg text-sm font-medium border"
				style="background: var(--color-card); color: var(--color-foreground); border-color: var(--color-border)"
				onchange={(e) => navigate({ status: (e.target as HTMLSelectElement).value })}
			>
				{#each statuses as s}
					<option value={s} selected={data.statusFilter === s}>{statusLabels[s]}</option>
				{/each}
			</select>
		</div>
		<!-- Desktop tabs -->
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

	<!-- Secondary filters: client + month -->
	<div class="mb-6 flex flex-wrap items-center gap-3">
		<div class="flex flex-col gap-1">
			<label for="invoice-client-filter" class="text-xs font-medium" style="color: var(--color-muted-foreground)">Client</label>
			<select
				id="invoice-client-filter"
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

		<div class="flex flex-col gap-1">
			<label for="invoice-year-filter" class="text-xs font-medium" style="color: var(--color-muted-foreground)">Year</label>
			<select
				id="invoice-year-filter"
				class="px-3 py-2 rounded-lg text-sm border"
				style="background: var(--color-card); color: var(--color-foreground); border-color: var(--color-border)"
				onchange={(e) => navigateYear((e.target as HTMLSelectElement).value)}
			>
				<option value="" selected={!data.yearFilter}>All years</option>
				{#each data.availableYears as y}
					<option value={y} selected={data.yearFilter === y}>{y}</option>
				{/each}
			</select>
		</div>

		<div class="flex flex-col gap-1">
			<label for="invoice-month-filter" class="text-xs font-medium" style="color: var(--color-muted-foreground)">Month</label>
			<select
				id="invoice-month-filter"
				class="px-3 py-2 rounded-lg text-sm border"
				style="background: var(--color-card); color: var(--color-foreground); border-color: var(--color-border)"
				disabled={!data.yearFilter}
				onchange={(e) => navigateMonth((e.target as HTMLSelectElement).value)}
			>
				<option value="" selected={!data.monthFilter}>All months</option>
				{#each MONTH_NAMES as name, i}
					<option value={i + 1} selected={data.monthFilter === i + 1}>{name}</option>
				{/each}
			</select>
		</div>

		{#if hasSecondaryFilters}
			<div class="flex flex-col gap-1">
				<span class="text-xs" style="color: transparent">Clear</span>
				<a
					href={filterUrl({ client: '', year: '', month: '' })}
					class="flex items-center gap-1 px-3 py-2 rounded-lg text-sm border transition-colors hover:bg-muted"
					style="border-color: var(--color-border); color: var(--color-muted-foreground)"
				>
					<X size={13} /> Clear filters
				</a>
			</div>
		{/if}
	</div>

	<!-- Invoice table -->
	{#if data.invoices.length === 0}
		<div class="rounded-xl border p-16 text-center" style="background: var(--color-card); border-color: var(--color-border)">
			<FileText size={40} class="mx-auto mb-4 opacity-20" style="color: var(--color-foreground)" />
			<p class="font-medium" style="color: var(--color-foreground)">No invoices found</p>
			<p class="text-sm mt-1" style="color: var(--color-muted-foreground)">
				{data.statusFilter || data.clientFilter || data.yearFilter ? 'Try adjusting or clearing your filters.' : 'Create your first invoice to get started.'}
			</p>
		</div>
	{:else}
		<div class="rounded-xl border overflow-x-auto" style="background: var(--color-card); border-color: var(--color-border)">
		<table class="w-full min-w-175">
				<thead>
					<tr style="border-bottom: 1px solid var(--color-border)">
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium" style="color: var(--color-muted-foreground)">Number</th>
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium" style="color: var(--color-muted-foreground)">Client</th>
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium" style="color: var(--color-muted-foreground)">Issue Date</th>
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium" style="color: var(--color-muted-foreground)">Due Date</th>
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium" style="color: var(--color-muted-foreground)">Status</th>					<th scope="col" class="px-6 py-3 text-right text-xs font-medium" style="color: var(--color-muted-foreground)">Total</th>						<th scope="col" class="px-6 py-3 text-right text-xs font-medium" style="color: var(--color-muted-foreground)">PDF</th>
					</tr>
				</thead>
				<tbody>
					{#each data.invoices as inv}
						<tr class="hover:bg-muted/20 transition-colors" style="border-bottom: 1px solid var(--color-border)">
							<td class="px-6 py-3.5">
								<a href="/invoices/{inv.id}" class="font-medium text-sm" style="color: var(--color-primary)">{inv.number}</a>
							</td>
							<td class="px-6 py-3.5 text-sm" style="color: var(--color-foreground)">{inv.expand?.client?.name ?? '—'}</td>
							<td class="px-6 py-3.5 text-sm" style="color: var(--color-muted-foreground)">{formatDate(inv.issue_date)}</td>
							<td class="px-6 py-3.5 text-sm" style="color: var(--color-muted-foreground)">{formatDate(inv.due_date)}</td>
							<td class="px-6 py-3.5">
								<span class="{STATUS_COLORS[inv.status] ?? ''}">{inv.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
							</td>
							<td class="px-6 py-3.5 text-right text-sm font-medium" style="color: var(--color-foreground)">
								{formatCurrency(inv.total, inv.expand?.client?.currency)}
							</td>
							<td class="px-6 py-3.5 text-right">
								<a
									href="/api/invoice/{inv.id}/pdf"
									target="_blank"
									class="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors hover:bg-muted"
									style="border-color: var(--color-border); color: var(--color-muted-foreground)"
								>
									<Download size={12} /> PDF
								</a>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Pagination -->
		{#if data.totalPages > 1}
			<div class="mt-6 flex items-center justify-center gap-2">
				{#if data.page > 1}
					<a
						href={pageUrl(data.page - 1)}
						class="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm transition-colors hover:bg-muted"
						style="border-color: var(--color-border); color: var(--color-foreground)"
					>
						<ChevronLeft size={15} /> Prev
					</a>
				{:else}
					<span
						class="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm opacity-40 cursor-default"
						style="border-color: var(--color-border); color: var(--color-foreground)"
					>
						<ChevronLeft size={15} /> Prev
					</span>
				{/if}

				<span class="text-sm px-2" style="color: var(--color-muted-foreground)">
					Page {data.page} of {data.totalPages}
				</span>

				{#if data.page < data.totalPages}
					<a
						href={pageUrl(data.page + 1)}
						class="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm transition-colors hover:bg-muted"
						style="border-color: var(--color-border); color: var(--color-foreground)"
					>
						Next <ChevronRight size={15} />
					</a>
				{:else}
					<span
						class="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm opacity-40 cursor-default"
						style="border-color: var(--color-border); color: var(--color-foreground)"
					>
						Next <ChevronRight size={15} />
					</span>
				{/if}
			</div>
		{/if}
	{/if}
</div>
