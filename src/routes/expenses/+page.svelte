<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { Wallet, Trash2, Plus, Copy, Receipt } from 'lucide-svelte';
	import { addToast } from '$lib/toasts.svelte.js';
	import FormAlert from '$lib/components/FormAlert.svelte';
	import type { PageData, ActionData } from './$types.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

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

	const totalExpenses = $derived(data.expenses.reduce((s, e) => s + e.amount, 0));
	const totalGstPaid = $derived(data.expenses.reduce((s, e) => s + (e.gst_paid ?? 0), 0));

	const todayIso = new Date().toISOString().slice(0, 10);

	let showForm = $state(false);
	let deleteExpenseId = $state<string | null>(null);
</script>

<svelte:head>
	<title>Expenses — {page.data.appName}</title>
</svelte:head>

<div class="max-w-5xl mx-auto">
	<!-- Header -->
	<div class="mb-6 flex items-center justify-between gap-4">
		<div>
			<h2 class="text-2xl font-bold" style="color: var(--color-foreground)">Expenses</h2>
			<p class="mt-1 text-sm" style="color: var(--color-muted-foreground)">
				Business expenses reduce your taxable income; GST paid on them counts as input tax credits
			</p>
		</div>
		<button
			onclick={() => (showForm = !showForm)}
			class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
			style="background-color: var(--color-primary); color: var(--color-primary-foreground)"
		>
			<Plus size={16} />
			Add Expense
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

	<FormAlert message={data.loadError} class="mb-6" />

	<!-- Add expense form -->
	{#if showForm}
		<div
			class="mb-6 rounded-xl border p-5"
			style="background-color: var(--color-card); border-color: var(--color-border)"
		>
			<h3 class="text-base font-semibold mb-4" style="color: var(--color-foreground)">
				Add an Expense
			</h3>
			<FormAlert message={form?.createError} class="mb-3" />
			<form method="POST" action="?/create" use:enhance={() => async ({ update, result }) => { await update(); if (result.type !== 'failure') { showForm = false; addToast('Expense added'); } }} class="flex flex-col gap-4">
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div>
						<label for="description" class="block text-sm font-medium mb-1" style="color: var(--color-foreground)">
							Description
						</label>
						<input
							id="description"
							name="description"
							type="text"
							required
							placeholder="e.g. Web hosting, software subscription…"
							class="w-full rounded-lg border px-3 py-2 text-sm"
							style="background-color: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						/>
					</div>
					<div>
						<label for="expense_date" class="block text-sm font-medium mb-1" style="color: var(--color-foreground)">
							Date
						</label>
						<input
							id="expense_date"
							name="expense_date"
							type="date"
							required
							value={todayIso}
							class="w-full rounded-lg border px-3 py-2 text-sm"
							style="background-color: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						/>
					</div>
				</div>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div>
						<label for="amount" class="block text-sm font-medium mb-1" style="color: var(--color-foreground)">
							Amount <span style="color: var(--color-muted-foreground)">(pre-tax)</span>
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
					<div>
						<label for="gst_paid" class="block text-sm font-medium mb-1" style="color: var(--color-foreground)">
							GST/HST Paid <span style="color: var(--color-muted-foreground)">(optional)</span>
						</label>
						<input
							id="gst_paid"
							name="gst_paid"
							type="number"
							min="0"
							step="0.01"
							placeholder="0.00"
							class="w-full rounded-lg border px-3 py-2 text-sm"
							style="background-color: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						/>
					</div>
				</div>
				<div>
					<label for="notes" class="block text-sm font-medium mb-1" style="color: var(--color-foreground)">
						Notes <span style="color: var(--color-muted-foreground)">(optional)</span>
					</label>
					<input
						id="notes"
						name="notes"
						type="text"
						placeholder="e.g. annual plan, shared with personal use…"
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
						Save Expense
					</button>
				</div>
			</form>
		</div>
	{/if}

	<!-- Summary cards -->
	<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
		<div class="rounded-xl border p-4" style="background-color: var(--color-card); border-color: var(--color-border)">
			<p class="text-xs font-medium uppercase tracking-wide mb-1" style="color: var(--color-muted-foreground)">
				Total Expenses {data.year}
			</p>
			<p class="text-lg sm:text-xl font-bold" style="color: var(--color-foreground)">{fmt(totalExpenses)}</p>
		</div>
		<div class="rounded-xl border p-4" style="background-color: var(--color-card); border-color: var(--color-border)">
			<p class="text-xs font-medium uppercase tracking-wide mb-1" style="color: var(--color-muted-foreground)">
				GST/HST Paid (ITCs)
			</p>
			<p class="text-lg sm:text-xl font-bold" style="color: var(--color-foreground)">{fmt(totalGstPaid)}</p>
		</div>
		<div class="rounded-xl border p-4" style="background-color: var(--color-card); border-color: var(--color-border)">
			<p class="text-xs font-medium uppercase tracking-wide mb-1" style="color: var(--color-muted-foreground)">
				Entries
			</p>
			<p class="text-lg sm:text-xl font-bold" style="color: var(--color-primary)">{data.expenses.length}</p>
		</div>
	</div>

	<!-- Expense list -->
	{#if data.expenses.length === 0}
		<div
			class="rounded-xl border p-12 text-center"
			style="background-color: var(--color-card); border-color: var(--color-border)"
		>
			<Wallet size={32} class="mx-auto mb-3" style="color: var(--color-muted-foreground)" />
			<p class="text-sm font-medium" style="color: var(--color-foreground)">No expenses recorded for {data.year}</p>
			<p class="text-xs mt-1" style="color: var(--color-muted-foreground)">Use "Add Expense" to log one. Recurring services can be re-logged monthly with the copy button.</p>
		</div>
	{:else}
		<div class="rounded-xl border overflow-hidden" style="border-color: var(--color-border)">
			<div class="overflow-x-auto">
			<table class="w-full text-sm min-w-120">
				<thead>
					<tr style="background-color: var(--color-accent)">
						<th class="text-left px-4 py-3 font-medium" style="color: var(--color-muted-foreground)">Date</th>
						<th class="text-left px-4 py-3 font-medium" style="color: var(--color-muted-foreground)">Description</th>
						<th class="text-right px-4 py-3 font-medium" style="color: var(--color-muted-foreground)">Amount</th>
						<th class="text-right px-4 py-3 font-medium" style="color: var(--color-muted-foreground)">GST Paid</th>
						<th class="text-left px-4 py-3 font-medium" style="color: var(--color-muted-foreground)">Notes</th>
						<th scope="col" class="px-4 py-3"></th>
					</tr>
				</thead>
				<tbody>
					{#each data.expenses as expense, i}
						<tr
							class="border-t"
							style="border-color: var(--color-border); background-color: {i % 2 === 1 ? 'var(--color-accent)' : 'var(--color-card)'}"
						>
							<td class="px-4 py-3 font-medium" style="color: var(--color-foreground)">
								{fmtDate(expense.expense_date)}
							</td>
							<td class="px-4 py-3" style="color: var(--color-foreground)">
								{expense.description}
							</td>
							<td class="px-4 py-3 text-right font-mono font-medium" style="color: var(--color-foreground)">
								{fmt(expense.amount)}
							</td>
							<td class="px-4 py-3 text-right font-mono" style="color: var(--color-muted-foreground)">
								{expense.gst_paid ? fmt(expense.gst_paid) : '—'}
							</td>
							<td class="px-4 py-3 max-w-xs truncate" style="color: var(--color-muted-foreground)">
								{expense.notes || '—'}
							</td>
							<td class="px-4 py-3 text-right whitespace-nowrap">
								<form method="POST" action="?/duplicate" class="inline" use:enhance={() => async ({ update, result }) => { if (result.type === 'failure') { addToast((result.data as any)?.duplicateError ?? 'Failed to duplicate expense', 'error'); } else { addToast('Expense re-logged for today'); } await update(); }}>
									<input type="hidden" name="id" value={expense.id} />
									<button
										type="submit"
										class="p-1.5 rounded-md transition-colors hover:opacity-70"
										style="color: var(--color-muted-foreground)"
										aria-label="Re-log this expense for today"
										title="Re-log for today (recurring services)"
									>
										<Copy size={14} aria-hidden="true" />
									</button>
								</form>
								<button
									type="button"
									class="p-1.5 rounded-md transition-colors hover:bg-red-50 hover:text-red-600"
									style="color: var(--color-muted-foreground)"
									aria-label="Delete expense"
									onclick={() => { deleteExpenseId = expense.id; }}
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

		<p class="mt-3 text-xs flex items-center gap-1.5" style="color: var(--color-muted-foreground)">
			<Receipt size={12} aria-hidden="true" />
			These totals feed into the <a href="/taxes" class="underline underline-offset-2" style="color: var(--color-primary)">Taxes</a> page: expenses reduce the income tax base and GST paid reduces the net GST owed.
		</p>
	{/if}
</div>

<!-- Delete expense confirmation modal -->
{#if deleteExpenseId}
	<div class="fixed inset-0 z-50 flex items-center justify-center" style="background: rgba(0,0,0,0.4)">
		<div class="rounded-xl border shadow-xl p-5 max-w-sm w-full mx-4" style="background: var(--color-card); border-color: var(--color-border)">
			<p class="font-semibold mb-1" style="color: var(--color-foreground)">Delete this expense?</p>
			<p class="text-sm mb-4" style="color: var(--color-muted-foreground)">This action cannot be undone.</p>
			<div class="flex gap-2 justify-end">
				<button onclick={() => (deleteExpenseId = null)} class="px-3 py-1.5 rounded-lg border text-sm font-medium hover:bg-muted transition-colors" style="border-color: var(--color-border); color: var(--color-muted-foreground)">Cancel</button>
				<form method="POST" action="?/delete" use:enhance={() => async ({ update, result }) => { deleteExpenseId = null; if (result.type === 'failure') { addToast((result.data as any)?.deleteError ?? 'Failed to delete expense', 'error'); } else { addToast('Expense deleted'); } await update(); }}>
					<input type="hidden" name="id" value={deleteExpenseId} />
					<button type="submit" class="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors">Delete</button>
				</form>
			</div>
		</div>
	</div>
{/if}
