<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { Users, Plus, Trash2, Mail, MapPin, Archive, ArchiveRestore, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-svelte';
	import { formatCurrency } from '$lib/pocketbase.js';
	import { addToast } from '$lib/toasts.svelte.js';
	import RichTextarea from '$lib/components/RichTextarea.svelte';
	import FormAlert from '$lib/components/FormAlert.svelte';
	import type { PageData, ActionData } from './$types.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let showForm = $state(false);
	let submitting = $state(false);
	let selectedIds = $state(new Set<string>());
	let bulkSubmitting = $state(false);
	/** true = every client across ALL pages is selected (sent as bulkAll=1 to server) */
	let selectAll = $state(false);

	let allSelected = $derived(
		data.clients.length > 0 && data.clients.every((c) => selectedIds.has(c.id))
	);

	/** Show the cross-page "select all X" prompt */
	let showSelectAllPrompt = $derived(
		allSelected && data.totalPages > 1 && !selectAll
	);

	function toggleSelect(id: string) {
		selectAll = false;
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedIds = next;
	}

	function toggleAll() {
		selectAll = false;
		if (allSelected) {
			selectedIds = new Set();
		} else {
			selectedIds = new Set(data.clients.map((c) => c.id));
		}
	}

	function clearSelection() {
		selectedIds = new Set();
		selectAll = false;
	}

	function pageUrl(p: number) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', String(p));
		return `?${params}`;
	}

	function tabUrl(archived: boolean) {
		const params = new URLSearchParams();
		if (archived) params.set('archived', '1');
		return `?${params}`;
	}
</script>

<svelte:head>
	<title>Clients — Yield</title>
</svelte:head>

<div class="max-w-5xl mx-auto">
	<!-- Header -->
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h2 class="text-2xl font-bold" style="color: var(--color-foreground)">Clients</h2>
			<p class="mt-1 text-sm" style="color: var(--color-muted-foreground)">
				{data.totalItems} client{data.totalItems !== 1 ? 's' : ''}
			</p>
		</div>
		<div class="flex items-center gap-2">
			{#if !data.showArchived}
				<button
					onclick={() => (showForm = !showForm)}
					class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
					style="background-color: var(--color-primary); color: var(--color-primary-foreground)"
				>
					<Plus size={16} />
					New Client
				</button>
			{/if}
		</div>
	</div>

	<!-- Tabs -->
	<div class="mb-6 flex gap-1 border-b" style="border-color: var(--color-border)">
		<a
			href={tabUrl(false)}
			class="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors"
			style={!data.showArchived
				? 'border-color: var(--color-primary); color: var(--color-primary)'
				: 'border-color: transparent; color: var(--color-muted-foreground)'}
		>
			Active
		</a>
		<a
			href={tabUrl(true)}
			class="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5"
			style={data.showArchived
				? 'border-color: var(--color-primary); color: var(--color-primary)'
				: 'border-color: transparent; color: var(--color-muted-foreground)'}
		>
			<Archive size={13} />
			Archived
		</a>
	</div>

	<!-- Error from form action -->
	<FormAlert message={form?.error} />

	<!-- Bulk action bar -->
	{#if selectedIds.size > 0}
		<div
			class="mb-4 sticky top-4 z-20 rounded-lg border overflow-hidden"
			style="background-color: var(--color-card); border-color: var(--color-primary); box-shadow: 0 4px 20px -4px color-mix(in srgb, var(--color-primary) 30%, transparent)"
		>
			<div class="px-4 py-3 flex items-center justify-between gap-3">
				<span class="text-sm font-medium" style="color: var(--color-foreground)">
					{#if selectAll}
						All {data.totalItems} client{data.totalItems !== 1 ? 's' : ''} selected
					{:else}
						{selectedIds.size} client{selectedIds.size !== 1 ? 's' : ''} selected
					{/if}
				</span>
				<div class="flex items-center gap-2">
					<button
						onclick={clearSelection}
						class="text-xs px-3 py-1.5 rounded-lg border transition-colors hover:bg-muted"
						style="border-color: var(--color-border); color: var(--color-muted-foreground)"
					>
						Clear
					</button>
					<form
						method="POST"
						action={data.showArchived ? '?/bulkUnarchive' : '?/bulkArchive'}
						use:enhance={() => {
							bulkSubmitting = true;
							return async ({ update }) => {
								bulkSubmitting = false;
								clearSelection();
								await update();
								window.scrollTo({ top: 0, behavior: 'smooth' });
							};
						}}
					>
						{#if selectAll}
							<input type="hidden" name="bulkAll" value="1" />
						{:else}
							{#each [...selectedIds] as id}
								<input type="hidden" name="ids[]" value={id} />
							{/each}
						{/if}
						<button
							type="submit"
							disabled={bulkSubmitting}
							class="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
							style="background-color: var(--color-primary); color: var(--color-primary-foreground)"
						>
							{#if data.showArchived}
								<ArchiveRestore size={13} />
								{bulkSubmitting ? 'Restoring…' : 'Restore selected'}
							{:else}
								<Archive size={13} />
								{bulkSubmitting ? 'Archiving…' : 'Archive selected'}
							{/if}
						</button>
					</form>
				</div>
			</div>
			<!-- Cross-page select-all prompt (shown when full page is checked and more pages exist) -->
			{#if showSelectAllPrompt}
				<div
					class="px-4 py-2 text-xs text-center border-t"
					style="background-color: color-mix(in srgb, var(--color-primary) 8%, transparent); border-color: var(--color-primary); color: var(--color-foreground)"
				>
					All {data.clients.length} clients on this page are selected.
					<button
						onclick={() => (selectAll = true)}
						class="font-semibold underline ml-1 hover:no-underline"
						style="color: var(--color-primary)"
					>
						Select all {data.totalItems} clients
					</button>
				</div>
			{/if}
			{#if selectAll}
				<div
					class="px-4 py-2 text-xs text-center border-t"
					style="background-color: color-mix(in srgb, var(--color-primary) 8%, transparent); border-color: var(--color-primary); color: var(--color-foreground)"
				>
					All {data.totalItems} clients are selected.
					<button
						onclick={clearSelection}
						class="font-semibold underline ml-1 hover:no-underline"
						style="color: var(--color-primary)"
					>
						Clear selection
					</button>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Create Client Form -->
	{#if showForm && !data.showArchived}
		<div
			class="mb-6 rounded-xl border p-4 md:p-6"
			style="background-color: var(--color-card); border-color: var(--color-border)"
		>
			<h3 class="font-semibold mb-4" style="color: var(--color-foreground)">New Client</h3>
			<form
				method="POST"
				action="?/create"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						submitting = false;
						showForm = false;
						await update();
					};
				}}
				class="grid grid-cols-1 sm:grid-cols-2 gap-4"
			>
				<div class="col-span-2 md:col-span-1">
					<label for="new-name" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">
						Name *
					</label>
					<input
						id="new-name"
						name="name"
						required
						placeholder="Acme Corp"
						class="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-primary/20"
						style="background-color: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
					/>
				</div>
				<div class="col-span-2 md:col-span-1">
					<label for="new-email" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">
						Email
					</label>
					<input
						id="new-email"
						name="email"
						type="email"
						placeholder="billing@acme.com"
						class="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-primary/20"
						style="background-color: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
					/>
				</div>
				<div class="col-span-2">
					<label for="new-address" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">
						Address
					</label>
					<RichTextarea
						id="new-address"
						name="address"
						rows={2}
						placeholder="123 Main St, City, State ZIP"
						class="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
						style="background-color: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
					/>
				</div>
				<div>
					<label for="new-currency" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">
						Currency
					</label>
					<select
						id="new-currency"
						name="currency"
						class="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-primary/20"
						style="background-color: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
					>
						{#each ['USD', 'EUR', 'GBP', 'CAD', 'AUD'] as c}
							<option value={c} selected={c === data.defaultCurrency}>{c}</option>
						{/each}
					</select>
				</div>
				<div>
					<label for="new-harvest" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">
						Harvest ID (optional)
					</label>
					<input
						id="new-harvest"
						name="harvest_id"
						placeholder="12345"
						class="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-primary/20"
						style="background-color: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
					/>
				</div>
				<div>
					<label for="new-hourly-rate" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">
						Default Hourly Rate (optional)
					</label>
					<input
						id="new-hourly-rate"
						name="default_hourly_rate"
						type="number"
						min="0"
						step="0.01"
						placeholder="Use global default"
						class="w-full px-3 py-2 rounded-lg border text-sm font-mono outline-none focus:ring-2 focus:ring-primary/20"
						style="background-color: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
					/>
				</div>
				<div class="col-span-2 flex gap-3 justify-end pt-2">
					<button
						type="button"
						onclick={() => (showForm = false)}
						class="px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
						style="border-color: var(--color-border); color: var(--color-muted-foreground)"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={submitting}
						class="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60 transition-opacity hover:opacity-90"
						style="background-color: var(--color-primary); color: var(--color-primary-foreground)"
					>
						{submitting ? 'Saving...' : 'Save Client'}
					</button>
				</div>
			</form>
		</div>
	{/if}

<!-- Client list -->
	{#if data.clients.length === 0}
		<div
			class="rounded-xl border p-16 text-center"
			style="background-color: var(--color-card); border-color: var(--color-border)"
		>
			<Users size={40} class="mx-auto mb-4 opacity-20" style="color: var(--color-foreground)" />
			<p class="font-medium" style="color: var(--color-foreground)">
				{data.showArchived ? 'No archived clients' : 'No clients yet'}
			</p>
			<p class="text-sm mt-1" style="color: var(--color-muted-foreground)">
				{data.showArchived ? 'Archived clients will appear here.' : 'Add your first client to get started.'}
			</p>
		</div>
	{:else}
		<div
			class="rounded-xl border overflow-hidden"
			style="background-color: var(--color-card); border-color: var(--color-border)"
		>
			<!-- Select-all header -->
			<div
				class="flex items-center gap-3 px-4 py-2 border-b"
				style="background-color: var(--color-muted); border-color: var(--color-border)"
			>
				<input
					type="checkbox"
					checked={allSelected}
					onchange={toggleAll}
					class="h-3.5 w-3.5 rounded border cursor-pointer accent-primary"
					style="border-color: var(--color-border)"
					aria-label="Select all clients"
				/>
				<span class="text-xs font-medium" style="color: var(--color-muted-foreground)">Select all</span>
			</div>
			{#each data.clients as client}
				{@const ct = data.clientTotals[client.id]}
				{@const hasDetails = !!(client.email || client.address || (ct && ct.invoiceCount > 0))}
				<div
					class="flex items-start gap-3 px-4 py-3.5 border-b last:border-b-0 transition-colors"
					style="border-color: var(--color-border){selectedIds.has(client.id) ? '; background-color: color-mix(in srgb, var(--color-primary) 5%, transparent)' : ''}{data.showArchived ? '; opacity: 0.75' : ''}"
				>
					<!-- Checkbox -->
					<input
						type="checkbox"
						checked={selectedIds.has(client.id)}
						onchange={() => toggleSelect(client.id)}
						class="mt-1 h-3.5 w-3.5 rounded border cursor-pointer accent-primary shrink-0"
						style="border-color: var(--color-border)"
						aria-label="Select {client.name}"
					/>
					<!-- Main content -->
					<div class="flex-1 min-w-0">
						<!-- Row 1: name + currency + actions -->
						<div class="flex items-center justify-between gap-3">
							<div class="flex items-center gap-2 min-w-0">
								<a
									href="/clients/{client.id}"
									class="font-semibold text-sm hover:underline truncate"
									style="color: var(--color-foreground)"
								>
									{client.name}
								</a>
								<span
									class="shrink-0 px-1.5 py-0.5 rounded text-xs font-mono"
									style="background-color: var(--color-muted); color: var(--color-muted-foreground)"
								>
									{client.currency}
								</span>
							</div>
							<!-- Actions -->
							<div class="flex items-center gap-0.5 shrink-0">
								{#if data.showArchived}
								<form method="POST" action="?/unarchive" use:enhance={() => async ({ update, result }) => { await update(); if (result.type !== 'failure') addToast(`${client.name} restored`); }}>
										<input type="hidden" name="id" value={client.id} />
										<button
											type="submit"
											class="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors hover:bg-muted"
											style="color: var(--color-muted-foreground)"
										aria-label="Restore {client.name}"
									>
										<ArchiveRestore size={13} aria-hidden="true" /> Restore
										</button>
									</form>
								<form method="POST" action="?/delete" use:enhance={() => async ({ update, result }) => { await update(); if (result.type !== 'failure') addToast(`${client.name} deleted`); }}>
										<input type="hidden" name="id" value={client.id} />
										<button
											type="submit"
											onclick={(e) => { if (!confirm(`Permanently delete ${client.name}?`)) e.preventDefault(); }}
											class="p-1.5 rounded transition-colors text-red-500 hover:bg-red-50"
										aria-label="Permanently delete {client.name}"
									>
										<Trash2 size={13} aria-hidden="true" />
										</button>
									</form>
								{:else}
								<form method="POST" action="?/archive" use:enhance={() => async ({ update, result }) => { await update(); if (result.type !== 'failure') addToast(`${client.name} archived`); }}>
										<input type="hidden" name="id" value={client.id} />
										<button
											type="submit"
											class="p-1.5 rounded transition-colors hover:bg-muted"
											style="color: var(--color-muted-foreground)"
										aria-label="Archive {client.name}"
									>
										<Archive size={13} aria-hidden="true" />
										</button>
									</form>
									<a
										href="/clients/{client.id}"
										class="p-1.5 rounded transition-colors hover:bg-muted"
										style="color: var(--color-muted-foreground)"
										aria-label="View {client.name}"
									>
										<ArrowRight size={13} aria-hidden="true" />
									</a>
								{/if}
							</div>
						</div>
						<!-- Row 2: secondary details -->
						{#if hasDetails}
							<div class="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
								{#if client.email}
									<span class="flex items-center gap-1 text-xs" style="color: var(--color-muted-foreground)">
										<Mail size={11} />
										{client.email}
									</span>
								{/if}
								{#if ct && ct.invoiceCount > 0}
									<span class="flex items-center gap-1 text-xs" style="color: var(--color-muted-foreground)">
										{ct.invoiceCount} invoice{ct.invoiceCount !== 1 ? 's' : ''}
										&middot;
										{formatCurrency(ct.total, client.currency)} billed
										{#if ct.outstanding > 0}
											&middot;
											<span style="color: var(--color-primary)">{formatCurrency(ct.outstanding, client.currency)} outstanding</span>
										{/if}
									</span>
								{/if}								{#if client.address}
									<span class="flex items-center gap-1 text-xs" style="color: var(--color-muted-foreground)">
										<MapPin size={11} />
										<span class="truncate max-w-56">{client.address?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()}</span>
									</span>
								{/if}							</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>
{/if}

<!-- Pagination -->
{#if data.totalPages > 1}
	<div class="mt-8 flex items-center justify-center gap-2">
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
</div>
