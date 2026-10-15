<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { tick } from 'svelte';
	import {
		Wallet, Trash2, Plus, Receipt, Pencil, Repeat, Paperclip, Search, ChevronLeft, ChevronRight, CircleStop, ChartPie
	} from 'lucide-svelte';
	import { addToast } from '$lib/toasts.svelte.js';
	import FormAlert from '$lib/components/FormAlert.svelte';
	import Tip from '$lib/components/Tip.svelte';
	import ExpenseForm, { type ExpenseFormValues } from './ExpenseForm.svelte';
	import { EXPENSE_CATEGORIES, categoryInfo, deductibleAmount } from '$lib/expenses.js';
	import { frequencyLabel } from '$lib/recurring.js';
	import { homeCostLabel } from '$lib/home-office.js';
	import type { Expense } from '$lib/types.js';
	import type { PageData, ActionData } from './$types.js';
	import type { RecurringRow } from './+page.server.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

	function fmt(amount: number): string {
		return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);
	}

	function fmtDate(d: string): string {
		return new Date(d).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
	}

	type FormState =
		| { mode: 'create'; values: ExpenseFormValues }
		| { mode: 'edit'; values: ExpenseFormValues }
		| { mode: 'recurring'; values: ExpenseFormValues };

	let formState = $state<FormState | null>(null);
	let formKey = $state(0);
	let formPanel = $state<HTMLElement | null>(null);
	let deleteExpense = $state<Expense | null>(null);
	let deleteSchedule = $state<RecurringRow | null>(null);

	async function openForm(next: FormState) {
		formState = next;
		formKey++;
		await tick();
		formPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		formPanel?.querySelector<HTMLInputElement>('input[name=description]')?.focus();
	}

	function openCreate() {
		if (formState?.mode === 'create') {
			formState = null;
			return;
		}
		openForm({
			mode: 'create',
			values: { description: '', amount: null, gst_paid: null, category: '', business_use_percent: 100, notes: '', date: data.today }
		});
	}

	function openEdit(e: Expense) {
		openForm({
			mode: 'edit',
			values: {
				id: e.id, description: e.description, amount: e.amount, gst_paid: e.gst_paid || null, category: e.category,
				business_use_percent: e.business_use_percent || 100, home_cost_type: e.home_cost_type, notes: e.notes, date: e.expense_date,
				receipt: e.receipt, recurring: e.recurring
			}
		});
	}

	function openRecurring(r: RecurringRow) {
		openForm({
			mode: 'recurring',
			values: {
				id: r.id, description: r.description, amount: r.amount, gst_paid: r.gst_paid || null, category: r.category,
				business_use_percent: r.business_use_percent || 100, home_cost_type: r.home_cost_type, notes: r.notes, date: r.start_date,
				frequency: r.frequency, end_date: r.end_date
			}
		});
	}

	function onSaved(result: Record<string, unknown> | undefined) {
		const mode = formState?.mode;
		formState = null;
		if (mode === 'create') {
			const n = Number(result?.chargesCreated ?? 1);
			addToast(n > 1 ? `Recurring expense added — ${n} past charges logged` : 'Expense added');
		} else if (mode === 'edit') {
			addToast('Expense updated');
		} else {
			const added = Number(result?.chargesCreated ?? 0);
			const removed = Number(result?.chargesRemoved ?? 0);
			const kept = Number(result?.chargesKept ?? 0);
			const parts = [
				added && `${added} ${added === 1 ? 'charge' : 'charges'} added`,
				removed && `${removed} removed`,
				kept && `${kept} edited ${kept === 1 ? 'charge' : 'charges'} kept on ${kept === 1 ? 'its' : 'their'} old date`
			].filter(Boolean);
			addToast(parts.length ? `Recurring expense updated — ${parts.join(', ')}` : 'Recurring expense updated');
		}
	}

	const formError = $derived(
		formState?.mode === 'create' ? form?.createError : formState?.mode === 'edit' ? form?.updateError : form?.recurringError
	);

	function pageUrl(p: number) {
		const params = new URLSearchParams(page.url.searchParams);
		params.set('page', String(p));
		return `?${params}`;
	}

	function categoryUrl(category: string) {
		const params = new URLSearchParams({ year: String(data.year), category });
		return `?${params}`;
	}

	/** Category label, plus the Part 7 line for home costs. */
	function categoryText(e: { category: Expense['category']; home_cost_type?: Expense['home_cost_type'] }): string {
		const label = categoryInfo(e.category).label;
		return e.category === 'home_office' ? `${label} · ${homeCostLabel(e.home_cost_type)}` : label;
	}

	function homeShareFor(date: string): number | null {
		return data.homeShares[date.slice(0, 4)] ?? null;
	}

	const activeSchedules = $derived(data.recurring.filter((r) => r.nextDate));
	const endedSchedules = $derived(data.recurring.filter((r) => !r.nextDate));

	const selectClass = 'rounded-lg border px-3 py-1.5 text-sm';
	const selectStyle = 'background-color: var(--color-card); border-color: var(--color-border); color: var(--color-foreground)';
	const cardStyle = 'background-color: var(--color-card); border-color: var(--color-border)';
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
				Business costs lower the income you pay tax on, and the GST/HST you paid on them comes off what you owe
			</p>
		</div>
		<button
			onclick={openCreate}
			class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 shrink-0"
			style="background-color: var(--color-primary); color: var(--color-primary-foreground)"
		>
			<Plus size={16} aria-hidden="true" />
			Add Expense
		</button>
	</div>

	<!-- Filters -->
	<form method="GET" class="mb-6 flex flex-wrap items-end gap-3" role="search" aria-label="Filter expenses">
		<div class="flex flex-col gap-1">
			<label class="text-xs font-medium" style="color: var(--color-muted-foreground)" for="year-select">Year</label>
			<select id="year-select" name="year" class={selectClass} style={selectStyle}
				onchange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()}>
				{#each data.availableYears as y}
					<option value={y} selected={y === data.year}>{y}</option>
				{/each}
			</select>
		</div>
		<div class="flex flex-col gap-1">
			<label class="text-xs font-medium" style="color: var(--color-muted-foreground)" for="month-select">Month</label>
			<select id="month-select" name="month" class={selectClass} style={selectStyle}
				onchange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()}>
				<option value="">All months</option>
				{#each MONTHS as m, i}
					<option value={i + 1} selected={data.filters.month === i + 1}>{m}</option>
				{/each}
			</select>
		</div>
		<div class="flex flex-col gap-1">
			<label class="text-xs font-medium" style="color: var(--color-muted-foreground)" for="category-select">Category</label>
			<select id="category-select" name="category" class={selectClass} style={selectStyle}
				onchange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()}>
				<option value="">All categories</option>
				{#each EXPENSE_CATEGORIES as c}
					<option value={c.value} selected={data.filters.category === c.value}>{c.label}</option>
				{/each}
			</select>
		</div>
		<div class="flex flex-col gap-1 grow min-w-48">
			<label class="text-xs font-medium" style="color: var(--color-muted-foreground)" for="expense-search">Search</label>
			<div class="flex gap-2">
				<input id="expense-search" name="q" type="search" value={data.filters.q} placeholder="Description or notes"
					class="{selectClass} grow" style={selectStyle} />
				<button type="submit" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium hover:bg-muted transition-colors"
					style="border-color: var(--color-border); color: var(--color-foreground)">
					<Search size={14} aria-hidden="true" /> Search
				</button>
			</div>
		</div>
		{#if data.hasFilters}
			<a href="?year={data.year}" class="text-sm underline underline-offset-2 pb-2" style="color: var(--color-primary)">Clear filters</a>
		{/if}
	</form>

	<FormAlert message={data.loadError} class="mb-6" />

	<!-- Add / edit form -->
	{#if formState}
		<section bind:this={formPanel} class="mb-6 rounded-xl border p-5 scroll-mt-6" style={cardStyle} aria-labelledby="expense-form-title">
			<h3 id="expense-form-title" class="text-base font-semibold mb-4" style="color: var(--color-foreground)">
				{formState.mode === 'create' ? 'Add an Expense' : formState.mode === 'edit' ? 'Edit Expense' : 'Edit Recurring Expense'}
			</h3>
			{#key formKey}
				<ExpenseForm
					mode={formState.mode}
					values={formState.values}
					defaultTaxPercent={data.defaultTaxPercent}
					homeShares={data.homeShares}
					error={formError}
					onCancel={() => (formState = null)}
					{onSaved}
				/>
			{/key}
		</section>
	{/if}

	<!-- Summary cards -->
	<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
		<div class="rounded-xl border p-4" style={cardStyle}>
			<p class="text-xs font-medium uppercase tracking-wide mb-1" style="color: var(--color-muted-foreground)">Spent in {data.year}</p>
			<p class="text-lg sm:text-xl font-bold" style="color: var(--color-foreground)">{fmt(data.yearTotals.spent)}</p>
			<p class="text-xs mt-0.5" style="color: var(--color-muted-foreground)">{data.yearTotals.count} {data.yearTotals.count === 1 ? 'expense' : 'expenses'}, before tax</p>
		</div>
		<div class="rounded-xl border p-4" style={cardStyle}>
			<p class="text-xs font-medium uppercase tracking-wide mb-1 inline-flex items-center" style="color: var(--color-muted-foreground)">
				Deductible <Tip tip="What actually comes off your taxable income: the business-use share of each expense, with meals at 50%." />
			</p>
			<p class="text-lg sm:text-xl font-bold" style="color: var(--color-foreground)">{fmt(data.yearTotals.deductible)}</p>
			<p class="text-xs mt-0.5" style="color: var(--color-muted-foreground)">Lowers your income tax</p>
		</div>
		<div class="rounded-xl border p-4" style={cardStyle}>
			<p class="text-xs font-medium uppercase tracking-wide mb-1 inline-flex items-center" style="color: var(--color-muted-foreground)">
				GST/HST to claim <Tip tip="Input tax credits: the GST/HST you paid on business purchases. It's subtracted from the GST/HST you collected when you file." />
			</p>
			<p class="text-lg sm:text-xl font-bold" style="color: var(--color-foreground)">{fmt(data.yearTotals.itc)}</p>
			<p class="text-xs mt-0.5" style="color: var(--color-muted-foreground)">Input tax credits</p>
		</div>
		<div class="rounded-xl border p-4" style={cardStyle}>
			<p class="text-xs font-medium uppercase tracking-wide mb-1" style="color: var(--color-muted-foreground)">Recurring</p>
			<p class="text-lg sm:text-xl font-bold" style="color: var(--color-primary)">{fmt(data.recurringAnnual)}<span class="text-sm font-medium"> /yr</span></p>
			<p class="text-xs mt-0.5" style="color: var(--color-muted-foreground)">{activeSchedules.length} active {activeSchedules.length === 1 ? 'subscription' : 'subscriptions'}</p>
		</div>
	</div>

	<!-- Recurring expenses -->
	{#if data.recurring.length > 0}
		<section class="rounded-xl border overflow-hidden mb-6" style={cardStyle} aria-labelledby="recurring-title">
			<div class="px-5 py-3 border-b flex items-center gap-2" style="border-color: var(--color-border)">
				<Repeat size={15} style="color: var(--color-primary)" aria-hidden="true" />
				<h3 id="recurring-title" class="font-semibold text-sm" style="color: var(--color-foreground)">Recurring expenses</h3>
				<span class="text-xs ml-auto" style="color: var(--color-muted-foreground)">Logged automatically on each due date</span>
			</div>
			<FormAlert message={!formState ? form?.recurringError : null} class="m-4" />
			<div class="relative overflow-x-auto">
				<table class="w-full text-sm min-w-140">
					<thead>
						<tr style="background-color: var(--color-accent)">
							<th scope="col" class="text-left px-4 py-2.5 font-medium" style="color: var(--color-muted-foreground)">Description</th>
							<th scope="col" class="text-right px-4 py-2.5 font-medium" style="color: var(--color-muted-foreground)">Amount</th>
							<th scope="col" class="text-left px-4 py-2.5 font-medium" style="color: var(--color-muted-foreground)">Next charge</th>
							<th scope="col" class="text-right px-4 py-2.5 font-medium" style="color: var(--color-muted-foreground)">Per year</th>
							<th scope="col" class="px-4 py-2.5"><span class="sr-only">Actions</span></th>
						</tr>
					</thead>
					<tbody>
						{#each [...activeSchedules, ...endedSchedules] as r (r.id)}
							<tr class="border-t" style="border-color: var(--color-border)">
								<td class="px-4 py-2.5" style="color: var(--color-foreground)">
									<span class="font-medium">{r.description}</span>
									<span class="block text-xs" style="color: var(--color-muted-foreground)">
										{categoryText(r)} · since {fmtDate(r.start_date)} · {r.chargeCount} {r.chargeCount === 1 ? 'charge' : 'charges'} logged
									</span>
								</td>
								<td class="px-4 py-2.5 text-right font-mono whitespace-nowrap" style="color: var(--color-foreground)">
									{fmt(r.amount)} <span class="text-xs font-sans" style="color: var(--color-muted-foreground)">{frequencyLabel(r.frequency).toLowerCase()}</span>
								</td>
								<td class="px-4 py-2.5 whitespace-nowrap" style="color: var(--color-foreground)">
									{#if r.nextDate}
										{fmtDate(r.nextDate)}
									{:else}
										<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style="background-color: var(--color-muted); color: var(--color-muted-foreground)">
											Ended {r.end_date ? fmtDate(r.end_date) : ''}
										</span>
									{/if}
								</td>
								<td class="px-4 py-2.5 text-right font-mono" style="color: {r.nextDate ? 'var(--color-foreground)' : 'var(--color-muted-foreground)'}">
									{r.nextDate ? fmt(r.annualCost) : '—'}
								</td>
								<td class="px-4 py-2.5 text-right whitespace-nowrap">
									<button type="button" class="p-1.5 rounded-md transition-colors hover:opacity-70" style="color: var(--color-muted-foreground)"
										aria-label="Edit recurring expense {r.description}" title="Edit" onclick={() => openRecurring(r)}>
										<Pencil size={14} aria-hidden="true" />
									</button>
									{#if r.nextDate}
										<form method="POST" action="?/stopRecurring" class="inline"
											use:enhance={() => async ({ update, result }) => { await update(); if (result.type === 'success') addToast(`${r.description} stopped — no further charges`); }}>
											<input type="hidden" name="id" value={r.id} />
											<button type="submit" class="p-1.5 rounded-md transition-colors hover:opacity-70" style="color: var(--color-muted-foreground)"
												aria-label="Stop recurring expense {r.description}" title="Stop (cancelled subscription)">
												<CircleStop size={14} aria-hidden="true" />
											</button>
										</form>
									{/if}
									<button type="button" class="p-1.5 rounded-md transition-colors hover:bg-red-50 hover:text-red-600" style="color: var(--color-muted-foreground)"
										aria-label="Delete recurring expense {r.description}" title="Delete" onclick={() => (deleteSchedule = r)}>
										<Trash2 size={14} aria-hidden="true" />
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/if}

	<!-- By category (T2125) -->
	{#if data.yearTotals.byCategory.length > 0}
		<details class="rounded-xl border overflow-hidden mb-6 group" style={cardStyle}>
			<summary class="px-5 py-3 flex items-center gap-2 cursor-pointer select-none">
				<ChartPie size={15} style="color: var(--color-primary)" aria-hidden="true" />
				<span class="font-semibold text-sm" style="color: var(--color-foreground)">By category — {data.year}</span>
				<span class="text-xs ml-auto" style="color: var(--color-muted-foreground)">Totals for your T2125 form</span>
			</summary>
			<div class="relative overflow-x-auto border-t" style="border-color: var(--color-border)">
				<table class="w-full text-sm min-w-140">
					<thead>
						<tr style="background-color: var(--color-accent)">
							<th scope="col" class="text-left px-4 py-2.5 font-medium" style="color: var(--color-muted-foreground)">Category</th>
							<th scope="col" class="text-left px-4 py-2.5 font-medium" style="color: var(--color-muted-foreground)">T2125 line</th>
							<th scope="col" class="text-right px-4 py-2.5 font-medium" style="color: var(--color-muted-foreground)">Spent</th>
							<th scope="col" class="text-right px-4 py-2.5 font-medium" style="color: var(--color-muted-foreground)">Deductible</th>
							<th scope="col" class="text-right px-4 py-2.5 font-medium" style="color: var(--color-muted-foreground)">GST/HST to claim</th>
						</tr>
					</thead>
					<tbody>
						{#each data.yearTotals.byCategory as c}
							<tr class="border-t" style="border-color: var(--color-border)">
								<td class="px-4 py-2.5">
									<a href={categoryUrl(c.category)} class="underline underline-offset-2" style="color: var(--color-foreground)">{c.label}</a>
									<span class="text-xs" style="color: var(--color-muted-foreground)">({c.count})</span>
								</td>
								<td class="px-4 py-2.5 font-mono" style="color: var(--color-muted-foreground)">{c.t2125Line}</td>
								<td class="px-4 py-2.5 text-right font-mono" style="color: var(--color-muted-foreground)">{fmt(c.spent)}</td>
								<td class="px-4 py-2.5 text-right font-mono font-medium" style="color: var(--color-foreground)">{fmt(c.deductible)}</td>
								<td class="px-4 py-2.5 text-right font-mono" style="color: var(--color-foreground)">{fmt(c.itc)}</td>
							</tr>
						{/each}
						<tr class="border-t font-semibold" style="border-color: var(--color-border); background-color: var(--color-accent)">
							<th scope="row" colspan="2" class="text-left px-4 py-2.5" style="color: var(--color-foreground)">Total</th>
							<td class="px-4 py-2.5 text-right font-mono" style="color: var(--color-foreground)">{fmt(data.yearTotals.spent)}</td>
							<td class="px-4 py-2.5 text-right font-mono" style="color: var(--color-foreground)">{fmt(data.yearTotals.deductible)}</td>
							<td class="px-4 py-2.5 text-right font-mono" style="color: var(--color-foreground)">{fmt(data.yearTotals.itc)}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</details>
	{/if}

	<!-- Expense list -->
	{#if data.expenses.length === 0}
		<div class="rounded-xl border p-12 text-center" style={cardStyle}>
			<Wallet size={32} class="mx-auto mb-3" style="color: var(--color-muted-foreground)" aria-hidden="true" />
			{#if data.hasFilters}
				<p class="text-sm font-medium" style="color: var(--color-foreground)">No expenses match these filters</p>
				<p class="text-xs mt-1" style="color: var(--color-muted-foreground)"><a href="?year={data.year}" class="underline" style="color: var(--color-primary)">Clear filters</a> to see all of {data.year}.</p>
			{:else}
				<p class="text-sm font-medium" style="color: var(--color-foreground)">No expenses recorded for {data.year}</p>
				<p class="text-xs mt-1" style="color: var(--color-muted-foreground)">Use "Add Expense" to log one. For subscriptions, tick "This repeats" and Yield logs each charge for you.</p>
			{/if}
		</div>
	{:else}
		{#if data.filteredTotals}
			<p class="mb-2 text-sm" style="color: var(--color-muted-foreground)">
				{data.filteredTotals.count} matching {data.filteredTotals.count === 1 ? 'expense' : 'expenses'} ·
				{fmt(data.filteredTotals.spent)} spent · {fmt(data.filteredTotals.deductible)} deductible
			</p>
		{/if}
		<div class="rounded-xl border overflow-hidden" style="border-color: var(--color-border)">
			<div class="relative overflow-x-auto">
				<table class="w-full text-sm min-w-160">
					<thead>
						<tr style="background-color: var(--color-accent)">
							<th scope="col" class="text-left px-4 py-3 font-medium" style="color: var(--color-muted-foreground)">Date</th>
							<th scope="col" class="text-left px-4 py-3 font-medium" style="color: var(--color-muted-foreground)">Description</th>
							<th scope="col" class="text-right px-4 py-3 font-medium" style="color: var(--color-muted-foreground)">Amount</th>
							<th scope="col" class="text-right px-4 py-3 font-medium" style="color: var(--color-muted-foreground)">GST/HST</th>
							<th scope="col" class="text-right px-4 py-3 font-medium" style="color: var(--color-muted-foreground)">Deductible</th>
							<th scope="col" class="px-4 py-3"><span class="sr-only">Actions</span></th>
						</tr>
					</thead>
					<tbody>
						{#each data.expenses as expense, i (expense.id)}
							{@const homeShare = expense.category === 'home_office' ? homeShareFor(expense.expense_date) : null}
							{@const deductible = deductibleAmount(expense, { homeShare })}
							<tr class="border-t" style="border-color: var(--color-border); background-color: {i % 2 === 1 ? 'var(--color-accent)' : 'var(--color-card)'}">
								<td class="px-4 py-3 font-medium whitespace-nowrap align-top" style="color: var(--color-foreground)">{fmtDate(expense.expense_date)}</td>
								<td class="px-4 py-3 align-top" style="color: var(--color-foreground)">
									<span>{expense.description}</span>
									<span class="mt-1 flex flex-wrap items-center gap-1.5 text-xs" style="color: var(--color-muted-foreground)">
										<span class="inline-flex items-center px-2 py-0.5 rounded-full" style="background-color: var(--color-muted)">{categoryText(expense)}</span>
										{#if expense.recurring}
											<span class="inline-flex items-center gap-1"><Repeat size={11} aria-hidden="true" />Recurring</span>
										{/if}
										{#if homeShare !== null}
											<span>{Math.round(homeShare * 1000) / 10}% home office share</span>
										{:else if expense.business_use_percent && expense.business_use_percent < 100}
											<span>{expense.business_use_percent}% business</span>
										{/if}
										{#if expense.receipt}
											<a href="/api/expenses/{expense.id}/receipt" target="_blank" rel="noopener" class="inline-flex items-center gap-1 underline" style="color: var(--color-primary)">
												<Paperclip size={11} aria-hidden="true" />Receipt
											</a>
										{/if}
										{#if expense.notes}<span class="truncate max-w-xs">{expense.notes}</span>{/if}
									</span>
								</td>
								<td class="px-4 py-3 text-right font-mono font-medium align-top" style="color: var(--color-foreground)">{fmt(expense.amount)}</td>
								<td class="px-4 py-3 text-right font-mono align-top" style="color: var(--color-muted-foreground)">{expense.gst_paid ? fmt(expense.gst_paid) : '—'}</td>
								<td class="px-4 py-3 text-right font-mono align-top" style="color: {deductible < expense.amount ? 'var(--color-foreground)' : 'var(--color-muted-foreground)'}">{fmt(deductible)}</td>
								<td class="px-4 py-3 text-right whitespace-nowrap align-top">
									<button type="button" class="p-1.5 rounded-md transition-colors hover:opacity-70" style="color: var(--color-muted-foreground)"
										aria-label="Edit expense {expense.description}" title="Edit" onclick={() => openEdit(expense)}>
										<Pencil size={14} aria-hidden="true" />
									</button>
									<button type="button" class="p-1.5 rounded-md transition-colors hover:bg-red-50 hover:text-red-600" style="color: var(--color-muted-foreground)"
										aria-label="Delete expense {expense.description}" title="Delete" onclick={() => (deleteExpense = expense)}>
										<Trash2 size={14} aria-hidden="true" />
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		{#if data.totalPages > 1}
			<nav class="mt-6 flex items-center justify-center gap-2" aria-label="Expense pages">
				{#if data.page > 1}
					<a href={pageUrl(data.page - 1)} class="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm transition-colors hover:bg-muted"
						style="border-color: var(--color-border); color: var(--color-foreground)"><ChevronLeft size={15} aria-hidden="true" /> Prev</a>
				{/if}
				<span class="text-sm px-2" style="color: var(--color-muted-foreground)">Page {data.page} of {data.totalPages}</span>
				{#if data.page < data.totalPages}
					<a href={pageUrl(data.page + 1)} class="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm transition-colors hover:bg-muted"
						style="border-color: var(--color-border); color: var(--color-foreground)">Next <ChevronRight size={15} aria-hidden="true" /></a>
				{/if}
			</nav>
		{/if}

		<p class="mt-3 text-xs flex items-center gap-1.5" style="color: var(--color-muted-foreground)">
			<Receipt size={12} aria-hidden="true" />
			These feed the <a href="/taxes?year={data.year}" class="underline underline-offset-2" style="color: var(--color-primary)">Taxes</a> page: deductible amounts lower your income tax, and GST/HST to claim lowers what you remit.
		</p>
	{/if}
</div>

<!-- Delete expense confirmation -->
{#if deleteExpense}
	<div class="fixed inset-0 z-50 flex items-center justify-center" style="background: rgba(0,0,0,0.4)">
		<div role="alertdialog" aria-modal="true" aria-labelledby="del-exp-title" class="rounded-xl border shadow-xl p-5 max-w-sm w-full mx-4" style="background: var(--color-card); border-color: var(--color-border)">
			<p id="del-exp-title" class="font-semibold mb-1" style="color: var(--color-foreground)">Delete this expense?</p>
			<p class="text-sm mb-4" style="color: var(--color-muted-foreground)">
				{deleteExpense.description} · {fmt(deleteExpense.amount)} on {fmtDate(deleteExpense.expense_date)}.
				{#if deleteExpense.recurring}It won't be recreated by its recurring schedule.{/if}
				This can't be undone.
			</p>
			<div class="flex gap-2 justify-end">
				<button onclick={() => (deleteExpense = null)} class="px-3 py-1.5 rounded-lg border text-sm font-medium hover:bg-muted transition-colors" style="border-color: var(--color-border); color: var(--color-muted-foreground)">Cancel</button>
				<form method="POST" action="?/delete" use:enhance={() => async ({ update, result }) => { deleteExpense = null; if (result.type === 'failure') { addToast((result.data as { deleteError?: string })?.deleteError ?? 'Failed to delete expense', 'error'); } else { addToast('Expense deleted'); } await update(); }}>
					<input type="hidden" name="id" value={deleteExpense.id} />
					<button type="submit" class="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors">Delete</button>
				</form>
			</div>
		</div>
	</div>
{/if}

<!-- Delete recurring schedule confirmation -->
{#if deleteSchedule}
	<div class="fixed inset-0 z-50 flex items-center justify-center" style="background: rgba(0,0,0,0.4)">
		<div role="alertdialog" aria-modal="true" aria-labelledby="del-rec-title" class="rounded-xl border shadow-xl p-5 max-w-sm w-full mx-4" style="background: var(--color-card); border-color: var(--color-border)">
			<p id="del-rec-title" class="font-semibold mb-1" style="color: var(--color-foreground)">Delete "{deleteSchedule.description}"?</p>
			<form method="POST" action="?/deleteRecurring" use:enhance={() => async ({ update, result }) => { deleteSchedule = null; if (result.type === 'failure') { addToast((result.data as { recurringError?: string })?.recurringError ?? 'Failed to delete', 'error'); } else { addToast('Recurring expense deleted'); } await update(); }}>
				<p class="text-sm mb-3" style="color: var(--color-muted-foreground)">
					No more charges will be logged. To keep the history but stop future charges, use Stop instead.
				</p>
				{#if deleteSchedule.chargeCount > 0}
					<label class="flex items-start gap-2 text-sm mb-4" style="color: var(--color-foreground)">
						<input type="checkbox" name="delete_charges" class="mt-0.5" />
						Also delete the {deleteSchedule.chargeCount} {deleteSchedule.chargeCount === 1 ? 'expense' : 'expenses'} it already logged
					</label>
				{/if}
				<input type="hidden" name="id" value={deleteSchedule.id} />
				<div class="flex gap-2 justify-end">
					<button type="button" onclick={() => (deleteSchedule = null)} class="px-3 py-1.5 rounded-lg border text-sm font-medium hover:bg-muted transition-colors" style="border-color: var(--color-border); color: var(--color-muted-foreground)">Cancel</button>
					<button type="submit" class="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors">Delete</button>
				</div>
			</form>
		</div>
	</div>
{/if}
