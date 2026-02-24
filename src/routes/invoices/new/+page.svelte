<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { ArrowLeft, Plus, Trash2, Settings2 } from 'lucide-svelte';
	import DatePicker from '$lib/components/DatePicker.svelte';
	import RichTextarea from '$lib/components/RichTextarea.svelte';
	import QuickAddClient from '$lib/components/QuickAddClient.svelte';
	import FormAlert from '$lib/components/FormAlert.svelte';
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
	let notes = $state(untrack(() => data.defaultNotes ?? ''));
	let submitting = $state(false);
	let nextId = $state(2);
	let selectedClientId = $state(untrack(() => data.preselectedClient ?? ''));

	// Today and 30 days out
	const today = new Date().toISOString().split('T')[0];
	const defaultDue = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

	const TERM_LABELS: Record<string, string> = {
		upon_receipt: 'Upon Receipt',
		net_15: 'Net 15',
		net_30: 'Net 30',
		net_45: 'Net 45',
		net_60: 'Net 60',
		custom: 'Custom'
	};
	const TERMS_DAYS: Record<string, number> = {
		upon_receipt: 0, net_15: 15, net_30: 30, net_45: 45, net_60: 60
	};
	function addDays(dateStr: string, days: number): string {
		const d = new Date(dateStr + 'T00:00:00');
		d.setDate(d.getDate() + days);
		return d.toISOString().split('T')[0];
	}

	let showAdvanced = $state(false);
	let invoiceNumber = $state(untrack(() => data.suggestedInvoiceNumber ?? `INV-${today.replace(/-/g, '')}-001`));
	let issueDateVal = $state(today);
	let paymentTerms = $state('net_30');
	let customDueDate = $state(defaultDue);
	const computedDueDate = $derived(
		paymentTerms === 'custom' ? customDueDate : addDays(issueDateVal, TERMS_DAYS[paymentTerms] ?? 30)
	);

	function addItem() {
		items = [...items, { id: nextId++, description: '', quantity: 1, unit_price: 0 }];
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
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
	}
</script>

<svelte:head>
	<title>New Invoice — Yield</title>
</svelte:head>

<div class="max-w-5xl mx-auto">
	<a href="/invoices" class="inline-flex items-center gap-1.5 text-sm mb-6" style="color: var(--color-muted-foreground)">
		<ArrowLeft size={15} /> Back to Invoices
	</a>

	<h2 class="text-2xl font-bold mb-6" style="color: var(--color-foreground)">New Invoice</h2>

	<FormAlert message={form?.error} />

	<form
		method="POST"
		use:enhance={({ formData }) => {
			formData.set('items', JSON.stringify(items.map(({ description, quantity, unit_price }) => ({ description, quantity, unit_price }))));
			submitting = true;
			return async ({ update }) => { submitting = false; await update(); };
		}}
		class="space-y-6"
	>
		<!-- Invoice metadata -->
		<div class="rounded-xl border p-4 md:p-6" style="background: var(--color-card); border-color: var(--color-border)">
			<div class="flex items-center justify-between mb-4">
				<h3 class="font-semibold" style="color: var(--color-foreground)">Details</h3>
				<button type="button" onclick={() => showAdvanced = !showAdvanced}
					aria-label={showAdvanced ? 'Hide advanced options' : 'Show advanced options'}
					aria-pressed={showAdvanced}
					aria-expanded={showAdvanced}
					class="p-1.5 rounded-lg transition-colors hover:bg-black/5"
					style={showAdvanced ? 'color: var(--color-primary)' : 'color: var(--color-muted-foreground)'}
				>
					<Settings2 size={16} aria-hidden="true" />
				</button>
			</div>

			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<div>
					<QuickAddClient
						clients={data.clients}
						bind:selectedId={selectedClientId}
						inputId="new-client"
					/>
				</div>
				<div>
					<label for="new-issue-date" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">Issue Date</label>
					<DatePicker id="new-issue-date" name="issue_date" bind:value={issueDateVal} />
				</div>

				{#if showAdvanced}
					<div>
						<label for="inp-number" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">Invoice Number</label>
						<input id="inp-number" name="number" required bind:value={invoiceNumber}
							class="w-full px-3 py-2 rounded-lg border text-sm"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						/>
					</div>
					<div>
						<label for="inp-status" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">Status</label>
						<select id="inp-status" name="status"
							class="w-full px-3 py-2 rounded-lg border text-sm"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						>
							<option value="draft">Draft</option>
							<option value="sent">Sent</option>
							<option value="paid">Paid</option>
							<option value="overdue">Overdue</option>
						</select>
					</div>
					<div>
						<label for="inp-terms" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">Payment Terms</label>
						<select id="inp-terms" name="payment_terms" bind:value={paymentTerms}
							class="w-full px-3 py-2 rounded-lg border text-sm"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						>
							{#each Object.entries(TERM_LABELS) as [v, label]}
								<option value={v}>{label}</option>
							{/each}
						</select>
					</div>
					{#if paymentTerms === 'custom'}
						<div>
							<label for="inp-due" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">Due Date</label>
							<DatePicker id="inp-due" name="due_date" bind:value={customDueDate} />
						</div>
					{:else}
						<input type="hidden" name="due_date" value={computedDueDate} />
					{/if}
					<div>
						<label for="inp-tax" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">Tax (%)</label>
						<input id="inp-tax" type="number" name="tax_percent" min="0" max="100" step="0.01" bind:value={taxPercent}
							class="w-full px-3 py-2 rounded-lg border text-sm"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						/>
					</div>
				{:else}
					<input type="hidden" name="number" value={invoiceNumber} />
					<input type="hidden" name="status" value="draft" />
					<input type="hidden" name="payment_terms" value={paymentTerms} />
					<input type="hidden" name="due_date" value={computedDueDate} />
					<input type="hidden" name="tax_percent" value={taxPercent} />
				{/if}
			</div>
		</div>

		<!-- Line items -->
		<div class="rounded-xl border overflow-hidden" style="background: var(--color-card); border-color: var(--color-border)">
			<div class="px-6 py-4 border-b flex items-center justify-between" style="border-color: var(--color-border)">
				<h3 class="font-semibold" style="color: var(--color-foreground)">Line Items</h3>
				<button type="button" onclick={addItem}
					class="flex items-center gap-1.5 text-sm font-medium"
					style="color: var(--color-primary)"
				>
					<Plus size={15} /> Add Item
				</button>
			</div>

			<!-- Desktop header (hidden on mobile) -->
		<div class="hidden sm:grid px-4 py-2 border-b"
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
					<!-- Description — full width on mobile, first col on desktop -->
					<div>
						<span class="block text-xs font-medium mb-1 sm:hidden" style="color: var(--color-muted-foreground)">Description</span>
					<RichTextarea bind:value={item.description} placeholder="Service description" rows={2}
						aria-label="Item description"
						class="w-full px-2 py-1.5 rounded border text-sm resize-y"
						style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
					/>
					</div>
					<!-- Qty / Unit Price / Amount / Delete — stacked row on mobile -->
					<div class="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 sm:contents">
						<div>
							<span class="block text-xs font-medium mb-1 sm:hidden" style="color: var(--color-muted-foreground)">Qty</span>
							<input type="number" min="0" step="0.01" bind:value={item.quantity}
								aria-label="Quantity"
								class="w-full px-2 py-1.5 rounded border text-sm text-right"
								style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
							/>
						</div>
						<div>
							<span class="block text-xs font-medium mb-1 sm:hidden" style="color: var(--color-muted-foreground)">Unit Price</span>
							<input type="number" min="0" step="0.01" bind:value={item.unit_price}
								aria-label="Unit price"
								class="w-full px-2 py-1.5 rounded border text-sm text-right"
								style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
							/>
						</div>
						<div class="flex flex-col">
							<span class="block text-xs font-medium mb-1 sm:hidden" style="color: var(--color-muted-foreground)">Amount</span>
							<span class="py-1.5 text-sm font-mono text-right sm:pt-2" style="color: var(--color-foreground)">
								{fmt(item.quantity * item.unit_price)}
							</span>
						</div>
						<div class="flex items-end sm:items-start sm:pt-1 justify-center">
							<button type="button" onclick={() => removeItem(item.id)} disabled={items.length === 1}
								aria-label="Remove item"
								class="p-1 rounded-lg text-red-600 hover:opacity-70 disabled:opacity-30 transition-opacity"
							>
								<Trash2 size={14} aria-hidden="true" />
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>

			<!-- Totals -->
			<div class="px-6 py-4 border-t space-y-2" style="border-color: var(--color-border); background: var(--color-muted)">
				<div class="flex justify-between text-sm" style="color: var(--color-muted-foreground)">
					<span>Subtotal</span>
					<span class="font-mono">{fmt(subtotal())}</span>
				</div>
				{#if taxPercent > 0}
					<div class="flex justify-between text-sm" style="color: var(--color-muted-foreground)">
						<span>Tax ({taxPercent}%)</span>
						<span class="font-mono">{fmt(tax())}</span>
					</div>
				{/if}
				<div class="flex justify-between text-base font-bold pt-2 border-t" style="border-color: var(--color-border); color: var(--color-foreground)">
					<span>Total</span>
					<span class="font-mono">{fmt(total())}</span>
				</div>
			</div>
		</div>

		<!-- Notes -->
		<div class="rounded-xl border p-4 md:p-6" style="background: var(--color-card); border-color: var(--color-border)">
			<label for="new-notes" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">Notes</label>
			<RichTextarea id="new-notes" name="notes" rows={3} placeholder="Payment terms, thank you message…"
				bind:value={notes}
				class="w-full px-3 py-2 rounded-lg border text-sm resize-none"
				style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
			/>
		</div>

		<!-- Submit -->
		<div class="flex gap-3 justify-end">
			<a href="/invoices"
				class="px-4 py-2 rounded-lg text-sm font-medium border"
				style="border-color: var(--color-border); color: var(--color-muted-foreground)"
			>Cancel</a>
			<button type="submit" disabled={submitting}
				class="px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-60 transition-opacity hover:opacity-90"
				style="background: var(--color-primary); color: var(--color-primary-foreground)"
			>
				{submitting ? 'Creating...' : 'Create Invoice'}
			</button>
		</div>
	</form>
</div>
