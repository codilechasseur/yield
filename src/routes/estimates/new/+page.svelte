<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { ArrowLeft, Plus, Trash2, Settings2 } from 'lucide-svelte';
	import DatePicker from '$lib/components/DatePicker.svelte';
	import RichTextarea from '$lib/components/RichTextarea.svelte';
	import QuickAddClient from '$lib/components/QuickAddClient.svelte';
	import { addToast } from '$lib/toasts.svelte.js';
	import type { PageData, ActionData } from './$types.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	interface LineItem {
		id: number;
		description: string;
		quantity: number;
		unit_price: number;
	}

	let items = $state<LineItem[]>([{ id: 1, description: '', quantity: 1, unit_price: 0 }]);
	let taxPercent = $state<number>(untrack(() => data.defaultTaxPercent ?? 5));
	let notes = $state('');
	let submitting = $state(false);
	let nextId = $state(2);
	let selectedClientId = $state(untrack(() => data.preselectedClient ?? ''));

	const selectedClient = $derived(data.clients.find((c) => c.id === selectedClientId) ?? null);

	$effect(() => {
		const rate = selectedClient?.default_hourly_rate;
		if (rate != null && rate > 0) {
			items = items.map((item) => (item.unit_price === 0 ? { ...item, unit_price: rate } : item));
		}
	});

	const today = new Date().toISOString().split('T')[0];
	const defaultExpiry = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

	let showAdvanced = $state(false);
	let estimateNumber = $state(untrack(() => data.suggestedEstimateNumber ?? `EST-${today.replace(/-/g, '')}-001`));
	let issueDateVal = $state(today);
	let expiryDateVal = $state(defaultExpiry);

	function addItem() {
		const defaultRate = selectedClient?.default_hourly_rate ?? 0;
		items = [...items, { id: nextId++, description: '', quantity: 1, unit_price: defaultRate }];
	}

	function removeItem(id: number) {
		if (items.length > 1) items = items.filter((i) => i.id !== id);
	}

	function subtotal(): number {
		return items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
	}

	function tax(): number {
		return subtotal() * (taxPercent / 100);
	}

	function total(): number {
		return subtotal() + tax();
	}

	function fmt(n: number): string {
		const currency = selectedClient?.currency ?? 'USD';
		return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
	}
</script>

<svelte:head>
	<title>New Estimate — Yield</title>
</svelte:head>

<div class="max-w-5xl mx-auto">
	<a href="/estimates" class="inline-flex items-center gap-1.5 text-sm mb-6" style="color: var(--color-muted-foreground)">
		<ArrowLeft size={15} /> Estimates
	</a>
	<h2 class="text-2xl font-bold mb-6" style="color: var(--color-foreground)">New Estimate</h2>

	{#if form?.error}
		<div class="mb-4 rounded-lg px-4 py-3 text-sm" style="background: color-mix(in srgb, var(--color-destructive) 10%, transparent); color: var(--color-destructive); border: 1px solid color-mix(in srgb, var(--color-destructive) 30%, transparent)">
			{form.error}
		</div>
	{/if}

	<form
		method="POST"
		use:enhance={({ formData }) => {
			formData.set('items', JSON.stringify(items.map(({ description, quantity, unit_price }) => ({ description, quantity, unit_price }))));
			submitting = true;
			return async ({ update, result }) => {
				submitting = false;
				if (result.type === 'failure') addToast((result.data as Record<string, string>)?.error ?? 'Failed to create estimate', 'error');
				await update();
			};
		}}
	>
		<div class="grid gap-6 lg:grid-cols-3">
			<!-- Left: main form -->
			<div class="lg:col-span-2 space-y-6">
				<!-- Client -->
				<div class="rounded-xl border p-5" style="background: var(--color-card); border-color: var(--color-border)">
					<h3 class="text-sm font-semibold mb-4" style="color: var(--color-foreground)">Client</h3>
					<div class="flex gap-3 items-end">
						<div class="flex-1">
							<label for="est-client" class="block text-sm font-medium mb-1.5" style="color: var(--color-foreground)">Client</label>
							<select
								id="est-client"
								name="client"
								required
								bind:value={selectedClientId}
								class="w-full px-3 py-2 rounded-lg border text-sm"
								style="background: var(--color-background); color: var(--color-foreground); border-color: var(--color-border)"
							>
								<option value="">Select a client…</option>
								{#each data.clients as c}
									<option value={c.id}>{c.name}</option>
								{/each}
							</select>
						</div>
						<QuickAddClient clients={data.clients} bind:selectedId={selectedClientId} inputId="est-client-quick" />
					</div>
				</div>

				<!-- Line items -->
				<div class="rounded-xl border p-5" style="background: var(--color-card); border-color: var(--color-border)">
					<h3 class="text-sm font-semibold mb-4" style="color: var(--color-foreground)">Line Items</h3>

					<div class="space-y-3">
						{#each items as item (item.id)}
							<div class="grid gap-2 items-start" style="grid-template-columns: 1fr auto auto auto">
								<div>
									<label for="item-desc-{item.id}" class="sr-only">Description</label>
									<input
										id="item-desc-{item.id}"
										type="text"
										placeholder="Description"
										bind:value={item.description}
										class="w-full px-3 py-2 rounded-lg border text-sm"
										style="background: var(--color-background); color: var(--color-foreground); border-color: var(--color-border)"
									/>
								</div>
								<div>
									<label for="item-qty-{item.id}" class="sr-only">Quantity</label>
									<input
										id="item-qty-{item.id}"
										type="number"
										min="0"
										step="any"
										placeholder="Qty"
										bind:value={item.quantity}
										class="w-20 px-3 py-2 rounded-lg border text-sm text-right"
										style="background: var(--color-background); color: var(--color-foreground); border-color: var(--color-border)"
									/>
								</div>
								<div>
									<label for="item-price-{item.id}" class="sr-only">Unit price</label>
									<input
										id="item-price-{item.id}"
										type="number"
										min="0"
										step="any"
										placeholder="Price"
										bind:value={item.unit_price}
										class="w-28 px-3 py-2 rounded-lg border text-sm text-right"
										style="background: var(--color-background); color: var(--color-foreground); border-color: var(--color-border)"
									/>
								</div>
								<button
									type="button"
									onclick={() => removeItem(item.id)}
									aria-label="Remove item"
									class="p-2 rounded-lg transition-colors hover:bg-muted"
									style="color: var(--color-muted-foreground)"
									disabled={items.length === 1}
								>
									<Trash2 size={15} />
								</button>
							</div>
						{/each}
					</div>

					<button
						type="button"
						onclick={addItem}
						class="mt-4 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-colors hover:bg-muted"
						style="color: var(--color-primary); border-color: var(--color-primary)"
					>
						<Plus size={14} /> Add Line Item
					</button>

					<!-- Totals summary -->
					<div class="mt-5 pt-4 border-t space-y-1" style="border-color: var(--color-border)">
						<div class="flex justify-between text-sm" style="color: var(--color-muted-foreground)">
							<span>Subtotal</span><span>{fmt(subtotal())}</span>
						</div>
						{#if taxPercent > 0}
							<div class="flex justify-between text-sm" style="color: var(--color-muted-foreground)">
								<span>Tax ({taxPercent}%)</span><span>{fmt(tax())}</span>
							</div>
						{/if}
						<div class="flex justify-between text-sm font-semibold pt-1" style="color: var(--color-foreground)">
							<span>Total</span><span>{fmt(total())}</span>
						</div>
					</div>
				</div>

				<!-- Notes -->
				<div class="rounded-xl border p-5" style="background: var(--color-card); border-color: var(--color-border)">
					<h3 class="text-sm font-semibold mb-3" style="color: var(--color-foreground)">Notes</h3>
					<RichTextarea name="notes" bind:value={notes} placeholder="Optional notes visible on the estimate…" rows={4} />
				</div>
			</div>

			<!-- Right: sidebar -->
			<div class="space-y-5">
				<!-- Dates -->
				<div class="rounded-xl border p-5" style="background: var(--color-card); border-color: var(--color-border)">
					<h3 class="text-sm font-semibold mb-4" style="color: var(--color-foreground)">Dates</h3>

					<div class="space-y-4">
						<div>
							<label for="est-issue" class="block text-sm font-medium mb-1.5" style="color: var(--color-foreground)">Issue Date</label>
							<DatePicker id="est-issue" name="issue_date" bind:value={issueDateVal} />
						</div>
						<div>
							<label for="est-expiry" class="block text-sm font-medium mb-1.5" style="color: var(--color-foreground)">Valid Until</label>
							<DatePicker id="est-expiry" name="expiry_date" bind:value={expiryDateVal} />
						</div>
					</div>
				</div>

				<!-- Advanced -->
				<div class="rounded-xl border" style="background: var(--color-card); border-color: var(--color-border)">
					<button
						type="button"
						onclick={() => (showAdvanced = !showAdvanced)}
						class="w-full flex items-center justify-between px-5 py-4 text-sm font-medium transition-colors hover:bg-muted rounded-xl"
						style="color: var(--color-foreground)"
						aria-expanded={showAdvanced}
					>
						<span class="flex items-center gap-2"><Settings2 size={15} /> Advanced</span>
						<span style="color: var(--color-muted-foreground)">{showAdvanced ? '▲' : '▼'}</span>
					</button>
					{#if showAdvanced}
						<div class="px-5 pb-5 space-y-4 border-t" style="border-color: var(--color-border)">
							<div class="pt-4">
								<label for="est-number" class="block text-sm font-medium mb-1.5" style="color: var(--color-foreground)">Estimate Number</label>
								<input
									id="est-number"
									type="text"
									name="number"
									bind:value={estimateNumber}
									required
									class="w-full px-3 py-2 rounded-lg border text-sm"
									style="background: var(--color-background); color: var(--color-foreground); border-color: var(--color-border)"
								/>
							</div>
							<div>
								<label for="est-tax" class="block text-sm font-medium mb-1.5" style="color: var(--color-foreground)">Tax Rate (%)</label>
								<input
									id="est-tax"
									type="number"
									name="tax_percent"
									min="0"
									max="100"
									step="0.01"
									bind:value={taxPercent}
									class="w-full px-3 py-2 rounded-lg border text-sm"
									style="background: var(--color-background); color: var(--color-foreground); border-color: var(--color-border)"
								/>
							</div>
							<div>
								<label for="est-status" class="block text-sm font-medium mb-1.5" style="color: var(--color-foreground)">Status</label>
								<select
									id="est-status"
									name="status"
									class="w-full px-3 py-2 rounded-lg border text-sm"
									style="background: var(--color-background); color: var(--color-foreground); border-color: var(--color-border)"
								>
									<option value="draft">Draft</option>
									<option value="sent">Sent</option>
									<option value="accepted">Accepted</option>
								</select>
							</div>
						</div>
					{/if}
				</div>
				{#if !showAdvanced}
					<input type="hidden" name="number" value={estimateNumber} />
					<input type="hidden" name="tax_percent" value={taxPercent} />
					<input type="hidden" name="status" value="draft" />
				{/if}

				<button
					type="submit"
					disabled={submitting}
					class="w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
					style="background: var(--color-primary); color: var(--color-primary-foreground)"
				>
					{submitting ? 'Creating…' : 'Create Estimate'}
				</button>
			</div>
		</div>
	</form>
</div>
