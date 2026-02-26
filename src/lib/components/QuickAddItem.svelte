<script lang="ts">
	import { X, Zap } from 'lucide-svelte';
	import { addToast } from '$lib/toasts.svelte.js';
	import type { Invoice, Client } from '$lib/types.js';

	interface Props {
		/** Controlled open state set by the parent. */
		open: boolean;
		/** Called when the dialog should close (parent must set open=false). */
		onclose?: () => void;
	}

	let { open, onclose }: Props = $props();

	let dialogEl = $state<HTMLDialogElement | null>(null);

	// Draft invoices fetched lazily when the dialog opens.
	let draftInvoices = $state<(Invoice & { expand: { client?: Client } })[]>([]);
	let clients = $state<Client[]>([]);
	let globalDefaultRate = $state(0);
	let loading = $state(false);
	let submitting = $state(false);
	let errorMsg = $state('');

	// Form fields
	let invoiceChoice = $state(''); // invoice ID or '__new__'
	let clientIdForNew = $state('');
	let description = $state('');
	let quantity = $state(1);
	let unitPrice = $state(0);
	/** True while unitPrice reflects an auto-applied default (user hasn't manually changed it). */
	let priceIsAutoSet = $state(true);

	const isNew = $derived(invoiceChoice === '__new__');

	/** The effective default rate for the currently-selected client/invoice. */
	const effectiveRate = $derived.by(() => {
		if (isNew) {
			const client = clients.find((c) => c.id === clientIdForNew);
			return client?.default_hourly_rate || globalDefaultRate;
		} else {
			const inv = draftInvoices.find((i) => i.id === invoiceChoice);
			return inv?.expand?.client?.default_hourly_rate || globalDefaultRate;
		}
	});

	// Auto-apply effectiveRate to unitPrice whenever the selection changes,
	// but only while the user hasn't manually overridden it.
	// Switching to a different invoice/client resets the auto-flag so the new default applies.
	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		invoiceChoice; clientIdForNew; // track selection changes
		priceIsAutoSet = true;
	});

	$effect(() => {
		const rate = effectiveRate;
		if (priceIsAutoSet) unitPrice = rate;
	});

	function reset() {
		invoiceChoice = '';
		clientIdForNew = '';
		description = '';
		quantity = 1;
		unitPrice = 0;
		priceIsAutoSet = true;
		errorMsg = '';
		draftInvoices = [];
		clients = [];
		globalDefaultRate = 0;
	}

	// Synchronise native dialog open/close with the `open` prop.
	$effect(() => {
		if (!dialogEl) return;
		if (open) {
			if (!dialogEl.open) {
				reset();
				dialogEl.showModal();
				loadData();
			}
		} else {
			if (dialogEl.open) dialogEl.close();
		}
	});

	async function loadData() {
		loading = true;
		errorMsg = '';
		try {
			const [draftsRes, clientsRes] = await Promise.all([
				fetch('/api/invoices/draft'),
				fetch('/api/clients')
			]);
			const [draftsJson, clientsJson] = await Promise.all([
				draftsRes.json(),
				clientsRes.json()
			]);
			draftInvoices = draftsJson.invoices ?? [];
			clients = clientsJson.clients ?? [];
			globalDefaultRate = draftsJson.globalDefaultRate ?? 0;
			// Pre-select the first draft invoice, or switch to "new" mode if there are none.
			invoiceChoice = draftInvoices.length > 0 ? draftInvoices[0].id : '__new__';
		} catch {
			errorMsg = 'Failed to load invoices — please try again';
		} finally {
			loading = false;
		}
	}

	function closeDialog() {
		onclose?.();
	}

	// Fired by the native <dialog> close event (Escape key, or programmatic close).
	function onNativeClose() {
		onclose?.();
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		errorMsg = '';

		if (!invoiceChoice) {
			errorMsg = 'Please select an invoice';
			return;
		}
		if (isNew && !clientIdForNew) {
			errorMsg = 'Please select a client for the new invoice';
			return;
		}
		if (!description.trim()) {
			errorMsg = 'Description is required';
			return;
		}

		submitting = true;
		try {
			const body = isNew
				? { client_id: clientIdForNew, description, quantity, unit_price: unitPrice }
				: { invoice_id: invoiceChoice, description, quantity, unit_price: unitPrice };

			const res = await fetch('/api/quick-add-item', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			const json = await res.json();

			if (!res.ok) {
				errorMsg = json.error || 'Failed to add item';
				return;
			}

			const label = isNew
				? `new invoice for ${clients.find((c) => c.id === clientIdForNew)?.name ?? 'client'}`
				: (() => {
						const inv = draftInvoices.find((i) => i.id === invoiceChoice);
						if (!inv) return 'invoice';
						const clientName = inv.expand?.client?.name ?? '';
						return clientName ? `${clientName} — ${inv.number}` : inv.number;
					})();

			addToast(`Item added to ${label}`);
			closeDialog();
		} catch {
			errorMsg = 'Network error — please try again';
		} finally {
			submitting = false;
		}
	}
</script>

<dialog
	bind:this={dialogEl}
	onclose={onNativeClose}
	aria-labelledby="qai-title"
	class="m-auto rounded-xl border shadow-xl w-full max-w-md p-0 backdrop:bg-black/40"
	style="background: var(--color-card); border-color: var(--color-border)"
>
	<!-- Header -->
	<div class="flex items-center justify-between px-5 pt-5 pb-3">
		<div class="flex items-center gap-2">
			<Zap size={18} aria-hidden="true" style="color: var(--color-primary)" />
			<h2 id="qai-title" class="text-base font-semibold" style="color: var(--color-foreground)">
				Quick Add Line Item
			</h2>
		</div>
		<button
			type="button"
			onclick={closeDialog}
			aria-label="Close"
			class="p-1 rounded-lg hover:opacity-70 transition-opacity"
			style="color: var(--color-muted-foreground)"
		>
			<X size={16} aria-hidden="true" />
		</button>
	</div>

	<!-- Body -->
	<form onsubmit={handleSubmit} class="px-5 pb-5 space-y-4">
		{#if loading}
			<p class="text-sm py-4 text-center" style="color: var(--color-muted-foreground)">
				Loading…
			</p>
		{:else}
			<!-- Invoice selector -->
			<div>
				<label for="qai-invoice" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">
					Invoice <span aria-hidden="true">*</span>
				</label>
				<select
					id="qai-invoice"
					bind:value={invoiceChoice}
					required
					class="w-full px-3 py-2 rounded-lg border text-sm"
					style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
				>
					<option value="" disabled>Select a draft invoice…</option>
					{#each draftInvoices as inv (inv.id)}
						{@const clientName = inv.expand?.client?.name ?? 'Unknown client'}
						<option value={inv.id}>{clientName} — {inv.number}</option>
					{/each}
					<option value="__new__">＋ New invoice for a client…</option>
				</select>
			</div>

			<!-- Client selector — shown when creating a new invoice -->
			{#if isNew}
				<div>
					<label for="qai-client" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">
						Client <span aria-hidden="true">*</span>
					</label>
					<select
						id="qai-client"
						bind:value={clientIdForNew}
						required
						class="w-full px-3 py-2 rounded-lg border text-sm"
						style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
					>
						<option value="" disabled>Select a client…</option>
						{#each clients as c (c.id)}
							<option value={c.id}>{c.name}</option>
						{/each}
					</select>
					{#if clients.length === 0}
						<p class="mt-1 text-xs" style="color: var(--color-muted-foreground)">
							No clients found. <a href="/clients" onclick={closeDialog} class="underline" style="color: var(--color-primary)">Add a client first.</a>
						</p>
					{/if}
				</div>
			{/if}

			<!-- Description -->
			<div>
				<label for="qai-description" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">
					Description <span aria-hidden="true">*</span>
				</label>
				<textarea
					id="qai-description"
					bind:value={description}
					required
					rows="3"
					placeholder="What did you work on?"
					class="w-full px-3 py-2 rounded-lg border text-sm resize-none"
					style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
				></textarea>
			</div>

			<!-- Quantity + Unit Price -->
			<div class="grid grid-cols-2 gap-3">
				<div>
					<label for="qai-quantity" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">
						Quantity
					</label>
					<input
						id="qai-quantity"
						type="number"
						bind:value={quantity}
						min="0"
						step="0.01"
						class="w-full px-3 py-2 rounded-lg border text-sm"
						style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
					/>
				</div>
				<div>
					<label for="qai-price" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">
						Unit Price
					</label>
					<input
						id="qai-price"
						type="number"
						bind:value={unitPrice}
						oninput={() => priceIsAutoSet = false}
						min="0"
						step="0.01"
						class="w-full px-3 py-2 rounded-lg border text-sm"
						style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
					/>
				</div>
			</div>

			<!-- Error message -->
			{#if errorMsg}
				<p role="alert" class="text-sm rounded-lg px-3 py-2" style="background: var(--color-destructive-muted, #fef2f2); color: var(--color-destructive, #dc2626)">
					{errorMsg}
				</p>
			{/if}

			<!-- Actions -->
			<div class="flex justify-end gap-2 pt-1">
				<button
					type="button"
					onclick={closeDialog}
					class="px-4 py-2 rounded-lg border text-sm font-medium transition-opacity hover:opacity-80"
					style="border-color: var(--color-border); color: var(--color-muted-foreground)"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={submitting}
					class="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
					style="background: var(--color-primary); color: var(--color-primary-foreground)"
				>
					{submitting ? 'Adding…' : 'Add to Invoice'}
				</button>
			</div>
		{/if}
	</form>
</dialog>
