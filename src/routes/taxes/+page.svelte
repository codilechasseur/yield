<script lang="ts">
	import { enhance } from '$app/forms';
	import { Landmark, Trash2, PlusCircle, Receipt, Calculator } from 'lucide-svelte';
	import { addToast } from '$lib/toasts.svelte.js';
	import FormAlert from '$lib/components/FormAlert.svelte';
	import type { PageData, ActionData } from './$types.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const TYPE_LABELS: Record<string, string> = {
		income_tax: 'Income Tax',
		gst: 'GST / HST'
	};

	function fmt(amount: number): string {
		return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);
	}

	function fmtDate(d: string): string {
		return new Date(d).toLocaleDateString('en-CA', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			timeZone: 'UTC'
		});
	}

	// Totals by type for the selected year
	const totalIncomeTax = $derived(
		data.payments.filter((p) => p.type === 'income_tax').reduce((s, p) => s + p.amount, 0)
	);
	const totalGst = $derived(
		data.payments.filter((p) => p.type === 'gst').reduce((s, p) => s + p.amount, 0)
	);
	const totalAll = $derived(totalIncomeTax + totalGst);

	const gstBalance = $derived(Math.max(0, data.taxPosition.gstLiability - totalGst));
	const itBalance = $derived(Math.max(0, data.taxPosition.incomeTaxLiability - totalIncomeTax));

	// Default date for the form: today
	const todayIso = new Date().toISOString().slice(0, 10);

	let showForm = $state(false);
	let deletePaymentId = $state<string | null>(null);

</script>

<svelte:head>
	<title>Taxes — Yield</title>
</svelte:head>

<div class="max-w-5xl mx-auto">
	<!-- Header -->
	<div class="mb-6 flex items-start justify-between gap-4">
		<div>
			<h2 class="text-2xl font-bold" style="color: var(--color-foreground)">Taxes</h2>
			<p class="mt-1 text-sm" style="color: var(--color-muted-foreground)">
				Tax position from your invoices and payments remitted to the government
			</p>
		</div>
		<button
			onclick={() => (showForm = !showForm)}
			class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 shrink-0"
			style="background-color: var(--color-primary); color: var(--color-primary-foreground)"
		>
			<PlusCircle size={15} />
			Record Payment
		</button>
	</div>

	<!-- Year selector -->
	<form method="GET" class="mb-6 flex items-center gap-2">
		<label class="text-sm font-medium" style="color: var(--color-foreground)" for="year-select">
			Year
		</label>
		<select
			id="year-select"
			name="year"
			onchange={() => (document.querySelector('form[method=GET]') as HTMLFormElement)?.requestSubmit()}
			class="rounded-lg border px-3 py-1.5 text-sm"
			style="background-color: var(--color-card); border-color: var(--color-border); color: var(--color-foreground)"
		>
			{#each data.availableYears as y}
				<option value={y} selected={y === data.year}>{y}</option>
			{/each}
		</select>
	</form>

	<!-- Add payment form -->
	{#if showForm}
		<div
			class="mb-6 rounded-xl border p-5"
			style="background-color: var(--color-card); border-color: var(--color-border)"
		>
			<h3 class="text-base font-semibold mb-4" style="color: var(--color-foreground)">
				Record a Payment
			</h3>
			<FormAlert message={form?.createError} class="mb-3" />
			<form method="POST" action="?/create" use:enhance={() => async ({ update, result }) => { await update(); if (result.type !== 'failure') { showForm = false; addToast('Payment recorded'); } }} class="flex flex-col gap-4">
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div>
						<label
							for="type"
							class="block text-sm font-medium mb-1"
							style="color: var(--color-foreground)"
						>
							Type
						</label>
						<select
							id="type"
							name="type"
							required
							class="w-full rounded-lg border px-3 py-2 text-sm"
							style="background-color: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						>
							<option value="income_tax">Income Tax</option>
							<option value="gst">GST / HST</option>
						</select>
					</div>
					<div>
						<label
							for="amount"
							class="block text-sm font-medium mb-1"
							style="color: var(--color-foreground)"
						>
							Amount
						</label>
						<input
							id="amount"
							name="amount"
							type="number"
							min="0.01"
							step="0.01"
							required
							placeholder="0.00"
							class="w-full rounded-lg border px-3 py-2 text-sm"
							style="background-color: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						/>
					</div>
				</div>
				<div>
					<label
						for="payment_date"
						class="block text-sm font-medium mb-1"
						style="color: var(--color-foreground)"
					>
						Payment Date
					</label>
					<input
						id="payment_date"
						name="payment_date"
						type="date"
						required
						value={todayIso}
						class="rounded-lg border px-3 py-2 text-sm"
						style="background-color: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
					/>
				</div>
				<div>
					<label
						for="notes"
						class="block text-sm font-medium mb-1"
						style="color: var(--color-foreground)"
					>
						Notes <span style="color: var(--color-muted-foreground)">(optional)</span>
					</label>
					<input
						id="notes"
						name="notes"
						type="text"
						placeholder="e.g. Q1 instalment, tax year 2025…"
						class="w-full rounded-lg border px-3 py-2 text-sm"
						style="background-color: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
					/>
				</div>
				<div class="flex gap-3 justify-end">
					<button
						type="button"
						onclick={() => (showForm = false)}
						class="px-4 py-2 rounded-lg text-sm font-medium border"
						style="border-color: var(--color-border); color: var(--color-muted-foreground)"
					>
						Cancel
					</button>
					<button
						type="submit"
						class="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
						style="background-color: var(--color-primary); color: var(--color-primary-foreground)"
					>
						Save Payment
					</button>
				</div>
			</form>
		</div>
	{/if}

	<!-- Tax Position -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
		<!-- GST/HST Position -->
		<div
			class="rounded-xl border overflow-hidden"
			style="background-color: var(--color-card); border-color: var(--color-border)"
		>
			<div class="px-5 py-3 border-b flex items-center gap-2" style="border-color: var(--color-border)">
				<Receipt size={15} style="color: var(--color-primary)" aria-hidden="true" />
				<h3 class="font-semibold text-sm" style="color: var(--color-foreground)">GST/HST — {data.year}</h3>
			</div>
			<div class="divide-y" style="border-color: var(--color-border)">
				<div class="px-5 py-3 flex items-center justify-between">
					<div>
						<p class="text-sm font-medium" style="color: var(--color-foreground)">Estimated liability</p>
						<p class="text-xs mt-0.5" style="color: var(--color-muted-foreground)">GST/HST on all invoiced revenue</p>
					</div>
					<p class="text-base font-semibold tabular-nums" style="color: var(--color-foreground)">{fmt(data.taxPosition.gstLiability)}</p>
				</div>
				<div class="px-5 py-3 flex items-center justify-between">
					<div>
						<p class="text-sm font-medium" style="color: var(--color-foreground)">Remitted to CRA</p>
						<p class="text-xs mt-0.5" style="color: var(--color-muted-foreground)">From recorded payments below</p>
					</div>
					<p class="text-base font-semibold tabular-nums" style="color: var(--color-foreground)">{fmt(totalGst)}</p>
				</div>
				<div class="px-5 py-3 flex items-center justify-between" style="background-color: var(--color-accent)">
					<div>
						<p class="text-sm font-semibold" style="color: var(--color-foreground)">Balance remaining</p>
						<p class="text-xs mt-0.5" style="color: var(--color-muted-foreground)">Estimated still owed to CRA</p>
					</div>
					<p class="text-base font-bold tabular-nums" style="color: {gstBalance > 0 ? 'var(--color-warning, #b45309)' : 'var(--color-foreground)'}">
						{fmt(gstBalance)}
					</p>
				</div>
			</div>
		</div>

		<!-- Income Tax Position -->
		<div
			class="rounded-xl border overflow-hidden"
			style="background-color: var(--color-card); border-color: var(--color-border)"
		>
			<div class="px-5 py-3 border-b flex items-center gap-2" style="border-color: var(--color-border)">
				<Calculator size={15} style="color: var(--color-primary)" aria-hidden="true" />
				<h3 class="font-semibold text-sm" style="color: var(--color-foreground)">Est. Income Tax — {data.year}</h3>
			</div>
			{#if data.incomeTaxRate <= 0}
				<div class="px-5 py-8 text-center">
					<p class="text-sm" style="color: var(--color-muted-foreground)">Configure an income tax rate in <a href="/settings" class="underline" style="color: var(--color-primary)">Settings</a> to see estimates.</p>
				</div>
			{:else}
				<div class="divide-y" style="border-color: var(--color-border)">
					<div class="px-5 py-3 flex items-center justify-between">
						<div>
							<p class="text-sm font-medium" style="color: var(--color-foreground)">Estimated liability</p>
							<p class="text-xs mt-0.5" style="color: var(--color-muted-foreground)">@ {data.incomeTaxRate}% on all invoiced revenue</p>
						</div>
						<p class="text-base font-semibold tabular-nums" style="color: var(--color-foreground)">{fmt(data.taxPosition.incomeTaxLiability)}</p>
					</div>
					<div class="px-5 py-3 flex items-center justify-between">
						<div>
							<p class="text-sm font-medium" style="color: var(--color-foreground)">Paid to CRA</p>
							<p class="text-xs mt-0.5" style="color: var(--color-muted-foreground)">From recorded payments below</p>
						</div>
						<p class="text-base font-semibold tabular-nums" style="color: var(--color-foreground)">{fmt(totalIncomeTax)}</p>
					</div>
					<div class="px-5 py-3 flex items-center justify-between" style="background-color: var(--color-accent)">
						<div>
							<p class="text-sm font-semibold" style="color: var(--color-foreground)">Balance remaining</p>
							<p class="text-xs mt-0.5" style="color: var(--color-muted-foreground)">Estimated still owed to CRA</p>
						</div>
						<p class="text-base font-bold tabular-nums" style="color: {itBalance > 0 ? 'var(--color-warning, #b45309)' : 'var(--color-foreground)'}">
							{fmt(itBalance)}
						</p>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Year summary cards -->
	<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
		<div
			class="rounded-xl border p-4"
			style="background-color: var(--color-card); border-color: var(--color-border)"
		>
			<p class="text-xs font-medium uppercase tracking-wide mb-1" style="color: var(--color-muted-foreground)">
				Income Tax {data.year}
			</p>
			<p class="text-lg sm:text-xl font-bold" style="color: var(--color-foreground)">{fmt(totalIncomeTax)}</p>
		</div>
		<div
			class="rounded-xl border p-4"
			style="background-color: var(--color-card); border-color: var(--color-border)"
		>
			<p class="text-xs font-medium uppercase tracking-wide mb-1" style="color: var(--color-muted-foreground)">
				GST / HST {data.year}
			</p>
			<p class="text-lg sm:text-xl font-bold" style="color: var(--color-foreground)">{fmt(totalGst)}</p>
		</div>
		<div
			class="rounded-xl border p-4"
			style="background-color: var(--color-card); border-color: var(--color-border)"
		>
			<p class="text-xs font-medium uppercase tracking-wide mb-1" style="color: var(--color-muted-foreground)">
				Total Paid {data.year}
			</p>
			<p class="text-lg sm:text-xl font-bold" style="color: var(--color-primary)">{fmt(totalAll)}</p>
		</div>
	</div>

	<!-- Payments list -->
	{#if data.payments.length === 0}
		<div
			class="rounded-xl border p-12 text-center"
			style="background-color: var(--color-card); border-color: var(--color-border)"
		>
			<Landmark size={32} class="mx-auto mb-3" style="color: var(--color-muted-foreground)" />
			<p class="text-sm font-medium" style="color: var(--color-foreground)">No payments recorded for {data.year}</p>
			<p class="text-xs mt-1" style="color: var(--color-muted-foreground)">Use "Record Payment" to log a remittance.</p>
		</div>
	{:else}
		<div
			class="rounded-xl border overflow-hidden"
			style="border-color: var(--color-border)"
		>
			<div class="overflow-x-auto">
			<table class="w-full text-sm min-w-120">
				<thead>
					<tr style="background-color: var(--color-accent)">
						<th
							class="text-left px-4 py-3 font-medium"
							style="color: var(--color-muted-foreground)"
						>Date</th>
						<th
							class="text-left px-4 py-3 font-medium"
							style="color: var(--color-muted-foreground)"
						>Type</th>
						<th
							class="text-right px-4 py-3 font-medium"
							style="color: var(--color-muted-foreground)"
						>Amount</th>
						<th
							class="text-left px-4 py-3 font-medium"
							style="color: var(--color-muted-foreground)"
						>Notes</th>
						<th scope="col" class="px-4 py-3"></th>
					</tr>
				</thead>
				<tbody>
					{#each data.payments as payment, i}
						<tr
							class="border-t"
							style="border-color: var(--color-border); background-color: {i % 2 === 1 ? 'var(--color-accent)' : 'var(--color-card)'}"
						>
							<td class="px-4 py-3 font-medium" style="color: var(--color-foreground)">
								{fmtDate(payment.payment_date)}
							</td>
							<td class="px-4 py-3">
								<span
									class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
									style={payment.type === 'income_tax'
										? 'background-color: #eff6ff; color: #1d4ed8'
										: 'background-color: #f0fdf4; color: #15803d'}
								>
									{TYPE_LABELS[payment.type] ?? payment.type}
								</span>
							</td>
							<td class="px-4 py-3 text-right font-mono font-medium" style="color: var(--color-foreground)">
								{fmt(payment.amount)}
							</td>
							<td class="px-4 py-3 max-w-xs truncate" style="color: var(--color-muted-foreground)">
								{payment.notes || '—'}
							</td>
							<td class="px-4 py-3 text-right">
									<button
										type="button"
										class="p-1.5 rounded-md transition-colors hover:bg-red-50 hover:text-red-600"
										style="color: var(--color-muted-foreground)"
										aria-label="Delete payment"
										onclick={() => { deletePaymentId = payment.id; }}
									>
										<Trash2 size={14} aria-hidden="true" />
									</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			</div>
		</div>
	{/if}
</div>

<!-- Delete payment confirmation modal -->
{#if deletePaymentId}
	<div class="fixed inset-0 z-50 flex items-center justify-center" style="background: rgba(0,0,0,0.4)">
		<div class="rounded-xl border shadow-xl p-5 max-w-sm w-full mx-4" style="background: var(--color-card); border-color: var(--color-border)">
			<p class="font-semibold mb-1" style="color: var(--color-foreground)">Delete this payment record?</p>
			<p class="text-sm mb-4" style="color: var(--color-muted-foreground)">This action cannot be undone.</p>
			<div class="flex gap-2 justify-end">
				<button onclick={() => (deletePaymentId = null)} class="px-3 py-1.5 rounded-lg border text-sm font-medium hover:bg-muted transition-colors" style="border-color: var(--color-border); color: var(--color-muted-foreground)">Cancel</button>
				<form method="POST" action="?/delete" use:enhance={() => async ({ update, result }) => { deletePaymentId = null; await update(); if (result.type !== 'failure') addToast('Payment deleted'); }}>
					<input type="hidden" name="id" value={deletePaymentId} />
					<button type="submit" class="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors">Delete</button>
				</form>
			</div>
		</div>
	</div>
{/if}
