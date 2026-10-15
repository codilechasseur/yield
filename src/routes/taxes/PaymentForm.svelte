<script lang="ts" module>
	import type { TaxPaymentType } from '$lib/types.js';

	export interface PaymentFormValues {
		id?: string;
		type: TaxPaymentType;
		amount: number | null;
		payment_date: string;
		period: string;
		notes: string;
	}
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import FormAlert from '$lib/components/FormAlert.svelte';
	import { gstPeriods, periodLabel } from '$lib/gst-periods.js';
	import type { GstFilingFrequency } from '$lib/types.js';

	interface Props {
		values: PaymentFormValues;
		year: number;
		gstFrequency: GstFilingFrequency;
		error?: string | null;
		onCancel: () => void;
		onSaved: () => void;
	}

	let { values, year, gstFrequency, error, onCancel, onSaved }: Props = $props();

	const initial = untrack(() => values);
	let type = $state<TaxPaymentType>(initial.type);
	let period = $state(initial.period);
	let saving = $state(false);

	// Payments usually settle the current or previous year.
	const gstOptions = $derived(
		[year, year - 1].flatMap((y) => gstPeriods(y, gstFrequency)).map((p) => ({ value: p.key, label: p.label }))
	);
	const incomeOptions = $derived([year, year - 1].map((y) => ({ value: String(y), label: `${y} tax year` })));
	const options = $derived.by(() => {
		const list = type === 'gst' ? gstOptions : incomeOptions;
		// Keep an existing value selectable even if it's outside the usual range (e.g. older frequency).
		return period && !list.some((o) => o.value === period) ? [{ value: period, label: periodLabel(period) }, ...list] : list;
	});

	function onTypeChange() {
		if (!options.some((o) => o.value === period)) period = type === 'income_tax' ? String(year) : '';
	}

	const inputClass = 'w-full rounded-lg border px-3 py-2 text-sm';
	const inputStyle = 'background-color: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)';
</script>

<FormAlert message={error} class="mb-3" />
<form
	method="POST"
	action={initial.id ? '?/update' : '?/create'}
	use:enhance={() => {
		saving = true;
		return async ({ update, result }) => {
			saving = false;
			await update({ reset: false });
			if (result.type === 'success') onSaved();
		};
	}}
	class="flex flex-col gap-4"
>
	{#if initial.id}<input type="hidden" name="id" value={initial.id} />{/if}
	<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
		<div>
			<label for="pay-type" class="block text-sm font-medium mb-1" style="color: var(--color-foreground)">Type</label>
			<select id="pay-type" name="type" required bind:value={type} onchange={onTypeChange} class={inputClass} style={inputStyle}>
				<option value="income_tax">Income tax (incl. CPP)</option>
				<option value="gst">GST / HST</option>
			</select>
		</div>
		<div>
			<label for="pay-period" class="block text-sm font-medium mb-1" style="color: var(--color-foreground)">Pays for</label>
			<select id="pay-period" name="period" bind:value={period} aria-describedby="pay-period-hint" class={inputClass} style={inputStyle}>
				<option value="">Not specified (counts toward the year paid)</option>
				{#each options as o}
					<option value={o.value}>{o.label}</option>
				{/each}
			</select>
			<p id="pay-period-hint" class="text-xs mt-1" style="color: var(--color-muted-foreground)">
				E.g. a 2025 balance paid in April 2026 is for the 2025 tax year.
			</p>
		</div>
	</div>
	<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
		<div>
			<label for="pay-amount" class="block text-sm font-medium mb-1" style="color: var(--color-foreground)">Amount</label>
			<input id="pay-amount" name="amount" type="number" min="0.01" step="0.01" required placeholder="0.00"
				value={initial.amount ?? ''} class="{inputClass} font-mono" style={inputStyle} />
		</div>
		<div>
			<label for="pay-date" class="block text-sm font-medium mb-1" style="color: var(--color-foreground)">Payment date</label>
			<input id="pay-date" name="payment_date" type="date" required value={initial.payment_date.slice(0, 10)} class={inputClass} style={inputStyle} />
		</div>
	</div>
	<div>
		<label for="pay-notes" class="block text-sm font-medium mb-1" style="color: var(--color-foreground)">
			Notes <span style="color: var(--color-muted-foreground)">(optional)</span>
		</label>
		<input id="pay-notes" name="notes" type="text" value={initial.notes} placeholder="e.g. confirmation number" class={inputClass} style={inputStyle} />
	</div>
	<div class="flex gap-3 justify-end">
		<button type="button" onclick={onCancel} class="px-4 py-2 rounded-lg text-sm font-medium border"
			style="border-color: var(--color-border); color: var(--color-muted-foreground)">Cancel</button>
		<button type="submit" disabled={saving} class="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
			style="background-color: var(--color-primary); color: var(--color-primary-foreground)">
			{saving ? 'Saving…' : initial.id ? 'Save Changes' : 'Save Payment'}
		</button>
	</div>
</form>
