<script lang="ts">
	import { enhance } from '$app/forms';
	import { Landmark, Trash2, PlusCircle } from 'lucide-svelte';
	import { addToast } from '$lib/toasts.svelte.js';
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

	// Default date for the form: today
	const todayIso = new Date().toISOString().slice(0, 10);

	let showForm = $state(false);

	// Reset form state after success
	$effect(() => {
		if (form?.createSuccess) {
			showForm = false;
			addToast('Payment recorded');
		}
	});
</script>

<svelte:head>
	<title>Tax Payments — Yield</title>
</svelte:head>

<div class="max-w-5xl mx-auto">
	<!-- Header -->
	<div class="mb-6 flex items-start justify-between gap-4">
		<div>
			<h2 class="text-2xl font-bold" style="color: var(--color-foreground)">Tax Payments</h2>
			<p class="mt-1 text-sm" style="color: var(--color-muted-foreground)">
				Self-reported income tax and GST/HST remittances sent to the government
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
			{#if form?.createError}
				<p role="alert" class="mb-3 text-sm rounded-lg px-3 py-2 bg-red-50 text-red-700">{form.createError}</p>
			{/if}
			<form method="POST" action="?/create" use:enhance class="flex flex-col gap-4">
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
								<form method="POST" action="?/delete" use:enhance={() => async ({ update, result }) => { await update(); if (result.type !== 'failure') addToast('Payment deleted'); }}>
									<input type="hidden" name="id" value={payment.id} />
									<button
										type="submit"
										class="p-1.5 rounded-md transition-colors hover:bg-red-50 hover:text-red-600"
										style="color: var(--color-muted-foreground)"
										aria-label="Delete payment"
										onclick={(e) => {
											if (!confirm('Delete this payment record?')) e.preventDefault();
										}}
									>
										<Trash2 size={14} aria-hidden="true" />
									</button>
								</form>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			</div>
		</div>
	{/if}
</div>
