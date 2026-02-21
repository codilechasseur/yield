<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowLeft, Mail, MapPin, Save } from 'lucide-svelte';
	import { STATUS_COLORS, formatCurrency } from '$lib/pocketbase.js';
	import type { PageData, ActionData } from './$types.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let editing = $state(false);
	let saving = $state(false);

	function formatDate(d: string) {
		return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}
</script>

<svelte:head>
	<title>{data.client.name} — Yield</title>
</svelte:head>

<div class="max-w-5xl mx-auto">
	<a href="/clients" class="inline-flex items-center gap-1.5 text-sm mb-6" style="color: var(--color-muted-foreground)">
		<ArrowLeft size={15} /> Back to Clients
	</a>

	{#if form?.error}
		<div class="mb-4 px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm">{form.error}</div>
	{/if}

	<!-- Client Header -->
	<div class="rounded-xl border p-4 md:p-6 mb-6" style="background-color: var(--color-card); border-color: var(--color-border)">
		{#if editing}
			<form
				method="POST"
				action="?/update"
				use:enhance={() => {
					saving = true;
					return async ({ update }) => { saving = false; editing = false; await update(); };
				}}
				class="space-y-4"
			>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div>
						<label for="edit-name" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">Name *</label>
						<input id="edit-name" name="name" required value={data.client.name}
							class="w-full px-3 py-2 rounded-lg border text-sm"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						/>
					</div>
					<div>
						<label for="edit-email" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">Email</label>
						<input id="edit-email" name="email" type="email" value={data.client.email}
							class="w-full px-3 py-2 rounded-lg border text-sm"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						/>
					</div>
					<div class="col-span-2">
						<label for="edit-address" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">Address</label>
						<textarea id="edit-address" name="address" rows="2" class="w-full px-3 py-2 rounded-lg border text-sm resize-none"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						>{data.client.address}</textarea>
					</div>
					<div>
						<label for="edit-currency" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">Currency</label>
						<select id="edit-currency" name="currency" class="w-full px-3 py-2 rounded-lg border text-sm"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						>
							{#each ['USD', 'EUR', 'GBP', 'CAD', 'AUD'] as c}
								<option selected={data.client.currency === c}>{c}</option>
							{/each}
						</select>
					</div>
				</div>
				<div class="flex gap-3 justify-end">
					<button type="button" onclick={() => editing = false}
						class="px-4 py-2 text-sm rounded-lg border"
						style="border-color: var(--color-border); color: var(--color-muted-foreground)"
					>Cancel</button>
					<button type="submit" disabled={saving}
						class="flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium disabled:opacity-60"
						style="background: var(--color-primary); color: var(--color-primary-foreground)"
					>
						<Save size={15} /> {saving ? 'Saving...' : 'Save'}
					</button>
				</div>
			</form>
		{:else}
			<div class="flex items-start justify-between">
				<div>
					<h2 class="text-xl font-bold" style="color: var(--color-foreground)">{data.client.name}</h2>
					<span class="inline-block mt-1 px-2 py-0.5 rounded text-xs font-mono"
						style="background: var(--color-muted); color: var(--color-muted-foreground)"
					>{data.client.currency}</span>
				</div>
				<button onclick={() => editing = true}
					class="px-3 py-1.5 text-sm rounded-lg border font-medium"
					style="border-color: var(--color-border); color: var(--color-foreground)"
				>Edit</button>
			</div>
			<div class="mt-4 space-y-2">
				{#if data.client.email}
					<div class="flex items-center gap-2 text-sm" style="color: var(--color-muted-foreground)">
						<Mail size={14} /> {data.client.email}
					</div>
				{/if}
				{#if data.client.address}
					<div class="flex items-start gap-2 text-sm" style="color: var(--color-muted-foreground)">
						<MapPin size={14} class="mt-0.5" /> {data.client.address}
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Client Invoices -->
	<div class="rounded-xl border overflow-hidden" style="background: var(--color-card); border-color: var(--color-border)">
		<div class="px-6 py-4 border-b flex items-center justify-between" style="border-color: var(--color-border)">
			<h3 class="font-semibold" style="color: var(--color-foreground)">Invoices ({data.invoices.length})</h3>
			<a href="/invoices/new?client={data.client.id}"
				class="text-xs font-medium"
				style="color: var(--color-primary)"
			>+ New Invoice</a>
		</div>
		{#if data.invoices.length === 0}
			<p class="px-6 py-8 text-sm text-center" style="color: var(--color-muted-foreground)">No invoices for this client yet.</p>
		{:else}
			<div class="overflow-x-auto">
			<table class="w-full min-w-100">
				<thead>
					<tr style="border-bottom: 1px solid var(--color-border)">
						<th class="px-6 py-3 text-left text-xs font-medium" style="color: var(--color-muted-foreground)">Number</th>
						<th class="px-6 py-3 text-left text-xs font-medium" style="color: var(--color-muted-foreground)">Issue Date</th>
						<th class="px-6 py-3 text-left text-xs font-medium" style="color: var(--color-muted-foreground)">Due Date</th>
						<th class="px-6 py-3 text-left text-xs font-medium" style="color: var(--color-muted-foreground)">Status</th>					<th class="px-6 py-3 text-right text-xs font-medium" style="color: var(--color-muted-foreground)">Total</th>					</tr>
				</thead>
				<tbody>
					{#each data.invoices as inv}
						<tr style="border-bottom: 1px solid var(--color-border)">
							<td class="px-6 py-3">
								<a href="/invoices/{inv.id}" class="text-sm font-medium" style="color: var(--color-primary)">{inv.number}</a>
							</td>
							<td class="px-6 py-3 text-sm" style="color: var(--color-muted-foreground)">{inv.issue_date ? formatDate(inv.issue_date) : '—'}</td>
							<td class="px-6 py-3 text-sm" style="color: var(--color-muted-foreground)">{inv.due_date ? formatDate(inv.due_date) : '—'}</td>
							<td class="px-6 py-3">
								<span class="{STATUS_COLORS[inv.status] ?? ''}">{inv.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
							</td>						<td class="px-6 py-3 text-right text-sm font-medium" style="color: var(--color-foreground)">{formatCurrency(inv.total, data.client.currency)}</td>						</tr>
					{/each}
				</tbody>
			</table>
			</div>
		{/if}
	</div>
</div>
