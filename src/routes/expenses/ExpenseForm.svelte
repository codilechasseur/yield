<script lang="ts" module>
	import type { ExpenseCategory, RecurrenceFrequency } from '$lib/types.js';

	/** Values shared by expenses and recurring schedules. */
	export interface ExpenseFormValues {
		id?: string;
		description: string;
		amount: number | null;
		gst_paid: number | null;
		category: ExpenseCategory | '';
		business_use_percent: number;
		notes: string;
		/** expense_date for expenses, start_date for schedules */
		date: string;
		receipt?: string;
		recurring?: string;
		frequency?: RecurrenceFrequency;
		end_date?: string;
	}
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { Paperclip, Repeat } from 'lucide-svelte';
	import FormAlert from '$lib/components/FormAlert.svelte';
	import Tip from '$lib/components/Tip.svelte';
	import { EXPENSE_CATEGORIES, categoryInfo, claimableItc, deductibleAmount } from '$lib/expenses.js';
	import { FREQUENCIES, toIsoDate } from '$lib/recurring.js';


	interface Props {
		/** create = new expense (optionally repeating) · edit = one expense · recurring = a schedule */
		mode: 'create' | 'edit' | 'recurring';
		values: ExpenseFormValues;
		defaultTaxPercent: number;
		error?: string | null;
		onCancel: () => void;
		onSaved: (result: Record<string, unknown> | undefined) => void;
	}

	let { mode, values, defaultTaxPercent, error, onCancel, onSaved }: Props = $props();

	const initial = untrack(() => values);
	const p = $derived(`exp-${mode}`); // id prefix — keeps label/for pairs unique per form

	let amount = $state<number | null>(initial.amount);
	let gstPaid = $state<number | null>(initial.gst_paid);
	let category = $state<ExpenseCategory | ''>(initial.category || '');
	let businessUse = $state<number>(initial.business_use_percent || 100);
	let repeat = $state(untrack(() => mode) === 'recurring');
	let frequency = $state<RecurrenceFrequency>(initial.frequency ?? 'monthly');
	let saving = $state(false);

	const preview = $derived({
		amount: amount ?? 0,
		gst_paid: gstPaid ?? 0,
		category,
		business_use_percent: businessUse
	});
	const deductible = $derived(deductibleAmount(preview));
	const itc = $derived(claimableItc(preview));
	const catInfo = $derived(categoryInfo(category));
	const showClaimNote = $derived(catInfo.deductibleShare < 1 || (businessUse > 0 && businessUse < 100));

	const action = $derived(mode === 'create' ? '?/create' : mode === 'edit' ? '?/update' : '?/updateRecurring');
	const submitLabel = $derived(mode === 'create' ? 'Save Expense' : mode === 'edit' ? 'Save Changes' : 'Save Recurring Expense');

	function fillGst() {
		if (amount && amount > 0) gstPaid = Math.round(amount * defaultTaxPercent) / 100;
	}

	function fmt(n: number): string {
		return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n);
	}

	const inputClass = 'w-full rounded-lg border px-3 py-2 text-sm';
	const inputStyle = 'background-color: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)';
</script>

<FormAlert message={error} class="mb-3" />
<form
	method="POST"
	{action}
	enctype="multipart/form-data"
	use:enhance={() => {
		saving = true;
		return async ({ update, result }) => {
			saving = false;
			await update({ reset: false });
			if (result.type === 'success') onSaved(result.data);
		};
	}}
	class="flex flex-col gap-4"
>
	{#if initial.id}<input type="hidden" name="id" value={initial.id} />{/if}

	{#if mode === 'edit' && initial.recurring}
		<p class="text-xs flex items-center gap-1.5" style="color: var(--color-muted-foreground)">
			<Repeat size={12} aria-hidden="true" />
			Created by a recurring expense. Changes here apply to this charge only.
		</p>
	{/if}
	{#if mode === 'recurring'}
		<p class="text-xs" style="color: var(--color-muted-foreground)">
			Changes apply to charges created from now on — charges already logged keep their amounts. Edit those individually.
		</p>
	{/if}

	<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
		<div>
			<label for="{p}-description" class="block text-sm font-medium mb-1" style="color: var(--color-foreground)">Description</label>
			<input id="{p}-description" name="description" type="text" required value={initial.description}
				placeholder="e.g. Anthropic subscription, web hosting…" class={inputClass} style={inputStyle} />
		</div>
		<div>
			<label for="{p}-category" class="block text-sm font-medium mb-1" style="color: var(--color-foreground)">Category</label>
			<select id="{p}-category" name="category" bind:value={category} aria-describedby="{p}-category-hint" class={inputClass} style={inputStyle}>
				<option value="">Choose a category…</option>
				{#each EXPENSE_CATEGORIES as c}
					<option value={c.value}>{c.label}</option>
				{/each}
			</select>
			<p id="{p}-category-hint" class="text-xs mt-1" style="color: var(--color-muted-foreground)">
				{category ? `${catInfo.hint} · T2125 line ${catInfo.t2125Line}` : 'Groups expenses the way your T2125 tax form does'}
			</p>
		</div>
	</div>

	<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
		<div>
			<label for="{p}-date" class="block text-sm font-medium mb-1" style="color: var(--color-foreground)">
				{mode === 'recurring' || repeat ? 'First charge date' : 'Date'}
			</label>
			<input id="{p}-date" name="expense_date" type="date" required value={toIsoDate(initial.date)} class={inputClass} style={inputStyle} />
		</div>
		<div>
			<label for="{p}-amount" class="block text-sm font-medium mb-1" style="color: var(--color-foreground)">
				Amount <span style="color: var(--color-muted-foreground)">(before tax)</span>
			</label>
			<input id="{p}-amount" name="amount" type="number" min="0.01" step="0.01" required placeholder="0.00"
				bind:value={amount} class="{inputClass} font-mono" style={inputStyle} />
		</div>
		<div>
			<label for="{p}-gst" class="flex items-center text-sm font-medium mb-1" style="color: var(--color-foreground)">
				GST/HST paid
				<Tip tip="The sales tax on the receipt. You can claim it back from CRA as an input tax credit, which lowers the GST/HST you owe." />
			</label>
			<div class="flex gap-2">
				<input id="{p}-gst" name="gst_paid" type="number" min="0" step="0.01" placeholder="0.00"
					bind:value={gstPaid} class="{inputClass} font-mono" style={inputStyle} />
				{#if defaultTaxPercent > 0}
					<button type="button" onclick={fillGst} disabled={!amount}
						class="shrink-0 px-2.5 rounded-lg border text-xs font-medium disabled:opacity-40 transition-colors hover:bg-muted"
						style="border-color: var(--color-border); color: var(--color-foreground)"
						aria-label="Fill GST/HST at {defaultTaxPercent}% of the amount">+{defaultTaxPercent}%</button>
				{/if}
			</div>
		</div>
	</div>

	<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
		<div>
			<label for="{p}-business" class="flex items-center text-sm font-medium mb-1" style="color: var(--color-foreground)">
				Business use (%)
				<Tip tip="If you also use this personally (a phone plan, internet, your car), only the business share is deductible. Use 100 for business-only costs." />
			</label>
			<input id="{p}-business" name="business_use_percent" type="number" min="1" max="100" step="1" required
				bind:value={businessUse} class="{inputClass} font-mono" style={inputStyle} />
		</div>
		<div class="sm:col-span-2">
			<label for="{p}-notes" class="block text-sm font-medium mb-1" style="color: var(--color-foreground)">
				Notes <span style="color: var(--color-muted-foreground)">(optional)</span>
			</label>
			<input id="{p}-notes" name="notes" type="text" value={initial.notes} placeholder="e.g. annual plan, invoice #1234…" class={inputClass} style={inputStyle} />
		</div>
	</div>

	<!-- What this means for taxes -->
	<p class="text-xs rounded-lg px-3 py-2" style="background-color: var(--color-accent); color: var(--color-muted-foreground)" aria-live="polite">
		Deductible from income: <strong class="font-mono" style="color: var(--color-foreground)">{fmt(deductible)}</strong>
		· GST/HST you can claim back: <strong class="font-mono" style="color: var(--color-foreground)">{fmt(itc)}</strong>
		{#if showClaimNote}
			<span class="block mt-0.5">
				{#if catInfo.deductibleShare < 1}Meals and entertainment are only 50% deductible.{/if}
				{#if businessUse < 100}Only the {businessUse}% business share counts.{/if}
			</span>
		{/if}
	</p>

	{#if mode !== 'recurring'}
		<div>
			<label for="{p}-receipt" class="block text-sm font-medium mb-1" style="color: var(--color-foreground)">
				Receipt <span style="color: var(--color-muted-foreground)">(optional · PDF or image, up to 10 MB)</span>
			</label>
			<input id="{p}-receipt" name="receipt" type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
				class="block w-full text-sm" style="color: var(--color-foreground)" />
			{#if mode === 'edit' && initial.receipt && initial.id}
				<div class="mt-2 flex flex-wrap items-center gap-3 text-xs">
					<a href="/api/expenses/{initial.id}/receipt" target="_blank" rel="noopener" class="inline-flex items-center gap-1 underline" style="color: var(--color-primary)">
						<Paperclip size={12} aria-hidden="true" /> View current receipt
					</a>
					<label class="inline-flex items-center gap-1.5" style="color: var(--color-muted-foreground)">
						<input type="checkbox" name="remove_receipt" /> Remove it
					</label>
				</div>
			{/if}
		</div>
	{/if}

	{#if mode === 'create'}
		<label class="inline-flex items-center gap-2 text-sm font-medium" style="color: var(--color-foreground)">
			<input type="checkbox" name="repeat" bind:checked={repeat} />
			This repeats (subscription, rent, phone bill…)
		</label>
	{/if}

	{#if repeat}
		<fieldset class="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border p-3" style="border-color: var(--color-border)">
			<legend class="px-1 text-xs font-medium" style="color: var(--color-muted-foreground)">Repeat</legend>
			<div>
				<label for="{p}-frequency" class="block text-sm font-medium mb-1" style="color: var(--color-foreground)">How often</label>
				<select id="{p}-frequency" name="frequency" bind:value={frequency} class={inputClass} style={inputStyle}>
					{#each FREQUENCIES as f}
						<option value={f.value}>{f.label}</option>
					{/each}
				</select>
			</div>
			<div>
				<label for="{p}-end" class="block text-sm font-medium mb-1" style="color: var(--color-foreground)">
					Last charge <span style="color: var(--color-muted-foreground)">(optional)</span>
				</label>
				<input id="{p}-end" name="end_date" type="date" value={toIsoDate(initial.end_date)} class={inputClass} style={inputStyle} />
			</div>
			<p class="sm:col-span-2 text-xs" style="color: var(--color-muted-foreground)">
				Yield logs each charge automatically on its due date, keeping the day of the month of the first charge.
				{#if mode === 'create'}A first charge date in the past also fills in the charges since then.{/if}
			</p>
		</fieldset>
	{/if}

	<div class="flex gap-3 justify-end">
		<button type="button" onclick={onCancel} class="px-4 py-2 rounded-lg text-sm font-medium border"
			style="border-color: var(--color-border); color: var(--color-muted-foreground)">Cancel</button>
		<button type="submit" disabled={saving} class="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
			style="background-color: var(--color-primary); color: var(--color-primary-foreground)">
			{saving ? 'Saving…' : submitLabel}
		</button>
	</div>
</form>
