<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { tick } from 'svelte';
	import {
		Landmark, Trash2, Plus, Receipt, Calculator, AlertTriangle, CalendarDays, Pencil, PiggyBank, Settings2, Globe, CalendarClock, Info, House
	} from 'lucide-svelte';
	import { addToast } from '$lib/toasts.svelte.js';
	import FormAlert from '$lib/components/FormAlert.svelte';
	import Tip from '$lib/components/Tip.svelte';
	import PaymentForm, { type PaymentFormValues } from './PaymentForm.svelte';
	import { PROVINCES, provinceLabel } from '$lib/income-tax.js';
	import { GST_FREQUENCIES, incomeTaxDates, periodLabel } from '$lib/gst-periods.js';
	import type { GstPeriodStatus } from '$lib/tax-summary.js';
	import type { TaxPayment } from '$lib/types.js';
	import type { PageData, ActionData } from './$types.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	function fmt(amount: number, currency = 'CAD'): string {
		return new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(amount);
	}
	/** "−$12.00" for a deduction, but plain "$0.00" when there's nothing to subtract. */
	function minus(amount: number): string {
		return amount > 0 ? `−${fmt(amount)}` : fmt(0);
	}
	function pct(rate: number): string {
		return `${(Math.round(rate * 1000) / 10).toLocaleString('en-CA')}%`;
	}
	function fmtDate(d: string): string {
		return new Date(d.slice(0, 10) + 'T00:00:00Z').toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
	}

	const s = $derived(data.summary);
	const ts = $derived(data.taxSettings);
	const configured = $derived(Boolean(ts.province) || ts.flatRate > 0);

	// ── Payment form ───────────────────────────────────────────
	let paymentForm = $state<PaymentFormValues | null>(null);
	let paymentKey = $state(0);
	let paymentPanel = $state<HTMLElement | null>(null);
	let deletePayment = $state<TaxPayment | null>(null);

	async function openPayment(values: PaymentFormValues) {
		paymentForm = values;
		paymentKey++;
		await tick();
		paymentPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		paymentPanel?.querySelector<HTMLSelectElement>('select')?.focus();
	}

	function newPayment() {
		if (paymentForm && !paymentForm.id) {
			paymentForm = null;
			return;
		}
		openPayment({ type: 'income_tax', amount: null, payment_date: data.today, period: String(data.year), notes: '' });
	}

	function payPeriod(key: string, balance: number) {
		openPayment({ type: 'gst', amount: balance > 0 ? balance : null, payment_date: data.today, period: key, notes: '' });
	}

	function editPayment(p: TaxPayment) {
		openPayment({ id: p.id, type: p.type, amount: p.amount, payment_date: p.payment_date, period: p.period ?? '', notes: p.notes });
	}

	// ── Settings ───────────────────────────────────────────────
	let settingsOpen = $state(false);
	let settingsProvince = $state('');
	let settingsSaving = $state(false);
	$effect.pre(() => {
		settingsProvince = ts.province;
	});

	// ── Business use of home ───────────────────────────────────
	let homeEditing = $state(false);
	let homeSaving = $state(false);
	const homeConfig = $derived(s?.homeOffice.config ?? null);
	const showHomeForm = $derived(homeEditing || (!homeConfig && (s?.homeOffice.count ?? 0) > 0));
	function num(n: number): string {
		return n.toLocaleString('en-CA', { maximumFractionDigits: 2 });
	}

	// ── Set-aside calculator ───────────────────────────────────
	let received = $state<number | null>(null);
	let receivedTaxRate = $state<number>(5);
	$effect.pre(() => {
		receivedTaxRate = data.defaultTaxPercent;
	});
	const calc = $derived.by(() => {
		const total = received ?? 0;
		const preTax = total / (1 + (receivedTaxRate || 0) / 100);
		const gst = total - preTax;
		const income = preTax * (s?.setAsideRate ?? 0);
		return { preTax, gst, income, setAside: gst + income, keep: total - gst - income };
	});

	// ── Deadlines ──────────────────────────────────────────────
	const itDates = $derived(incomeTaxDates(data.year));
	const deadlines = $derived.by(() => {
		if (!s) return [];
		const list: { date: string; label: string; amount: number; overdue: boolean }[] = [];
		for (const p of s.gst.periods) {
			if (p.status === 'due' || p.status === 'overdue') {
				list.push({ date: p.paymentDue, label: `GST/HST for ${p.label}`, amount: p.balance, overdue: p.status === 'overdue' });
			}
		}
		if (s.incomeTaxBalance > 0 && itDates.balanceDue >= data.today) {
			list.push({ date: itDates.balanceDue, label: `Income tax balance for ${data.year}`, amount: s.incomeTaxBalance, overdue: false });
		}
		return list.sort((a, b) => a.date.localeCompare(b.date));
	});

	const STATUS: Record<GstPeriodStatus, { label: string; style: string }> = {
		open: { label: 'In progress', style: 'background-color: var(--color-muted); color: var(--color-muted-foreground)' },
		refund: { label: 'Refund to claim', style: 'background-color: color-mix(in srgb, var(--color-info) 14%, transparent); color: var(--color-foreground)' },
		nothing_owed: { label: 'Nothing owed', style: 'background-color: var(--color-muted); color: var(--color-muted-foreground)' },
		paid: { label: 'Paid', style: 'background-color: color-mix(in srgb, var(--color-success) 14%, transparent); color: var(--color-success)' },
		due: { label: 'Due', style: 'background-color: color-mix(in srgb, var(--color-warning) 16%, transparent); color: var(--color-foreground)' },
		overdue: { label: 'Overdue', style: 'background-color: color-mix(in srgb, var(--color-destructive) 14%, transparent); color: var(--color-destructive)' }
	};

	const cardStyle = 'background-color: var(--color-card); border-color: var(--color-border)';
	const inputClass = 'w-full rounded-lg border px-3 py-2 text-sm';
	const inputStyle = 'background-color: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)';
</script>

<svelte:head>
	<title>Taxes — {page.data.appName}</title>
</svelte:head>

{#snippet line(label: string, value: string, sub?: string, strong = false)}
	<div class="border-t first:border-t-0 px-5 py-3 flex items-center justify-between gap-4" style="border-color: var(--color-border){strong ? '; background-color: var(--color-accent)' : ''}">
		<div>
			<p class="text-sm {strong ? 'font-semibold' : 'font-medium'}" style="color: var(--color-foreground)">{label}</p>
			{#if sub}<p class="text-xs mt-0.5" style="color: var(--color-muted-foreground)">{sub}</p>{/if}
		</div>
		<p class="text-base tabular-nums whitespace-nowrap {strong ? 'font-bold' : 'font-semibold'}" style="color: var(--color-foreground)">{value}</p>
	</div>
{/snippet}

<div class="max-w-5xl mx-auto">
	<!-- Header -->
	<div class="mb-6 flex items-center justify-between gap-4">
		<div>
			<h2 class="text-2xl font-bold" style="color: var(--color-foreground)">Taxes</h2>
			<p class="mt-1 text-sm" style="color: var(--color-muted-foreground)">
				What you'll owe the CRA for {data.year}, what you've paid, and how much to set aside
			</p>
		</div>
		<button onclick={newPayment} class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 shrink-0"
			style="background-color: var(--color-primary); color: var(--color-primary-foreground)">
			<Plus size={16} aria-hidden="true" />
			Record Payment
		</button>
	</div>

	<!-- Year + settings -->
	<div class="mb-6 flex flex-wrap items-center gap-3">
		<form method="GET" class="flex items-center gap-2">
			<label class="text-sm font-medium" style="color: var(--color-foreground)" for="year-select">Year</label>
			<select id="year-select" name="year" onchange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()}
				class="rounded-lg border px-3 py-1.5 text-sm" style="background-color: var(--color-card); border-color: var(--color-border); color: var(--color-foreground)">
				{#each data.availableYears as y}
					<option value={y} selected={y === data.year}>{y}</option>
				{/each}
			</select>
		</form>
		<p class="text-sm" style="color: var(--color-muted-foreground)">
			{#if ts.province}{provinceLabel(ts.province)}{:else if ts.flatRate > 0}Flat {ts.flatRate}% income tax{:else}Tax setup incomplete{/if}
			· GST/HST filed {GST_FREQUENCIES.find((f) => f.value === ts.gstFrequency)?.label.toLowerCase()}
		</p>
		<button type="button" onclick={() => (settingsOpen = !settingsOpen)} aria-expanded={settingsOpen} aria-controls="tax-settings"
			class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium hover:bg-muted transition-colors"
			style="border-color: var(--color-border); color: var(--color-foreground)">
			<Settings2 size={14} aria-hidden="true" /> Tax setup
		</button>
	</div>

	{#if settingsOpen || (!configured && !data.loadError)}
		<section id="tax-settings" class="mb-6 rounded-xl border p-5" style={cardStyle} aria-labelledby="tax-settings-title">
			<h3 id="tax-settings-title" class="text-base font-semibold mb-1" style="color: var(--color-foreground)">Tax setup</h3>
			<p class="text-sm mb-4" style="color: var(--color-muted-foreground)">
				Pick your province so Yield can estimate income tax with real tax brackets and include CPP contributions.
			</p>
			<FormAlert message={form?.settingsError} class="mb-3" />
			<form method="POST" action="?/saveSettings" class="flex flex-col gap-4"
				use:enhance={() => { settingsSaving = true; return async ({ update, result }) => { settingsSaving = false; await update({ reset: false }); if (result.type === 'success') { settingsOpen = false; addToast('Tax setup saved'); } }; }}>
				<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
					<div>
						<label for="tax-province" class="block text-sm font-medium mb-1" style="color: var(--color-foreground)">Province or territory</label>
						<select id="tax-province" name="tax_province" bind:value={settingsProvince} class={inputClass} style={inputStyle}>
							<option value="">Not set — use a flat rate</option>
							{#each PROVINCES as p}
								<option value={p.value}>{p.label}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="gst-frequency" class="flex items-center text-sm font-medium mb-1" style="color: var(--color-foreground)">
							GST/HST filing <Tip tip="How often CRA has you file GST/HST returns. Most small businesses file annually; check your CRA My Business Account if unsure." />
						</label>
						<select id="gst-frequency" name="gst_filing_frequency" value={ts.gstFrequency} class={inputClass} style={inputStyle}>
							{#each GST_FREQUENCIES as f}
								<option value={f.value}>{f.label}</option>
							{/each}
						</select>
					</div>
					{#if !settingsProvince}
						<div>
							<label for="flat-rate" class="flex items-center text-sm font-medium mb-1" style="color: var(--color-foreground)">
								Flat income tax rate (%) <Tip tip="Used only when no province is set. A single rate is a rough guide — choosing your province is more accurate." />
							</label>
							<input id="flat-rate" name="income_tax_rate" type="number" min="0" max="100" step="0.1" value={ts.flatRate || ''} class="{inputClass} font-mono" style={inputStyle} />
						</div>
					{:else}
						<input type="hidden" name="income_tax_rate" value={ts.flatRate} />
					{/if}
				</div>
				<div class="flex justify-end gap-3">
					{#if configured}
						<button type="button" onclick={() => (settingsOpen = false)} class="px-4 py-2 rounded-lg text-sm font-medium border"
							style="border-color: var(--color-border); color: var(--color-muted-foreground)">Cancel</button>
					{/if}
					<button type="submit" disabled={settingsSaving} class="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
						style="background-color: var(--color-primary); color: var(--color-primary-foreground)">{settingsSaving ? 'Saving…' : 'Save'}</button>
				</div>
			</form>
		</section>
	{/if}

	<!-- Payment form -->
	{#if paymentForm}
		<section bind:this={paymentPanel} class="mb-6 rounded-xl border p-5 scroll-mt-6" style={cardStyle} aria-labelledby="payment-form-title">
			<h3 id="payment-form-title" class="text-base font-semibold mb-4" style="color: var(--color-foreground)">
				{paymentForm.id ? 'Edit Payment' : 'Record a Payment'}
			</h3>
			{#key paymentKey}
				<PaymentForm
					values={paymentForm}
					year={data.year}
					gstFrequency={ts.gstFrequency}
					error={paymentForm.id ? form?.updateError : form?.createError}
					onCancel={() => (paymentForm = null)}
					onSaved={() => { addToast(paymentForm?.id ? 'Payment updated' : 'Payment recorded'); paymentForm = null; }}
				/>
			{/key}
		</section>
	{/if}

	{#if data.loadError || !s}
		<!-- Fail loudly: never show $0 liabilities when the data couldn't be loaded -->
		<div class="rounded-xl border p-8 text-center mb-6" style="background-color: var(--color-card); border-color: var(--color-destructive)">
			<AlertTriangle size={28} class="mx-auto mb-3" style="color: var(--color-destructive)" aria-hidden="true" />
			<p class="text-sm font-semibold mb-1" style="color: var(--color-foreground)">Tax data unavailable</p>
			<p class="text-sm" style="color: var(--color-muted-foreground)">{data.loadError}</p>
			<p class="text-xs mt-2" style="color: var(--color-muted-foreground)">The numbers on this page are hidden rather than shown as $0 — retry once the database is reachable.</p>
		</div>
	{:else}

	<!-- Foreign-currency revenue -->
	{#if s.foreignRevenue.length > 0}
		<section class="rounded-xl border mb-6 overflow-hidden" style="background-color: var(--color-card); border-color: {s.missingRates.length ? 'var(--color-warning)' : 'var(--color-border)'}" aria-labelledby="fx-title">
			<div class="px-5 py-3 border-b flex items-center gap-2" style="border-color: var(--color-border)">
				<Globe size={15} style="color: var(--color-primary)" aria-hidden="true" />
				<h3 id="fx-title" class="font-semibold text-sm" style="color: var(--color-foreground)">Revenue in other currencies</h3>
			</div>
			<div class="px-5 py-3 text-sm" style="color: var(--color-muted-foreground)">
				{#if s.missingRates.length}
					<p class="flex items-start gap-2 mb-3" style="color: var(--color-foreground)">
						<AlertTriangle size={15} class="mt-0.5 shrink-0" style="color: var(--color-warning)" aria-hidden="true" />
						<span><strong>Not yet in your income tax estimate.</strong> Enter an exchange rate below so this income is counted — it's taxable even though it isn't in Canadian dollars.</span>
					</p>
				{/if}
				<p class="mb-3">
					Income tax counts foreign income in Canadian dollars. Using the Bank of Canada's
					<a href="https://www.bankofcanada.ca/rates/exchange/annual-average-exchange-rates/" target="_blank" rel="noopener" class="underline" style="color: var(--color-primary)">annual average exchange rate</a>
					is accepted by the CRA. No GST/HST is charged on services exported to clients outside Canada, so this revenue never affects GST/HST.
				</p>
				<FormAlert message={form?.fxError} class="mb-3" />
				<div class="flex flex-col gap-2">
					{#each s.foreignRevenue as f (f.currency)}
						<form method="POST" action="?/saveFxRate" class="flex flex-wrap items-end gap-3"
							use:enhance={() => async ({ update, result }) => { await update({ reset: false }); if (result.type === 'success') addToast(`${f.currency} rate saved`); }}>
							<input type="hidden" name="year" value={data.year} />
							<input type="hidden" name="currency" value={f.currency} />
							<p class="min-w-40 font-mono" style="color: var(--color-foreground)">{fmt(f.amount, f.currency)}</p>
							<div>
								<label for="fx-{f.currency}" class="block text-xs font-medium mb-1">CAD per 1 {f.currency} ({data.year} average)</label>
								<input id="fx-{f.currency}" name="rate" type="number" min="0.0001" step="0.0001" value={f.rate ?? ''} placeholder="e.g. 1.3700"
									class="w-36 rounded-lg border px-3 py-1.5 text-sm font-mono" style={inputStyle} />
							</div>
							<button type="submit" class="px-3 py-1.5 rounded-lg border text-sm font-medium hover:bg-muted transition-colors"
								style="border-color: var(--color-border); color: var(--color-foreground)">Save rate</button>
							<p class="font-mono" style="color: var(--color-foreground)">{f.cad !== null ? `= ${fmt(f.cad)}` : '— not counted yet'}</p>
						</form>
					{/each}
				</div>
			</div>
		</section>
	{/if}

	<!-- At a glance -->
	<div class="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 mb-6">
		<div class="rounded-xl border p-4" style={cardStyle}>
			<p class="text-xs font-medium uppercase tracking-wide mb-1" style="color: var(--color-muted-foreground)">Still owed for {data.year}</p>
			<p class="text-xl font-bold" style="color: var(--color-foreground)">{fmt(s.incomeTaxBalance + s.gst.balance)}</p>
			<p class="text-xs mt-0.5" style="color: var(--color-muted-foreground)">
				{fmt(s.incomeTaxBalance)} income tax{s.incomeTax.pensionPlan ? ` & ${s.incomeTax.pensionPlan}` : ''} · {fmt(s.gst.balance)} GST/HST
			</p>
		</div>
		<div class="rounded-xl border p-4" style={cardStyle}>
			<p class="text-xs font-medium uppercase tracking-wide mb-1 inline-flex items-center" style="color: var(--color-muted-foreground)">
				Set aside per invoice <Tip tip="Based on this year's numbers so far: your estimated income tax{s.incomeTax.pensionPlan ? ` and ${s.incomeTax.pensionPlan}` : ''} as a share of what you've invoiced. GST/HST you charge was never yours, so set all of it aside too." />
			</p>
			{#if s.incomeTax.method === 'none'}
				<p class="text-sm mt-1" style="color: var(--color-muted-foreground)">Finish your <button type="button" class="underline" style="color: var(--color-primary)" onclick={() => (settingsOpen = true)}>tax setup</button> to see this.</p>
			{:else}
				<p class="text-xl font-bold" style="color: var(--color-primary)">{pct(s.setAsideRate)}</p>
				<p class="text-xs mt-0.5" style="color: var(--color-muted-foreground)">of each invoice before tax, plus all GST/HST charged</p>
			{/if}
		</div>
		<div class="rounded-xl border p-4" style={cardStyle}>
			<p class="text-xs font-medium uppercase tracking-wide mb-1" style="color: var(--color-muted-foreground)">Next deadline</p>
			{#if deadlines.length}
				<p class="text-xl font-bold" style="color: {deadlines[0].overdue ? 'var(--color-destructive)' : 'var(--color-foreground)'}">
					{deadlines[0].overdue ? 'Overdue' : fmtDate(deadlines[0].date)}
				</p>
				<p class="text-xs mt-0.5" style="color: var(--color-muted-foreground)">{deadlines[0].label} · {fmt(deadlines[0].amount)}{deadlines[0].overdue ? ` (was due ${fmtDate(deadlines[0].date)})` : ''}</p>
			{:else}
				<p class="text-xl font-bold" style="color: var(--color-foreground)">Nothing due</p>
				<p class="text-xs mt-0.5" style="color: var(--color-muted-foreground)">No unpaid balances for {data.year}</p>
			{/if}
		</div>
	</div>

	<!-- Tax position -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
		<!-- Income tax -->
		<section class="rounded-xl border overflow-hidden" style={cardStyle} aria-labelledby="it-title">
			<div class="px-5 py-3 border-b flex items-center gap-2" style="border-color: var(--color-border)">
				<Calculator size={15} style="color: var(--color-primary)" aria-hidden="true" />
				<h3 id="it-title" class="font-semibold text-sm" style="color: var(--color-foreground)">
					Income tax{s.incomeTax.pensionPlan ? ` & ${s.incomeTax.pensionPlan}` : ''} — {data.year}
				</h3>
				<span class="ml-auto text-xs" style="color: var(--color-muted-foreground)">Estimate</span>
			</div>
			<div>
				{@render line('Revenue', fmt(s.revenue), `Invoiced in ${data.year}, before GST/HST${s.revenue !== s.cadRevenue ? ` — includes ${fmt(s.revenue - s.cadRevenue)} converted from other currencies` : ''}`)}
				{@render line('Deductible expenses', minus(s.otherDeductible), 'Business-use share, meals at 50%')}
				{#if s.homeOffice.count > 0 || s.homeOffice.carryforwardIn > 0}
					{@render line('Business use of home', minus(s.homeOffice.deductible), s.homeOffice.carriedForward > 0 ? `Limited to your income — ${fmt(s.homeOffice.carriedForward)} carries forward` : 'Workspace share of home costs — see below')}
				{/if}
				{@render line('Net business income', fmt(s.netIncome), 'What you pay tax on (your profit)')}
				{#if s.incomeTax.method === 'brackets'}
					{@render line(`${s.incomeTax.pensionPlan} contributions`, fmt(s.incomeTax.pension), `Self-employed pay both the employee and employer share`)}
					{@render line('Income tax', fmt(s.incomeTax.incomeTax), `Federal ${fmt(s.incomeTax.federalTax)} + ${provinceLabel(s.incomeTax.province ?? '')} ${fmt(s.incomeTax.provincialTax)}, after the basic personal amount`)}
					{@render line('Total to pay', fmt(s.incomeTax.total), `${pct(s.incomeTax.effectiveRate)} of your profit · each extra $100 earned costs about ${fmt(s.incomeTax.marginalRate * 100)} in tax`)}
				{:else if s.incomeTax.method === 'flat'}
					{@render line('Estimated income tax', fmt(s.incomeTax.total), `Flat ${ts.flatRate}% of net income — doesn't include CPP. Set your province for a closer estimate.`)}
				{:else}
					<div class="border-t px-5 py-4 text-sm" style="border-color: var(--color-border); color: var(--color-muted-foreground)">
						Set your province in <button type="button" class="underline" style="color: var(--color-primary)" onclick={() => (settingsOpen = true)}>Tax setup</button> to estimate what you'll owe.
					</div>
				{/if}
				{@render line('Paid to CRA', minus(s.incomeTaxPaid), 'Income tax payments recorded for this year')}
				{@render line('Balance remaining', fmt(s.incomeTaxBalance), `Due ${fmtDate(itDates.balanceDue)} · return due ${fmtDate(itDates.filingDue)}`, true)}
			</div>
			{#if s.incomeTax.method === 'brackets' && s.incomeTax.tableYear !== data.year}
				<p class="px-5 py-2 text-xs border-t" style="border-color: var(--color-border); color: var(--color-muted-foreground)">
					Using {s.incomeTax.tableYear} tax brackets — {data.year} rates aren't built in yet.
				</p>
			{/if}
		</section>

		<!-- GST/HST -->
		<section class="rounded-xl border overflow-hidden" style={cardStyle} aria-labelledby="gst-title">
			<div class="px-5 py-3 border-b flex items-center gap-2" style="border-color: var(--color-border)">
				<Receipt size={15} style="color: var(--color-primary)" aria-hidden="true" />
				<h3 id="gst-title" class="font-semibold text-sm" style="color: var(--color-foreground)">GST/HST — {data.year}</h3>
			</div>
			<div>
				{@render line('Collected from clients', fmt(s.gst.collected), 'GST/HST charged on your invoices — held for the CRA')}
				{@render line('Input tax credits', minus(s.gst.itc), 'GST/HST you paid on business expenses')}
				{#if s.gst.net < 0}
					{@render line('Refund owed to you', fmt(-s.gst.net), 'You paid more GST/HST than you collected — claim it when you file')}
				{:else}
					{@render line('Net to remit', fmt(s.gst.net), 'Collected minus credits')}
				{/if}
				{@render line('Remitted to CRA', minus(s.gst.paid), 'GST/HST payments recorded for this year')}
				{@render line('Balance remaining', fmt(s.gst.balance), 'Estimated still owed', true)}
			</div>
		</section>
	</div>

	<!-- Business use of home (T2125 Part 7) -->
	<section id="home-office" class="rounded-xl border overflow-hidden mb-6 scroll-mt-6" style={cardStyle} aria-labelledby="home-title">
		<div class="px-5 py-3 border-b flex items-center gap-2" style="border-color: var(--color-border)">
			<House size={15} style="color: var(--color-primary)" aria-hidden="true" />
			<h3 id="home-title" class="font-semibold text-sm" style="color: var(--color-foreground)">Business use of home — {data.year}</h3>
			{#if homeConfig && !homeEditing}
				<button type="button" onclick={() => (homeEditing = true)} class="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium hover:bg-muted transition-colors"
					style="border-color: var(--color-border); color: var(--color-foreground)">
					<Pencil size={12} aria-hidden="true" /> Edit workspace
				</button>
			{:else}
				<span class="text-xs ml-auto" style="color: var(--color-muted-foreground)">T2125 Part 7, line 9945</span>
			{/if}
		</div>

		{#if showHomeForm}
			<div class="px-5 py-4 border-b" style="border-color: var(--color-border)">
				<p class="text-sm mb-3" style="color: var(--color-muted-foreground)">
					If you work from home, part of your home's costs is deductible: your workspace's share of the home, times how much of the time it's used for business.
					It qualifies if it's your main place of business, or you use it only for work and regularly meet clients there.
				</p>
				<FormAlert message={form?.homeError} class="mb-3" />
				<form method="POST" action="?/saveHomeOffice" class="flex flex-col gap-4"
					use:enhance={() => { homeSaving = true; return async ({ update, result }) => { homeSaving = false; await update({ reset: false }); if (result.type === 'success') { homeEditing = false; addToast('Home office saved'); } }; }}>
					<input type="hidden" name="year" value={data.year} />
					<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
						<div>
							<label for="home-area" class="flex items-center text-sm font-medium mb-1" style="color: var(--color-foreground)">
								Area of the home <Tip tip="Total area or number of rooms in the home. Use the same unit (sq ft, m² or rooms) for both areas." />
							</label>
							<input id="home-area" name="home_area" type="number" min="0.01" step="any" value={data.homePrefill?.home_area ?? ''} placeholder="e.g. 1475" class="{inputClass} font-mono" style={inputStyle} />
						</div>
						<div>
							<label for="workspace-area" class="block text-sm font-medium mb-1" style="color: var(--color-foreground)">Area of the workspace</label>
							<input id="workspace-area" name="workspace_area" type="number" min="0.01" step="any" value={data.homePrefill?.workspace_area ?? ''} placeholder="e.g. 306" class="{inputClass} font-mono" style={inputStyle} />
						</div>
						<div>
							<label for="business-time" class="flex items-center text-sm font-medium mb-1" style="color: var(--color-foreground)">
								Business use of workspace (%) <Tip tip="If the space is also used personally (a guest room, the kitchen table), the share of time it's used for business. 100 if it's only for work." />
							</label>
							<input id="business-time" name="business_time_percent" type="number" min="1" max="100" step="any" value={data.homePrefill?.business_time_percent ?? 100} class="{inputClass} font-mono" style={inputStyle} />
						</div>
						<div>
							<label for="home-carry" class="flex items-center text-sm font-medium mb-1" style="color: var(--color-foreground)">
								Carried from {data.year - 1} ($) <Tip tip="Home office costs you couldn't deduct last year because they would have created a loss. Usually 0 — it's on last year's form as the amount carried forward." />
							</label>
							<input id="home-carry" name="carryforward" type="number" min="0" step="0.01" value={data.homePrefill?.carryforward || ''} placeholder="0.00" class="{inputClass} font-mono" style={inputStyle} />
						</div>
					</div>
					{#if !homeConfig && data.homePrefill}
						<p class="text-xs" style="color: var(--color-muted-foreground)">Filled in from {data.year - 1} — save to use it for {data.year}.</p>
					{/if}
					<div class="flex justify-end gap-3">
						{#if homeEditing}
							<button type="button" onclick={() => (homeEditing = false)} class="px-4 py-2 rounded-lg text-sm font-medium border"
								style="border-color: var(--color-border); color: var(--color-muted-foreground)">Cancel</button>
						{/if}
						<button type="submit" disabled={homeSaving} class="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
							style="background-color: var(--color-primary); color: var(--color-primary-foreground)">{homeSaving ? 'Saving…' : 'Save workspace'}</button>
					</div>
				</form>
			</div>
		{:else if !homeConfig}
			<div class="px-5 py-4 flex flex-wrap items-center gap-3 text-sm" style="color: var(--color-muted-foreground)">
				<p class="grow">Work from home? Part of your heat, hydro, home insurance, mortgage interest and property tax is deductible.</p>
				<button type="button" onclick={() => (homeEditing = true)} class="px-3 py-1.5 rounded-lg border text-sm font-medium hover:bg-muted transition-colors"
					style="border-color: var(--color-border); color: var(--color-foreground)">Set up home office</button>
			</div>
		{/if}

		{#if homeConfig && !homeEditing}
			<p class="px-5 py-3 text-sm border-b" style="border-color: var(--color-border); color: var(--color-muted-foreground)">
				Workspace share: {num(homeConfig.workspace_area)} of {num(homeConfig.home_area)}{homeConfig.business_time_percent < 100 ? `, used ${num(homeConfig.business_time_percent)}% for business` : ''}
				= <strong style="color: var(--color-foreground)">{num(Math.round((s.homeOffice.share ?? 0) * 10000) / 100)}%</strong> of home costs.
			</p>
		{/if}

		{#if s.phoneDoubleCountRisk}
			<p class="px-5 py-3 text-sm flex items-start gap-2 border-b" style="border-color: var(--color-border); color: var(--color-foreground)">
				<AlertTriangle size={15} class="mt-0.5 shrink-0" style="color: var(--color-warning)" aria-hidden="true" />
				<span>Phone or internet appears both here and under "Phone & internet" expenses. Make sure the same bill isn't counted twice.</span>
			</p>
		{/if}

		{#if s.homeOffice.count > 0 || s.homeOffice.carryforwardIn > 0}
			<div class="relative overflow-x-auto">
				<table class="w-full text-sm min-w-120">
					<caption class="sr-only">Business-use-of-home expenses for {data.year}</caption>
					<tbody>
						{#each s.homeOffice.lines as l (l.type)}
							<tr class="border-t first:border-t-0" style="border-color: var(--color-border)">
								<th scope="row" class="text-left px-5 py-2 font-normal" style="color: var(--color-foreground)">
									{l.label}
									{#if l.type === 'other' && l.descriptions.length}<span class="block text-xs" style="color: var(--color-muted-foreground)">{l.descriptions.join(', ')}</span>{/if}
								</th>
								<td class="px-5 py-2 text-right font-mono" style="color: {l.amount ? 'var(--color-foreground)' : 'var(--color-muted-foreground)'}">{l.amount ? fmt(l.amount) : '—'}</td>
							</tr>
						{/each}
						<tr class="border-t font-medium" style="border-color: var(--color-border); background-color: var(--color-accent)">
							<th scope="row" class="text-left px-5 py-2" style="color: var(--color-foreground)">Subtotal</th>
							<td class="px-5 py-2 text-right font-mono" style="color: var(--color-foreground)">{fmt(s.homeOffice.subtotal)}</td>
						</tr>
						<tr class="border-t" style="border-color: var(--color-border)">
							<th scope="row" class="text-left px-5 py-2 font-normal" style="color: var(--color-foreground)">Less: personal use part</th>
							<td class="px-5 py-2 text-right font-mono" style="color: var(--color-muted-foreground)">{minus(s.homeOffice.personalPart)}</td>
						</tr>
						<tr class="border-t font-medium" style="border-color: var(--color-border)">
							<th scope="row" class="text-left px-5 py-2" style="color: var(--color-foreground)">
								Business part
								{#if !homeConfig}<span class="block text-xs font-normal" style="color: var(--color-muted-foreground)">Using each expense's business-use % until the workspace is set up</span>{/if}
							</th>
							<td class="px-5 py-2 text-right font-mono" style="color: var(--color-foreground)">{fmt(s.homeOffice.businessPart)}</td>
						</tr>
						{#if s.homeOffice.carryforwardIn > 0}
							<tr class="border-t" style="border-color: var(--color-border)">
								<th scope="row" class="text-left px-5 py-2 font-normal" style="color: var(--color-foreground)">Plus: carried forward from {data.year - 1}</th>
								<td class="px-5 py-2 text-right font-mono" style="color: var(--color-foreground)">{fmt(s.homeOffice.carryforwardIn)}</td>
							</tr>
						{/if}
						{#if s.homeOffice.carriedForward > 0}
							<tr class="border-t" style="border-color: var(--color-border)">
								<th scope="row" class="text-left px-5 py-2 font-normal" style="color: var(--color-foreground)">
									Limited to net income
									<span class="block text-xs" style="color: var(--color-muted-foreground)">Home office costs can't create or increase a business loss</span>
								</th>
								<td class="px-5 py-2 text-right font-mono" style="color: var(--color-foreground)">{fmt(s.homeOffice.limit)}</td>
							</tr>
						{/if}
						<tr class="border-t font-semibold" style="border-color: var(--color-border); background-color: var(--color-accent)">
							<th scope="row" class="text-left px-5 py-2.5" style="color: var(--color-foreground)">Deductible this year <span class="font-normal text-xs" style="color: var(--color-muted-foreground)">(line 9945)</span></th>
							<td class="px-5 py-2.5 text-right font-mono" style="color: var(--color-foreground)">{fmt(s.homeOffice.deductible)}</td>
						</tr>
						{#if s.homeOffice.carriedForward > 0}
							<tr class="border-t" style="border-color: var(--color-border)">
								<th scope="row" class="text-left px-5 py-2.5 font-normal" style="color: var(--color-foreground)">Carried forward to {data.year + 1}</th>
								<td class="px-5 py-2.5 text-right">
									<form method="POST" action="?/carryHomeOfficeForward" class="inline-flex items-center gap-3"
										use:enhance={() => async ({ update, result }) => { await update({ reset: false }); if (result.type === 'success') addToast(`Carried into ${data.year + 1}`); }}>
										<input type="hidden" name="year" value={data.year} />
										<input type="hidden" name="amount" value={s.homeOffice.carriedForward} />
										<span class="font-mono" style="color: var(--color-foreground)">{fmt(s.homeOffice.carriedForward)}</span>
										{#if homeConfig}
											<button type="submit" class="px-2.5 py-1 rounded-lg border text-xs font-medium hover:bg-muted transition-colors"
												style="border-color: var(--color-border); color: var(--color-foreground)">Carry into {data.year + 1}</button>
										{/if}
									</form>
								</td>
							</tr>
						{/if}
					</tbody>
				</table>
			</div>
		{:else if homeConfig}
			<p class="px-5 py-4 text-sm" style="color: var(--color-muted-foreground)">
				No home costs logged for {data.year} yet. Add them on <a href="/expenses" class="underline" style="color: var(--color-primary)">Expenses</a> under "Business use of home" at their full amount — Yield applies your share.
			</p>
		{/if}
	</section>

	<!-- GST/HST filing periods -->
	<section class="rounded-xl border overflow-hidden mb-6" style={cardStyle} aria-labelledby="periods-title">
		<div class="px-5 py-3 border-b flex items-center gap-2" style="border-color: var(--color-border)">
			<CalendarClock size={15} style="color: var(--color-primary)" aria-hidden="true" />
			<h3 id="periods-title" class="font-semibold text-sm" style="color: var(--color-foreground)">GST/HST returns — {data.year}</h3>
			<span class="text-xs ml-auto" style="color: var(--color-muted-foreground)">The numbers to enter when you file</span>
		</div>
		<div class="relative overflow-x-auto">
			<table class="w-full text-sm min-w-160">
				<thead>
					<tr style="background-color: var(--color-accent)">
						<th scope="col" class="text-left px-4 py-2.5 font-medium" style="color: var(--color-muted-foreground)">Period</th>
						<th scope="col" class="text-right px-4 py-2.5 font-medium" style="color: var(--color-muted-foreground)">Collected</th>
						<th scope="col" class="text-right px-4 py-2.5 font-medium" style="color: var(--color-muted-foreground)">Credits (ITCs)</th>
						<th scope="col" class="text-right px-4 py-2.5 font-medium" style="color: var(--color-muted-foreground)">Net tax</th>
						<th scope="col" class="text-left px-4 py-2.5 font-medium" style="color: var(--color-muted-foreground)">Pay by</th>
						<th scope="col" class="text-left px-4 py-2.5 font-medium" style="color: var(--color-muted-foreground)">Status</th>
						<th scope="col" class="px-4 py-2.5"><span class="sr-only">Actions</span></th>
					</tr>
				</thead>
				<tbody>
					{#each s.gst.periods as p (p.key)}
						<tr class="border-t" style="border-color: var(--color-border)">
							<th scope="row" class="text-left px-4 py-2.5 font-medium whitespace-nowrap" style="color: var(--color-foreground)">{p.label}</th>
							<td class="px-4 py-2.5 text-right font-mono" style="color: var(--color-foreground)">{fmt(p.collected)}</td>
							<td class="px-4 py-2.5 text-right font-mono" style="color: var(--color-muted-foreground)">{minus(p.itc)}</td>
							<td class="px-4 py-2.5 text-right font-mono font-semibold" style="color: var(--color-foreground)">{fmt(p.net)}</td>
							<td class="px-4 py-2.5 whitespace-nowrap" style="color: var(--color-foreground)">
								{fmtDate(p.paymentDue)}
								{#if p.filingDue !== p.paymentDue}<span class="block text-xs" style="color: var(--color-muted-foreground)">file by {fmtDate(p.filingDue)}</span>{/if}
							</td>
							<td class="px-4 py-2.5">
								<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={STATUS[p.status].style}>{STATUS[p.status].label}</span>
								{#if p.paid > 0 && p.status !== 'paid'}<span class="block text-xs mt-0.5" style="color: var(--color-muted-foreground)">{fmt(p.paid)} paid</span>{/if}
							</td>
							<td class="px-4 py-2.5 text-right">
								{#if p.status === 'due' || p.status === 'overdue'}
									<button type="button" onclick={() => payPeriod(p.key, p.balance)} class="px-2.5 py-1 rounded-lg border text-xs font-medium hover:bg-muted transition-colors whitespace-nowrap"
										style="border-color: var(--color-border); color: var(--color-foreground)" aria-label="Record GST/HST payment for {p.label}">Record payment</button>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		{#if s.gst.unassignedPaid > 0}
			<p class="px-5 py-2 text-xs border-t" style="border-color: var(--color-border); color: var(--color-muted-foreground)">
				{fmt(s.gst.unassignedPaid)} of GST/HST payments aren't linked to a period. Edit them below and choose "Pays for" to mark periods as paid.
			</p>
		{/if}
	</section>

	<!-- Set-aside calculator -->
	{#if s.incomeTax.method !== 'none'}
		<section class="rounded-xl border p-5 mb-6" style={cardStyle} aria-labelledby="calc-title">
			<div class="flex items-center gap-2 mb-3">
				<PiggyBank size={15} style="color: var(--color-primary)" aria-hidden="true" />
				<h3 id="calc-title" class="font-semibold text-sm" style="color: var(--color-foreground)">Just got paid? How much to set aside</h3>
			</div>
			<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
				<div>
					<label for="calc-received" class="block text-sm font-medium mb-1" style="color: var(--color-foreground)">Payment received (incl. GST/HST)</label>
					<input id="calc-received" type="number" min="0" step="0.01" placeholder="0.00" bind:value={received} class="{inputClass} font-mono" style={inputStyle} />
				</div>
				<div>
					<label for="calc-rate" class="block text-sm font-medium mb-1" style="color: var(--color-foreground)">GST/HST rate charged (%)</label>
					<input id="calc-rate" type="number" min="0" max="20" step="0.01" bind:value={receivedTaxRate} class="{inputClass} font-mono" style={inputStyle} />
				</div>
				<div class="rounded-lg px-4 py-2.5" style="background-color: var(--color-accent)" aria-live="polite">
					<p class="text-xs" style="color: var(--color-muted-foreground)">Set aside</p>
					<p class="text-xl font-bold tabular-nums" style="color: var(--color-primary)">{fmt(calc.setAside)}</p>
				</div>
			</div>
			{#if received}
				<p class="text-xs mt-3" style="color: var(--color-muted-foreground)">
					{fmt(calc.gst)} GST/HST + {fmt(calc.income)} for income tax ({pct(s.setAsideRate)} of {fmt(calc.preTax)}). Yours to keep: <strong style="color: var(--color-foreground)">{fmt(calc.keep)}</strong>.
				</p>
			{/if}
		</section>
	{/if}

	<!-- Monthly breakdown -->
	{#if s.months.length > 0}
		<section class="rounded-xl border overflow-hidden mb-6" style={cardStyle} aria-labelledby="months-title">
			<div class="px-5 py-3 border-b flex items-center gap-2" style="border-color: var(--color-border)">
				<CalendarDays size={15} style="color: var(--color-primary)" aria-hidden="true" />
				<h3 id="months-title" class="font-semibold text-sm" style="color: var(--color-foreground)">Month by month — {data.year}</h3>
				<span class="text-xs ml-auto" style="color: var(--color-muted-foreground)">What each month added to your tax bill</span>
			</div>
			<div class="relative overflow-x-auto">
				<table class="w-full text-sm min-w-140">
					<thead>
						<tr style="background-color: var(--color-accent)">
							<th scope="col" class="text-left px-4 py-2.5 font-medium" style="color: var(--color-muted-foreground)">Month</th>
							<th scope="col" class="text-right px-4 py-2.5 font-medium" style="color: var(--color-muted-foreground)">Revenue</th>
							<th scope="col" class="text-right px-4 py-2.5 font-medium" style="color: var(--color-muted-foreground)">Deductible expenses</th>
							<th scope="col" class="text-right px-4 py-2.5 font-medium" style="color: var(--color-muted-foreground)">Net GST/HST</th>
							<th scope="col" class="text-right px-4 py-2.5 font-medium" style="color: var(--color-muted-foreground)">Income tax{s.incomeTax.pensionPlan ? ` & ${s.incomeTax.pensionPlan}` : ''}</th>
							<th scope="col" class="text-right px-4 py-2.5 font-medium" style="color: var(--color-muted-foreground)">Set aside</th>
						</tr>
					</thead>
					<tbody>
						{#each s.months as row, i}
							<tr class="border-t" style="border-color: var(--color-border); background-color: {i % 2 === 1 ? 'var(--color-accent)' : 'var(--color-card)'}">
								<th scope="row" class="text-left px-4 py-2.5 font-medium" style="color: var(--color-foreground)">{row.label}</th>
								<td class="px-4 py-2.5 text-right font-mono" style="color: var(--color-foreground)">{fmt(row.revenue)}</td>
								<td class="px-4 py-2.5 text-right font-mono" style="color: var(--color-muted-foreground)">{row.expenses ? minus(row.expenses) : '—'}</td>
								<td class="px-4 py-2.5 text-right font-mono" style="color: var(--color-foreground)">{fmt(row.netGst)}</td>
								<td class="px-4 py-2.5 text-right font-mono" style="color: {row.estIncomeTax < 0 ? 'var(--color-muted-foreground)' : 'var(--color-foreground)'}">{fmt(row.estIncomeTax)}</td>
								<td class="px-4 py-2.5 text-right font-mono font-semibold" style="color: var(--color-foreground)">{fmt(row.netGst + row.estIncomeTax)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/if}

	<!-- Payments list -->
	<section aria-labelledby="payments-title" class="mb-6">
		<h3 id="payments-title" class="text-base font-semibold mb-3 flex items-center gap-2" style="color: var(--color-foreground)">
			<Landmark size={16} style="color: var(--color-primary)" aria-hidden="true" /> Payments to CRA
		</h3>
		{#if data.payments.length === 0}
			<div class="rounded-xl border p-10 text-center" style={cardStyle}>
				<p class="text-sm font-medium" style="color: var(--color-foreground)">No payments recorded for {data.year}</p>
				<p class="text-xs mt-1" style="color: var(--color-muted-foreground)">Use "Record Payment" whenever you pay the CRA, so the balances above stay accurate.</p>
			</div>
		{:else}
			<div class="rounded-xl border overflow-hidden" style="border-color: var(--color-border)">
				<div class="relative overflow-x-auto">
					<table class="w-full text-sm min-w-140">
						<thead>
							<tr style="background-color: var(--color-accent)">
								<th scope="col" class="text-left px-4 py-3 font-medium" style="color: var(--color-muted-foreground)">Date</th>
								<th scope="col" class="text-left px-4 py-3 font-medium" style="color: var(--color-muted-foreground)">Type</th>
								<th scope="col" class="text-left px-4 py-3 font-medium" style="color: var(--color-muted-foreground)">Pays for</th>
								<th scope="col" class="text-right px-4 py-3 font-medium" style="color: var(--color-muted-foreground)">Amount</th>
								<th scope="col" class="text-left px-4 py-3 font-medium" style="color: var(--color-muted-foreground)">Notes</th>
								<th scope="col" class="px-4 py-3"><span class="sr-only">Actions</span></th>
							</tr>
						</thead>
						<tbody>
							{#each data.payments as payment, i (payment.id)}
								<tr class="border-t" style="border-color: var(--color-border); background-color: {i % 2 === 1 ? 'var(--color-accent)' : 'var(--color-card)'}">
									<td class="px-4 py-3 font-medium whitespace-nowrap" style="color: var(--color-foreground)">{fmtDate(payment.payment_date)}</td>
									<td class="px-4 py-3">
										<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
											style="background-color: color-mix(in srgb, {payment.type === 'income_tax' ? 'var(--color-info)' : 'var(--color-success)'} 14%, transparent); color: var(--color-foreground)">
											{payment.type === 'income_tax' ? 'Income tax' : 'GST / HST'}
										</span>
									</td>
									<td class="px-4 py-3" style="color: {payment.period ? 'var(--color-foreground)' : 'var(--color-muted-foreground)'}">
										{payment.period ? periodLabel(payment.period) : 'Not specified'}
									</td>
									<td class="px-4 py-3 text-right font-mono font-medium" style="color: var(--color-foreground)">{fmt(payment.amount)}</td>
									<td class="px-4 py-3 max-w-xs truncate" style="color: var(--color-muted-foreground)">{payment.notes || '—'}</td>
									<td class="px-4 py-3 text-right whitespace-nowrap">
										<button type="button" class="p-1.5 rounded-md transition-colors hover:opacity-70" style="color: var(--color-muted-foreground)"
											aria-label="Edit payment of {fmt(payment.amount)} on {fmtDate(payment.payment_date)}" title="Edit" onclick={() => editPayment(payment)}>
											<Pencil size={14} aria-hidden="true" />
										</button>
										<button type="button" class="p-1.5 rounded-md transition-colors hover:bg-red-50 hover:text-red-600" style="color: var(--color-muted-foreground)"
											aria-label="Delete payment of {fmt(payment.amount)} on {fmtDate(payment.payment_date)}" title="Delete" onclick={() => (deletePayment = payment)}>
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
	</section>

	<!-- How it works -->
	<details class="rounded-xl border mb-6" style={cardStyle}>
		<summary class="px-5 py-3 flex items-center gap-2 cursor-pointer select-none text-sm font-semibold" style="color: var(--color-foreground)">
			<Info size={15} style="color: var(--color-primary)" aria-hidden="true" /> How these numbers are worked out
		</summary>
		<div class="px-5 pb-4 text-sm space-y-2" style="color: var(--color-muted-foreground)">
			<p><strong style="color: var(--color-foreground)">Revenue</strong> is every non-draft invoice issued in {data.year}, before GST/HST, counted on its issue date whether or not it's been paid. That's how GST/HST is reported and how most sole proprietors report income.</p>
			<p><strong style="color: var(--color-foreground)">Deductible expenses</strong> are the business-use share of each <a href="/expenses?year={data.year}" class="underline" style="color: var(--color-primary)">expense</a>, with meals and entertainment at 50%.</p>
			<p><strong style="color: var(--color-foreground)">Business use of home</strong> takes the full cost of heat, electricity, home insurance, maintenance, mortgage interest, property taxes and rent, and deducts your workspace's share. It's applied after your other expenses and can't take you below zero; anything left over carries forward to next year.</p>
			<p><strong style="color: var(--color-foreground)">Income tax</strong>, with a province set, applies {data.year}'s federal and provincial brackets to your profit after the CPP/QPP deduction, minus the basic personal amount. It assumes this business is your only income and leaves out other credits, RRSP contributions, and some provincial surtaxes and health premiums, so treat it as a planning number. With a flat rate, it's simply profit × that rate.</p>
			<p><strong style="color: var(--color-foreground)">CPP</strong>: self-employed people pay both halves (11.9% on most income, more above the first earnings ceiling). Half of it is deductible.</p>
			<p><strong style="color: var(--color-foreground)">Instalments</strong>: if you owe more than $3,000 (Quebec: $1,800) when you file, the CRA may ask you to prepay next year in instalments due {itDates.instalments.map((d) => fmtDate(d).replace(/,? \d{4}$/, '')).join(', ')}. Record them here as income tax payments for that year.</p>
		</div>
	</details>

	{/if}<!-- /loadError else -->
</div>

<!-- Delete payment confirmation -->
{#if deletePayment}
	<div class="fixed inset-0 z-50 flex items-center justify-center" style="background: rgba(0,0,0,0.4)">
		<div role="alertdialog" aria-modal="true" aria-labelledby="del-pay-title" class="rounded-xl border shadow-xl p-5 max-w-sm w-full mx-4" style="background: var(--color-card); border-color: var(--color-border)">
			<p id="del-pay-title" class="font-semibold mb-1" style="color: var(--color-foreground)">Delete this payment record?</p>
			<p class="text-sm mb-4" style="color: var(--color-muted-foreground)">{fmt(deletePayment.amount)} paid {fmtDate(deletePayment.payment_date)}. This can't be undone.</p>
			<div class="flex gap-2 justify-end">
				<button onclick={() => (deletePayment = null)} class="px-3 py-1.5 rounded-lg border text-sm font-medium hover:bg-muted transition-colors" style="border-color: var(--color-border); color: var(--color-muted-foreground)">Cancel</button>
				<form method="POST" action="?/delete" use:enhance={() => async ({ update, result }) => { deletePayment = null; if (result.type === 'failure') { addToast((result.data as { deleteError?: string })?.deleteError ?? 'Failed to delete payment', 'error'); } else { addToast('Payment deleted'); } await update(); }}>
					<input type="hidden" name="id" value={deletePayment.id} />
					<button type="submit" class="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors">Delete</button>
				</form>
			</div>
		</div>
	</div>
{/if}
