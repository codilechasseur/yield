<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { ArrowLeft, Plus, Trash2 } from 'lucide-svelte';
	import { addToast } from '$lib/toasts.svelte.js';
	import DatePicker from '$lib/components/DatePicker.svelte';
	import RichTextarea from '$lib/components/RichTextarea.svelte';
	import QuickAddClient from '$lib/components/QuickAddClient.svelte';
	import FormAlert from '$lib/components/FormAlert.svelte';
	import type { PageData, ActionData } from './$types.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	interface LineItem { id: number; description: string; quantity: number; unit_price: number; }

	let items = $state<LineItem[]>(untrack(() =>
		data.items.length
			? data.items.map((i, idx) => ({ id: idx + 1, description: i.description, quantity: i.quantity, unit_price: i.unit_price }))
			: [{ id: 1, description: '', quantity: 1, unit_price: 0 }]
	));
	let taxPercent = $state(untrack(() => data.estimate.tax_percent));
	let selectedClientId = $state(untrack(() => data.estimate.client ?? ''));
	let submitting = $state(false);
	let notes = $state(untrack(() => data.estimate.notes ?? ''));
	let nextId = $state(untrack(() => data.items.length + 1));
	let issueDateVal = $state(untrack(() => data.estimate.issue_date?.split('T')[0] ?? ''));
	let expiryDateVal = $state(untrack(() => data.estimate.expiry_date?.split('T')[0] ?? ''));

	function addItem() { items = [...items, { id: nextId++, description: '', quantity: 1, unit_price: 0 }]; }
	function removeItem(id: number) { if (items.length > 1) items = items.filter((i) => i.id !== id); }

	const subtotal = $derived(items.reduce((s, i) => s + i.quantity * i.unit_price, 0));
	const tax = $derived(subtotal * (taxPercent / 100));
	const total = $derived(subtotal + tax);

	function fmt(n: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n); }
</script>

<svelte:head>
	<title>Edit {data.estimate.number} — Yield</title>
</svelte:head>

<div class="max-w-5xl mx-auto">
	<a href="/estimates/{data.estimate.id}" class="inline-flex items-center gap-1.5 text-sm mb-6" style="color: var(--color-muted-foreground)">
		<ArrowLeft size={15} /> Back to Estimate
	</a>
	<h2 class="text-2xl font-bold mb-6" style="color: var(--color-foreground)">Edit Estimate</h2>

	<FormAlert message={form?.error} />

	<form method="POST"
		use:enhance={({ formData }) => {
			formData.set('items', JSON.stringify(items.map(({ description, quantity, unit_price }) => ({ description, quantity, unit_price }))));
			submitting = true;
			return async ({ update, result }) => {
				submitting = false;
				if (result.type !== 'failure' && result.type !== 'error') {
					addToast('Estimate saved');
				}
				await update();
			};
		}}
		class="space-y-6"
	>
		<div class="rounded-xl border p-4 md:p-6" style="background: var(--color-card); border-color: var(--color-border)">
			<h3 class="font-semibold mb-4" style="color: var(--color-foreground)">Details</h3>
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<div>
					<QuickAddClient clients={data.clients} bind:selectedId={selectedClientId} inputId="edit-client" />
				</div>
				<div>
					<label for="edit-number" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">Estimate Number *</label>
					<input id="edit-number" name="number" required value={data.estimate.number}
						class="w-full px-3 py-2 rounded-lg border text-sm"
						style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
					/>
				</div>
				<div>
					<label for="edit-issue-date" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">Issue Date</label>
					<DatePicker id="edit-issue-date" name="issue_date" bind:value={issueDateVal} />
				</div>
				<div>
					<label for="edit-expiry-date" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">Valid Until</label>
					<DatePicker id="edit-expiry-date" name="expiry_date" bind:value={expiryDateVal} />
				</div>
				<div>
					<label for="edit-status" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">Status</label>
					<select id="edit-status" name="status"
						class="w-full px-3 py-2 rounded-lg border text-sm"
						style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
					>
						{#each ['draft', 'sent', 'accepted', 'declined'] as s}
							<option value={s} selected={data.estimate.status === s}>{s.replace(/\b\w/g, c => c.toUpperCase())}</option>
						{/each}
					</select>
				</div>
				<div>
					<label for="edit-tax" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">Tax (%)</label>
					<input id="edit-tax" type="number" name="tax_percent" min="0" max="100" step="0.01" bind:value={taxPercent}
						class="w-full px-3 py-2 rounded-lg border text-sm"
						style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
					/>
				</div>
				<div class="sm:col-span-2">
					<label for="edit-notes" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">Notes</label>
					<RichTextarea id="edit-notes" name="notes" rows={3} bind:value={notes} />
				</div>
			</div>
		</div>

		<!-- Line items -->
		<div class="rounded-xl border overflow-hidden" style="background: var(--color-card); border-color: var(--color-border)">
			<div class="px-6 py-4 border-b flex items-center justify-between" style="border-color: var(--color-border)">
				<h3 class="font-semibold" style="color: var(--color-foreground)">Line Items</h3>
				<button type="button" onclick={addItem} class="flex items-center gap-1.5 text-sm font-medium" style="color: var(--color-primary)">
					<Plus size={15} /> Add Item
				</button>
			</div>
			<div class="hidden sm:grid sm:gap-2 px-4 py-2 border-b"
				style="border-color: var(--color-border); grid-template-columns: 1fr 6rem 8rem 7rem 2.5rem">
				<span class="text-xs font-medium" style="color: var(--color-muted-foreground)">Description</span>
				<span class="text-xs font-medium text-right" style="color: var(--color-muted-foreground)">Qty</span>
				<span class="text-xs font-medium text-right" style="color: var(--color-muted-foreground)">Unit Price</span>
				<span class="text-xs font-medium text-right" style="color: var(--color-muted-foreground)">Amount</span>
				<span></span>
			</div>

			<div class="divide-y divide-border">
				{#each items as item (item.id)}
					<div class="px-4 py-3 flex flex-col gap-2 sm:grid sm:gap-2 sm:items-start"
						style="grid-template-columns: 1fr 6rem 8rem 7rem 2.5rem">
						<div>
							<span class="block text-xs font-medium mb-1 sm:hidden" style="color: var(--color-muted-foreground)">Description</span>
							<RichTextarea bind:value={item.description} placeholder="Service description" rows={2} aria-label="Item description"
								class="w-full px-2 py-1.5 rounded border text-sm"
								style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
							/>
						</div>
						<div class="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 sm:contents">
							<div>
								<span class="block text-xs font-medium mb-1 sm:hidden" style="color: var(--color-muted-foreground)">Qty</span>
								<input type="number" min="0" step="0.01" bind:value={item.quantity} aria-label="Quantity"
									class="w-full px-2 py-1.5 rounded border text-sm text-right"
									style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
								/>
							</div>
							<div>
								<span class="block text-xs font-medium mb-1 sm:hidden" style="color: var(--color-muted-foreground)">Unit Price</span>
								<input type="number" min="0" step="0.01" bind:value={item.unit_price} aria-label="Unit price"
									class="w-full px-2 py-1.5 rounded border text-sm text-right"
									style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
								/>
							</div>
							<div class="flex flex-col">
								<span class="block text-xs font-medium mb-1 sm:hidden" style="color: var(--color-muted-foreground)">Amount</span>
								<span class="py-1.5 text-sm font-mono text-right sm:pt-2" style="color: var(--color-foreground)">{fmt(item.quantity * item.unit_price)}</span>
							</div>
							<div class="flex items-end sm:items-start sm:pt-1 justify-center">
								<button type="button" onclick={() => removeItem(item.id)} disabled={items.length === 1}
									aria-label="Remove item"
									class="p-1 rounded-lg text-red-600 hover:opacity-70 disabled:opacity-30 transition-opacity">
									<Trash2 size={14} aria-hidden="true" />
								</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
			<div class="px-6 py-4 border-t space-y-2" style="border-color: var(--color-border); background: var(--color-muted)">
				<div class="flex justify-between text-sm" style="color: var(--color-muted-foreground)"><span>Subtotal</span><span class="font-mono">{fmt(subtotal)}</span></div>
				{#if taxPercent > 0}
					<div class="flex justify-between text-sm" style="color: var(--color-muted-foreground)"><span>Tax ({taxPercent}%)</span><span class="font-mono">{fmt(tax)}</span></div>
				{/if}
				<div class="flex justify-between text-base font-bold pt-2 border-t" style="border-color: var(--color-border); color: var(--color-foreground)">
					<span>Total</span><span class="font-mono">{fmt(total)}</span>
				</div>
			</div>
		</div>

		<div class="flex gap-3 justify-end">
			<a href="/estimates/{data.estimate.id}" class="px-4 py-2 rounded-lg text-sm font-medium border"
				style="border-color: var(--color-border); color: var(--color-muted-foreground)">Cancel</a>
			<button type="submit" disabled={submitting} class="px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
				style="background: var(--color-primary); color: var(--color-primary-foreground)">
				{submitting ? 'Saving…' : 'Save Changes'}
			</button>
		</div>
	</form>
</div>
