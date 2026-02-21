<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { Users, Plus, Trash2, Mail, MapPin, Archive, ArchiveRestore, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-svelte';
	import { formatCurrency } from '$lib/pocketbase.js';
	import type { PageData, ActionData } from './$types.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let showForm = $state(false);
	let submitting = $state(false);

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
	{#if form?.error}
		<div class="mb-4 px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
			{form.error}
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
					<textarea
						id="new-address"
						name="address"
						rows="2"
						placeholder="123 Main St, City, State ZIP"
						class="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
						style="background-color: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
					></textarea>
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

	<!-- Clients grid -->
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
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each data.clients as client}
				{@const ct = data.clientTotals[client.id]}
				<div
					class="rounded-xl border p-5 flex flex-col gap-3"
					style="background-color: var(--color-card); border-color: var(--color-border){data.showArchived ? '; opacity: 0.8' : ''}"
				>
					<div class="flex items-start justify-between">
						<div>
							<p class="font-semibold" style="color: var(--color-foreground)">{client.name}</p>
							<span
								class="inline-block mt-1 px-2 py-0.5 rounded text-xs font-mono"
								style="background-color: var(--color-muted); color: var(--color-muted-foreground)"
							>
								{client.currency}
							</span>
						</div>
						<a
							href="/clients/{client.id}"
							class="p-1.5 rounded-lg transition-colors hover:bg-muted"
							style="color: var(--color-muted-foreground)"
						>
							<ArrowRight size={15} />
						</a>
					</div>

					{#if client.email}
						<div class="flex items-center gap-2 text-sm" style="color: var(--color-muted-foreground)">
							<Mail size={14} />
							<span>{client.email}</span>
						</div>
					{/if}
					{#if client.address}
						<div class="flex items-start gap-2 text-sm" style="color: var(--color-muted-foreground)">
							<MapPin size={14} class="mt-0.5 shrink-0" />
							<span class="line-clamp-2">{client.address}</span>
						</div>
					{/if}

					{#if ct && ct.invoiceCount > 0}
						<div class="grid grid-cols-2 gap-2 rounded-lg px-3 py-2.5" style="background-color: var(--color-muted)">
							<div>
								<p class="text-xs mb-0.5" style="color: var(--color-muted-foreground)">Total billed</p>
								<p class="text-sm font-semibold" style="color: var(--color-foreground)">{formatCurrency(ct.total, client.currency)}</p>
							</div>
							<div>
								<p class="text-xs mb-0.5" style="color: var(--color-muted-foreground)">Outstanding</p>
								<p class="text-sm font-semibold" style="color: {ct.outstanding > 0 ? 'var(--color-primary)' : 'var(--color-muted-foreground)'}">{formatCurrency(ct.outstanding, client.currency)}</p>
							</div>
						</div>
					{/if}

					<div class="mt-auto pt-2 border-t flex justify-end gap-1" style="border-color: var(--color-border)">
						{#if data.showArchived}
							<form method="POST" action="?/unarchive" use:enhance>
								<input type="hidden" name="id" value={client.id} />
								<button
									type="submit"
									class="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors hover:bg-muted"
									style="color: var(--color-muted-foreground)"
									title="Restore client"
								>
									<ArchiveRestore size={13} /> Restore
								</button>
							</form>
							<form method="POST" action="?/delete" use:enhance>
								<input type="hidden" name="id" value={client.id} />
								<button
									type="submit"
									onclick={(e) => { if (!confirm(`Permanently delete ${client.name}?`)) e.preventDefault(); }}
									class="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
								>
									<Trash2 size={13} /> Delete
								</button>
							</form>
						{:else}
							<form method="POST" action="?/archive" use:enhance>
								<input type="hidden" name="id" value={client.id} />
								<button
									type="submit"
									class="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors hover:bg-muted"
									style="color: var(--color-muted-foreground)"
									title="Archive client"
								>
									<Archive size={13} /> Archive
								</button>
							</form>
						{/if}
					</div>
				</div>
			{/each}
		</div>

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
	{/if}
</div>
