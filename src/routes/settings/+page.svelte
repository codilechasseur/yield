<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { Sun, Moon, Monitor, Check, Lock } from 'lucide-svelte';
	import type { PageData, ActionData } from './$types.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	type Theme = 'light' | 'system' | 'dark';

	let current = $state<Theme>(
		(typeof localStorage !== 'undefined'
			? (localStorage.getItem('yield-theme') as Theme)
			: null) ?? 'system'
	);

	function setTheme(t: Theme) {
		current = t;
		localStorage.setItem('yield-theme', t);
		document.documentElement.setAttribute('data-theme', t);
	}

	const options: { value: Theme; label: string; desc: string; icon: typeof Sun }[] = [
		{ value: 'light', label: 'Light', desc: 'Always use the light theme', icon: Sun },
		{ value: 'system', label: 'System', desc: 'Follow your OS preference', icon: Monitor },
		{ value: 'dark', label: 'Dark', desc: 'Always use the dark theme', icon: Moon }
	];

	// SMTP form state
	let smtpSaving = $state(false);
	let testSending = $state(false);
	let testTo = $state('');
	let showPass = $state(false);

	// Tax form state
	let taxSaving = $state(false);
	let taxPercent = $state<number>(untrack(() => data.smtp?.default_tax_percent ?? 5));

	// Income tax rate state
	let incomeTaxRateSaving = $state(false);
	let incomeTaxRate = $state<number>(untrack(() => data.smtp?.income_tax_rate ?? 0));

	// Security
	let passwordSaving = $state(false);
	let showNewPass = $state(false);
	// Invoice defaults state
	let invoiceDefaultsSaving = $state(false);
	let companyName = $state(untrack(() => data.smtp?.company_name ?? ''));
	let companyAddress = $state(untrack(() => data.smtp?.company_address ?? ''));
	let defaultNotes = $state(untrack(() => data.smtp?.invoice_default_notes ?? ''));
	let invoiceFooter = $state(untrack(() => data.smtp?.invoice_footer ?? ''));

	// Invoice numbering state
	let invoiceNumberingSaving = $state(false);
	let invoiceNumberFormat = $state(untrack(() => data.smtp?.invoice_number_format ?? 'INV-{number}'));
	let invoiceNextNumber = $state<number>(untrack(() => data.smtp?.invoice_next_number ?? 1));

	// Email template state
	let emailTemplateSaving = $state(false);
	let emailSubject = $state(untrack(() => data.smtp?.email_subject ?? ''));
	let emailBody = $state(untrack(() => data.smtp?.email_body ?? ''));

	// Client defaults state
	const currencies = ['CAD', 'USD', 'EUR', 'GBP', 'AUD', 'NZD', 'CHF', 'JPY', 'MXN', 'BRL'];
	let clientDefaultsSaving = $state(false);
	let defaultCurrency = $state(untrack(() => data.smtp?.default_currency ?? 'CAD'));

	// Active tab
	type Tab = 'appearance' | 'invoices' | 'email' | 'security';
	let activeTab = $state<Tab>('appearance');

	const tabs = [
		{ id: 'appearance', label: 'Appearance' },
		{ id: 'invoices',   label: 'Invoices' },
		{ id: 'email',      label: 'Email' },
		{ id: 'security',   label: 'Security & Data' }
	] as const;

	// Data import state
	let importing = $state(false);
	let importOpen = $state(false);
	let resetOpen = $state(false);
	let resetting = $state(false);
	let resetCheck1 = $state(false);
	let resetCheck2 = $state(false);
	let resetCheck3 = $state(false);
	let resetReady = $derived(resetCheck1 && resetCheck2 && resetCheck3);

	// ── Highlight colour ─────────────────────────────────────────────
	const presets = [
		{ label: 'Blue',    hue: 250 },
		{ label: 'Indigo',  hue: 270 },
		{ label: 'Violet',  hue: 285 },
		{ label: 'Rose',    hue: 5   },
		{ label: 'Amber',   hue: 65  },
		{ label: 'Teal',    hue: 195 },
		{ label: 'Emerald', hue: 155 },
		{ label: 'Sky',     hue: 215 }
	];

	let hue = $state<number>(untrack(() =>
		typeof localStorage !== 'undefined'
			? Number(localStorage.getItem('yield-hue') ?? (data.smtp?.brand_hue ?? 250))
			: (data.smtp?.brand_hue ?? 250)
	));

	function setHue(h: number) {
		hue = h;
		localStorage.setItem('yield-hue', String(h));
		document.documentElement.style.setProperty('--hue', String(h));
		// Persist to DB silently so the PDF generator can use it
		fetch('?/saveAppearance', {
			method: 'POST',
			body: new URLSearchParams({ brand_hue: String(h) })
		}).catch(() => {/* ignore */});
	}
</script>

<svelte:head>
	<title>Settings — Yield</title>
</svelte:head>

<div class="max-w-5xl mx-auto">
	<!-- Page header -->
	<div class="mb-6">
		<h2 class="text-2xl font-bold" style="color: var(--color-foreground)">Settings</h2>
		<p class="mt-1 text-sm" style="color: var(--color-muted-foreground)">Manage preferences for Yield.</p>
	</div>

	<!-- Tab nav — dropdown on mobile, tab bar on sm+ -->
	<div class="mb-6 sm:hidden">
		<label for="settings-tab-select" class="sr-only">Settings section</label>
		<select
			id="settings-tab-select"
			value={activeTab}
			onchange={(e) => activeTab = (e.currentTarget as HTMLSelectElement).value as typeof activeTab}
			class="w-full rounded-lg border px-3 py-2 text-sm font-medium"
			style="background-color: var(--color-card); border-color: var(--color-border); color: var(--color-foreground)"
		>
			{#each tabs as tab}
				<option value={tab.id}>{tab.label}</option>
			{/each}
		</select>
	</div>
	<div class="hidden sm:flex gap-1 mb-8 border-b" style="border-color: var(--color-border)">
		{#each tabs as tab}
			<button
				onclick={() => activeTab = tab.id}
				class="px-4 py-2.5 text-sm font-medium transition-colors relative -mb-px border-b-2"
				style={activeTab === tab.id
					? 'border-color: var(--color-primary); color: var(--color-primary)'
					: 'border-color: transparent; color: var(--color-muted-foreground)'}
			>
				{tab.label}
			</button>
		{/each}
	</div>

	<!-- ── APPEARANCE TAB ─────────────────────────────────────────────────── -->
	{#if activeTab === 'appearance'}
	<div class="space-y-6">

		<!-- Theme -->
		<div class="rounded-xl border p-4 md:p-6" style="background-color: var(--color-card); border-color: var(--color-border)">
			<h3 class="font-semibold mb-1" style="color: var(--color-foreground)">Theme</h3>
			<p class="text-sm mb-5" style="color: var(--color-muted-foreground)">Choose how Yield looks to you.</p>

			<div class="grid grid-cols-3 gap-3">
				{#each options as opt}
					{@const active = current === opt.value}
					{@const Icon = opt.icon}
					<button
						onclick={() => setTheme(opt.value)}
						aria-pressed={active}
						class="flex flex-col items-center gap-3 rounded-xl border p-5 text-sm font-medium transition-all"
						style={active
							? 'border-color: var(--color-primary); background-color: var(--color-accent); color: var(--color-primary)'
							: 'border-color: var(--color-border); background-color: var(--color-background); color: var(--color-muted-foreground)'}
					>
						<Icon size={22} aria-hidden="true" />
						<span>{opt.label}</span>
					</button>
				{/each}
			</div>

			<p class="text-xs mt-4" style="color: var(--color-muted-foreground)">
				{options.find(o => o.value === current)?.desc}
			</p>
		</div>

		<!-- Highlight colour -->
		<div class="rounded-xl border p-4 md:p-6" style="background-color: var(--color-card); border-color: var(--color-border)">
			<h3 class="font-semibold mb-1" style="color: var(--color-foreground)">Highlight Colour</h3>
			<p class="text-sm mb-5" style="color: var(--color-muted-foreground)">
				Accent colour used throughout the interface.
			</p>

			<!-- Preset swatches -->
			<div class="flex flex-wrap gap-3 mb-5">
				{#each presets as p}
					{@const active = Math.abs(hue - p.hue) < 8}
					<button
						onclick={() => setHue(p.hue)}
						aria-label={p.label}
						aria-pressed={active}
						class="relative w-9 h-9 rounded-full transition-transform hover:scale-110 focus-visible:outline-none"
						style="background: oklch(0.55 0.24 {p.hue}); box-shadow: {active ? `0 0 0 3px var(--color-card), 0 0 0 5px oklch(0.55 0.24 ${p.hue})` : 'none'}"
					>
						{#if active}
							<Check size={13} class="absolute inset-0 m-auto text-white" strokeWidth={3} aria-hidden="true" />
						{/if}
					</button>
				{/each}
			</div>

			<!-- Custom hue slider -->
			<div class="space-y-2">
				<div class="flex items-center justify-between text-xs font-medium"
					style="color: var(--color-muted-foreground)">
					<span>Custom</span>
					<span class="tabular-nums font-mono">{hue}°</span>
				</div>
				<div class="relative" style="height: 12px">
					<div
						class="absolute inset-0 rounded-full pointer-events-none"
						style="background: linear-gradient(to right, oklch(0.55 0.24 0), oklch(0.55 0.24 60), oklch(0.55 0.24 120), oklch(0.55 0.24 180), oklch(0.55 0.24 240), oklch(0.55 0.24 300), oklch(0.55 0.24 360))"
					></div>
					<input
						type="range" min="0" max="360" step="1" value={hue}
						oninput={(e) => setHue(Number((e.target as HTMLInputElement).value))}
						class="hue-slider absolute inset-0 h-full"
						style="--_thumb: oklch(0.55 0.24 {hue})"
					/>
				</div>
			</div>

			<!-- Live preview strip -->
			<div class="mt-5 flex items-center gap-3 flex-wrap">
				<span class="text-xs font-medium" style="color: var(--color-muted-foreground)">Preview:</span>
				<button class="px-3 py-1.5 rounded-lg text-xs font-medium"
					style="background-color: var(--color-primary); color: var(--color-primary-foreground)">
					Primary
				</button>
				<span class="status-badge status-sent">sent</span>
				<a class="text-xs font-medium" style="color: var(--color-primary)" href="/settings">Link</a>
				<div class="w-6 h-6 rounded-md" style="background-color: var(--color-accent); border: 1px solid var(--color-border)"></div>
			</div>
		</div>

	</div>
	{/if}

	<!-- ── INVOICES TAB ───────────────────────────────────────────────────── -->
	{#if activeTab === 'invoices'}
	<div class="space-y-6">

		<!-- Client Defaults -->
		<div class="rounded-xl border p-4 md:p-6" style="background-color: var(--color-card); border-color: var(--color-border)">
			<h3 class="font-semibold mb-1" style="color: var(--color-foreground)">Client Defaults</h3>
			<p class="text-sm mb-5" style="color: var(--color-muted-foreground)">
				Default values pre-filled when creating a new client.
			</p>

			{#if form?.clientDefaultsSuccess}
				<div role="status" class="mb-4 px-4 py-3 rounded-lg bg-green-50 text-green-700 text-sm">Client defaults saved.</div>
			{/if}
			{#if form?.clientDefaultsError}
				<div role="alert" class="mb-4 px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm">{form.clientDefaultsError}</div>
			{/if}

			<form
				method="POST"
				action="?/saveClientDefaults"
				class="flex items-end gap-4"
				use:enhance={() => {
					clientDefaultsSaving = true;
					return async ({ update }) => {
						clientDefaultsSaving = false;
						await update({ reset: false });
					};
				}}
			>
				<div class="flex flex-col gap-1">
					<label for="default_currency" class="text-xs font-medium" style="color: var(--color-muted-foreground)">Default Currency</label>
					<select
						id="default_currency"
						name="default_currency"
						bind:value={defaultCurrency}
						class="w-36 px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2"
						style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
					>
						{#each currencies as c}
							<option value={c}>{c}</option>
						{/each}
					</select>
				</div>
				<button
					type="submit"
					disabled={clientDefaultsSaving}
					class="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
					style="background-color: var(--color-primary); color: var(--color-primary-foreground)"
				>
					{clientDefaultsSaving ? 'Saving…' : 'Save'}
				</button>
			</form>
		</div>

		<!-- Tax / GST -->
		<div class="rounded-xl border p-4 md:p-6" style="background-color: var(--color-card); border-color: var(--color-border)">
			<h3 class="font-semibold mb-1" style="color: var(--color-foreground)">Tax / GST Default</h3>
			<p class="text-sm mb-5" style="color: var(--color-muted-foreground)">
				Default tax rate applied when creating a new invoice. Existing invoices are not affected.
			</p>

			{#if form?.taxSuccess}
				<div role="status" class="mb-4 px-4 py-3 rounded-lg bg-green-50 text-green-700 text-sm">Tax rate saved.</div>
			{/if}
			{#if form?.taxError}
				<div role="alert" class="mb-4 px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm">{form.taxError}</div>
			{/if}

			<form
				method="POST"
				action="?/saveTax"
				class="flex items-end gap-4"
				use:enhance={() => {
					taxSaving = true;
					return async ({ update }) => {
						taxSaving = false;
						await update({ reset: false });
					};
				}}
			>
				<div class="flex flex-col gap-1">
					<label for="tax-rate" class="text-xs font-medium" style="color: var(--color-muted-foreground)">GST / Tax Rate (%)</label>
					<input
						id="tax-rate"
						name="default_tax_percent"
						type="number"
						min="0"
						max="100"
						step="0.01"
						bind:value={taxPercent}
						class="w-32 px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 font-mono"
						style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
					/>
				</div>
				<button
					type="submit"
					disabled={taxSaving}
					class="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
					style="background-color: var(--color-primary); color: var(--color-primary-foreground)"
				>
					{taxSaving ? 'Saving…' : 'Save'}
				</button>
			</form>
		</div>

		<!-- Income Tax Estimate Rate -->
		<div class="rounded-xl border p-4 md:p-6" style="background-color: var(--color-card); border-color: var(--color-border)">
			<h3 class="font-semibold mb-1" style="color: var(--color-foreground)">Estimated Income Tax Rate</h3>
			<p class="text-sm mb-5" style="color: var(--color-muted-foreground)">
				Your combined federal + provincial effective marginal tax rate (%). Used in the Tax Reports page to estimate personal income tax owed on pre-tax revenue. Not applied to invoices.
			</p>

			{#if form?.incomeTaxRateSuccess}
				<div role="status" class="mb-4 px-4 py-3 rounded-lg bg-green-50 text-green-700 text-sm">Income tax rate saved.</div>
			{/if}
			{#if form?.incomeTaxRateError}
				<div role="alert" class="mb-4 px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm">{form.incomeTaxRateError}</div>
			{/if}

			<form
				method="POST"
				action="?/saveIncomeTaxRate"
				class="flex items-end gap-4"
				use:enhance={() => {
					incomeTaxRateSaving = true;
					return async ({ update }) => {
						incomeTaxRateSaving = false;
						await update({ reset: false });
					};
				}}
			>
				<div class="flex flex-col gap-1">
					<label for="income-tax-rate" class="text-xs font-medium" style="color: var(--color-muted-foreground)">Effective Income Tax Rate (%)</label>
					<input
						id="income-tax-rate"
						name="income_tax_rate"
						type="number"
						min="0"
						max="100"
						step="0.1"
						bind:value={incomeTaxRate}
						class="w-32 px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 font-mono"
						style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
					/>
				</div>
				<button
					type="submit"
					disabled={incomeTaxRateSaving}
					class="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
					style="background-color: var(--color-primary); color: var(--color-primary-foreground)"
				>
					{incomeTaxRateSaving ? 'Saving…' : 'Save'}
				</button>
			</form>
		</div>

		<!-- Invoice Defaults -->
		<div class="rounded-xl border p-4 md:p-6" style="background-color: var(--color-card); border-color: var(--color-border)">
			<h3 class="font-semibold mb-1" style="color: var(--color-foreground)">Invoice Defaults</h3>
			<p class="text-sm mb-5" style="color: var(--color-muted-foreground)">Default notes pre-filled on new invoices, and a footer block printed on every PDF (contact info, bank details, payment terms, etc.).</p>

			{#if form?.invoiceDefaultsSuccess}
				<div role="status" class="mb-4 px-4 py-3 rounded-lg bg-green-50 text-green-700 text-sm">Saved.</div>
			{/if}
			{#if form?.invoiceDefaultsError}
				<div role="alert" class="mb-4 px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm">{form.invoiceDefaultsError}</div>
			{/if}

			<form
				method="POST"
				action="?/saveInvoiceDefaults"
				class="space-y-4"
				use:enhance={() => {
					invoiceDefaultsSaving = true;
					return async ({ update }) => {
						invoiceDefaultsSaving = false;
						await update({ reset: false });
					};
				}}
			>
				<div class="flex flex-col gap-1">
					<label for="company-name" class="text-xs font-medium" style="color: var(--color-muted-foreground)">Your Name / Company</label>
					<p class="text-xs mb-1" style="color: var(--color-muted-foreground)">Shown as the sender name on invoice PDFs and emails.</p>
					<input
						id="company-name"
						name="company_name"
						type="text"
						placeholder="e.g. Acme Corp or Jane Smith"
						bind:value={companyName}
						class="w-full px-3 py-2 rounded-lg border text-sm"
						style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
					/>
				</div>
				<div class="flex flex-col gap-1">
					<label for="company-address" class="text-xs font-medium" style="color: var(--color-muted-foreground)">Your Address</label>
					<p class="text-xs mb-1" style="color: var(--color-muted-foreground)">Shown below your name in the invoice PDF header.</p>
					<textarea
						id="company-address"
						name="company_address"
						rows="3"
						placeholder="e.g. 123 Main St&#10;Toronto, ON M5V 1A1"
						bind:value={companyAddress}
						class="w-full px-3 py-2 rounded-lg border text-sm resize-none"
						style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
					></textarea>
				</div>
				<div class="flex flex-col gap-1">
					<label for="default-notes" class="text-xs font-medium" style="color: var(--color-muted-foreground)">Default Notes</label>
					<p class="text-xs mb-1" style="color: var(--color-muted-foreground)">Pre-filled in the Notes field whenever a new invoice is created. Can be edited per-invoice.</p>
					<textarea
						id="default-notes"
						name="invoice_default_notes"
						rows="3"
						placeholder="e.g. Payment due within 30 days. Thank you for your business!"
						bind:value={defaultNotes}
						class="w-full px-3 py-2 rounded-lg border text-sm resize-none"
						style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
					></textarea>
				</div>
				<div class="flex flex-col gap-1">
					<label for="invoice-footer" class="text-xs font-medium" style="color: var(--color-muted-foreground)">Invoice Footer</label>
					<p class="text-xs mb-1" style="color: var(--color-muted-foreground)">Printed on every invoice PDF below the line items — use this for your bank account, e-transfer info, business address, or payment instructions.</p>
					<textarea
						id="invoice-footer"
						name="invoice_footer"
						rows="12"
						placeholder="e.g. E-transfer: you@example.com\nBank: TD Canada Trust · Transit 12345 · Account 678900"
						bind:value={invoiceFooter}
						class="w-full px-3 py-2 rounded-lg border text-sm resize-none font-mono"
						style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
					></textarea>
				</div>
				<div class="flex justify-end">
					<button
						type="submit"
						disabled={invoiceDefaultsSaving}
						class="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
						style="background-color: var(--color-primary); color: var(--color-primary-foreground)"
					>
						{invoiceDefaultsSaving ? 'Saving…' : 'Save'}
					</button>
				</div>
			</form>
		</div>

		<!-- Invoice Numbering -->
		<div class="rounded-xl border p-4 md:p-6" style="background-color: var(--color-card); border-color: var(--color-border)">
			<h3 class="font-semibold mb-1" style="color: var(--color-foreground)">Invoice Numbering</h3>
			<p class="text-sm mb-5" style="color: var(--color-muted-foreground)">
				Set the format for invoice numbers and the next number to use. Use <code class="font-mono text-xs">{'{number}'}</code> as the placeholder — e.g. <code class="font-mono text-xs">INV-{'{number}'}</code> produces <code class="font-mono text-xs">INV-615</code>.
			</p>

			{#if form?.invoiceNumberingSuccess}
				<div role="status" class="mb-4 px-4 py-3 rounded-lg bg-green-50 text-green-700 text-sm">Saved.</div>
			{/if}
			{#if form?.invoiceNumberingError}
				<div role="alert" class="mb-4 px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm">{form.invoiceNumberingError}</div>
			{/if}

			<form
				method="POST"
				action="?/saveInvoiceNumbering"
				class="space-y-4"
				use:enhance={() => {
					invoiceNumberingSaving = true;
					return async ({ update }) => {
						invoiceNumberingSaving = false;
						await update({ reset: false });
					};
				}}
			>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div class="flex flex-col gap-1">
						<label for="invoice-number-format" class="text-xs font-medium" style="color: var(--color-muted-foreground)">Number Format</label>
						<p class="text-xs mb-1" style="color: var(--color-muted-foreground)">Use <code class="font-mono">{'{number}'}</code> where the counter goes.</p>
						<input
							id="invoice-number-format"
							name="invoice_number_format"
							type="text"
							placeholder="INV-{'{number}'}"
							bind:value={invoiceNumberFormat}
							class="w-full px-3 py-2 rounded-lg border text-sm font-mono"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						/>
					</div>
					<div class="flex flex-col gap-1">
						<label for="invoice-next-number" class="text-xs font-medium" style="color: var(--color-muted-foreground)">Next Number</label>
						<p class="text-xs mb-1" style="color: var(--color-muted-foreground)">The counter pre-filled when creating a new invoice. Increments automatically.</p>
						<input
							id="invoice-next-number"
							name="invoice_next_number"
							type="number"
							min="1"
							step="1"
							bind:value={invoiceNextNumber}
							class="w-full px-3 py-2 rounded-lg border text-sm"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						/>
					</div>
				</div>
				<div class="flex items-center gap-3">
					<div class="text-sm px-3 py-1.5 rounded-md" style="background: var(--color-muted); color: var(--color-muted-foreground)">
						Preview: <span class="font-mono font-semibold" style="color: var(--color-foreground)">{(invoiceNumberFormat || 'INV-{number}').replace('{number}', String(invoiceNextNumber || 1))}</span>
					</div>
					<button
						type="submit"
						disabled={invoiceNumberingSaving}
						class="ml-auto px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
						style="background-color: var(--color-primary); color: var(--color-primary-foreground)"
					>
						{invoiceNumberingSaving ? 'Saving…' : 'Save'}
					</button>
				</div>
			</form>
		</div>

	</div>
	{/if}

	<!-- ── EMAIL TAB ──────────────────────────────────────────────────────── -->
	{#if activeTab === 'email'}
	<div class="space-y-6">

		<!-- Email Template -->
		<div class="rounded-xl border p-4 md:p-6" style="background-color: var(--color-card); border-color: var(--color-border)">
			<h3 class="font-semibold mb-1" style="color: var(--color-foreground)">Email Template</h3>
			<p class="text-sm mb-1" style="color: var(--color-muted-foreground)">
				Boilerplate subject line and body used when sending invoices. Leave blank to use the built-in defaults.
			</p>
			<p class="text-xs mb-5" style="color: var(--color-muted-foreground)">
				Available placeholders: <code class="font-mono">{'{invoice_number}'}</code> <code class="font-mono">{'{client_name}'}</code> <code class="font-mono">{'{total}'}</code> <code class="font-mono">{'{due_date}'}</code> <code class="font-mono">{'{issue_date}'}</code> <code class="font-mono">{'{company_name}'}</code>
			</p>

			{#if form?.emailTemplateSuccess}
				<div role="status" class="mb-4 px-4 py-3 rounded-lg bg-green-50 text-green-700 text-sm">Email template saved.</div>
			{/if}
			{#if form?.emailTemplateError}
				<div role="alert" class="mb-4 px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm">{form.emailTemplateError}</div>
			{/if}

			<form
				method="POST"
				action="?/saveEmailTemplate"
				class="space-y-4"
				use:enhance={() => {
					emailTemplateSaving = true;
					return async ({ update }) => {
						emailTemplateSaving = false;
						await update({ reset: false });
					};
				}}
			>
				<div class="flex flex-col gap-1">
					<label for="email-subject" class="text-xs font-medium" style="color: var(--color-muted-foreground)">Subject</label>
					<input
						id="email-subject"
						name="email_subject"
						type="text"
						bind:value={emailSubject}
						placeholder={data.DEFAULT_EMAIL_SUBJECT}
						class="w-full px-3 py-2 rounded-lg border text-sm font-mono"
						style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
					/>
				</div>
				<div class="flex flex-col gap-1">
					<label for="email-body" class="text-xs font-medium" style="color: var(--color-muted-foreground)">Body</label>
					<textarea
						id="email-body"
						name="email_body"
						rows="8"
						bind:value={emailBody}
						placeholder={data.DEFAULT_EMAIL_BODY}
						class="w-full px-3 py-2 rounded-lg border text-sm resize-none font-mono"
						style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
					></textarea>
					<p class="text-xs" style="color: var(--color-muted-foreground)">The body can be edited per-send on the invoice detail page.</p>
				</div>
				<div class="flex justify-end">
					<button
						type="submit"
						disabled={emailTemplateSaving}
						class="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
						style="background-color: var(--color-primary); color: var(--color-primary-foreground)"
					>
						{emailTemplateSaving ? 'Saving…' : 'Save'}
					</button>
				</div>
			</form>
		</div>

		<!-- SMTP -->
		<div class="rounded-xl border p-4 md:p-6" style="background-color: var(--color-card); border-color: var(--color-border)">
			<h3 class="font-semibold mb-1" style="color: var(--color-foreground)">SMTP</h3>
			<p class="text-sm mb-5" style="color: var(--color-muted-foreground)">Configure a third-party SMTP service to send invoices directly to clients.</p>

			{#if form?.success}
				<div role="status" class="mb-4 px-4 py-3 rounded-lg bg-green-50 text-green-700 text-sm">Settings saved.</div>
			{/if}
			{#if form?.error}
				<div role="alert" class="mb-4 px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm">{form.error}</div>
			{/if}

			<form
				method="POST"
				action="?/saveSmtp"
				class="space-y-4"
				use:enhance={() => {
					smtpSaving = true;
					return async ({ update }) => {
						smtpSaving = false;
						await update({ reset: false });
					};
				}}
			>
				<!-- Row 1: host + port -->
				<div class="grid grid-cols-3 gap-3">
					<div class="col-span-2 flex flex-col gap-1">
						<label for="smtp-host" class="text-xs font-medium" style="color: var(--color-muted-foreground)">SMTP Host</label>
						<input
							id="smtp-host"
							name="smtp_host"
							type="text"
							placeholder="smtp.example.com"
							value={data.smtp?.smtp_host ?? ''}
							class="px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						/>
					</div>
					<div class="flex flex-col gap-1">
						<label for="smtp-port" class="text-xs font-medium" style="color: var(--color-muted-foreground)">Port</label>
						<input
							id="smtp-port"
							name="smtp_port"
							type="number"
							min="1"
							max="65535"
							placeholder="587"
							value={data.smtp?.smtp_port ?? 587}
							class="px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 font-mono"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						/>
					</div>
				</div>

				<!-- Row 2: user + pass -->
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<div class="flex flex-col gap-1">
						<label for="smtp-user" class="text-xs font-medium" style="color: var(--color-muted-foreground)">Username / API key</label>
						<input
							id="smtp-user"
							name="smtp_user"
							type="text"
							autocomplete="off"
							placeholder="user@example.com"
							value={data.smtp?.smtp_user ?? ''}
							class="px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						/>
					</div>
					<div class="flex flex-col gap-1">
						<label for="smtp-pass" class="text-xs font-medium" style="color: var(--color-muted-foreground)">Password / Secret</label>
						<div class="relative">
							<input
								id="smtp-pass"
								name="smtp_pass"
								type={showPass ? 'text' : 'password'}
								autocomplete="new-password"
								placeholder="••••••••"
								value={data.smtp?.smtp_pass ?? ''}
								class="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 pr-16"
								style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
							/>
							<button
								type="button"
								onclick={() => (showPass = !showPass)}
								class="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-1.5 py-0.5 rounded"
								style="color: var(--color-muted-foreground)"
							>
								{showPass ? 'Hide' : 'Show'}
							</button>
						</div>
					</div>
				</div>

				<!-- Row 3: from name + from email -->
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<div class="flex flex-col gap-1">
						<label for="smtp-from-name" class="text-xs font-medium" style="color: var(--color-muted-foreground)">From Name</label>
						<input
							id="smtp-from-name"
							name="smtp_from_name"
							type="text"
							placeholder="Your Name or Company"
							value={data.smtp?.smtp_from_name ?? ''}
							class="px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						/>
					</div>
					<div class="flex flex-col gap-1">
						<label for="smtp-from-email" class="text-xs font-medium" style="color: var(--color-muted-foreground)">From Email</label>
						<input
							id="smtp-from-email"
							name="smtp_from_email"
							type="email"
							placeholder="invoices@example.com"
							value={data.smtp?.smtp_from_email ?? ''}
							class="px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						/>
					</div>
				</div>

				<!-- Row 4: SSL toggle -->
				<label class="flex items-center gap-2.5 text-sm cursor-pointer select-none" style="color: var(--color-foreground)">
					<input
						name="smtp_secure"
						type="checkbox"
						checked={data.smtp?.smtp_secure ?? false}
						class="w-4 h-4 rounded"
						style="accent-color: var(--color-primary)"
					/>
					Use SSL/TLS (port 465)
				</label>

				<div class="flex justify-end">
					<button
						type="submit"
						disabled={smtpSaving}
						class="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
						style="background-color: var(--color-primary); color: var(--color-primary-foreground)"
					>
						{smtpSaving ? 'Saving…' : 'Save SMTP settings'}
					</button>
				</div>
			</form>

			<!-- Test form -->
			<div class="mt-6 pt-6 border-t" style="border-color: var(--color-border)">
				<h4 class="text-sm font-semibold mb-1" style="color: var(--color-foreground)">Send a test email</h4>
				<p class="text-xs mb-3" style="color: var(--color-muted-foreground)">Save your settings first, then enter an address to verify delivery.</p>

				{#if form?.testSuccess}
					<div class="mb-3 px-4 py-2 rounded-lg bg-green-50 text-green-700 text-sm">Test email sent!</div>
				{/if}
				{#if form?.testError}
					<div class="mb-3 px-4 py-2 rounded-lg bg-red-50 text-red-700 text-sm">{form.testError}</div>
				{/if}

				<form
					method="POST"
					action="?/testSmtp"
					class="flex gap-2"
					use:enhance={() => {
						testSending = true;
						return async ({ update }) => {
							testSending = false;
							await update({ reset: false });
						};
					}}
				>
					<input
						name="test_to"
						type="email"
						placeholder="you@example.com"
						bind:value={testTo}
						class="flex-1 px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2"
						style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
					/>
					<button
						type="submit"
						disabled={testSending || !testTo.trim()}
						class="px-4 py-2 rounded-lg border text-sm font-medium transition-colors hover:bg-muted disabled:opacity-40"
						style="border-color: var(--color-border); color: var(--color-foreground)"
					>
						{testSending ? 'Sending…' : 'Send test'}
					</button>
				</form>
			</div>
		</div>

	</div>
	{/if}

	<!-- ── SECURITY & DATA TAB ────────────────────────────────────────────── -->
	{#if activeTab === 'security'}
	<div class="space-y-6">

		<!-- Security -->
		<div class="rounded-xl border p-4 md:p-6" style="background-color: var(--color-card); border-color: var(--color-border)">
			<div class="flex items-center gap-2 mb-1">
				<Lock size={16} style="color: var(--color-primary)" />
				<h3 class="font-semibold" style="color: var(--color-foreground)">Security</h3>
			</div>
			<p class="text-sm mb-1" style="color: var(--color-muted-foreground)">
				Protect access with a password. When set, all visitors must sign in before viewing the app.
			</p>
			<p class="text-xs mb-5" style="color: var(--color-muted-foreground)">
				Status: {data.hasPassword
					? '🔒 Password protection is enabled.'
					: '🔓 No password set — app is publicly accessible.'}
			</p>

			{#if form?.passwordSuccess}
				<div role="status" class="mb-4 px-4 py-3 rounded-lg bg-green-50 text-green-700 text-sm">Password saved.</div>
			{/if}
			{#if form?.passwordRemoved}
				<div role="status" class="mb-4 px-4 py-3 rounded-lg bg-green-50 text-green-700 text-sm">Password protection removed.</div>
			{/if}
			{#if form?.passwordError}
				<div role="alert" class="mb-4 px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm">{form.passwordError}</div>
			{/if}

			<form
				method="POST"
				action="?/setPassword"
				class="flex flex-col sm:flex-row sm:items-end gap-3"
				use:enhance={() => {
					passwordSaving = true;
					return async ({ update }) => {
						passwordSaving = false;
						await update({ reset: true });
					};
				}}
			>
				<div class="flex-1">
					<label for="password-input" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">
						{data.hasPassword ? 'New password' : 'Password'}
					</label>
					<div class="relative">
						<input
							id="password-input"
							name="password"
							type={showNewPass ? 'text' : 'password'}
							placeholder="Min. 8 characters"
							required
							minlength="8"
							autocomplete="new-password"
							class="w-full px-3 py-2 pr-14 rounded-lg border text-sm outline-none focus:ring-2"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						/>
						<button type="button" onclick={() => (showNewPass = !showNewPass)}
							class="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium hover:opacity-70"
							style="color: var(--color-muted-foreground)">{showNewPass ? 'Hide' : 'Show'}</button>
					</div>
				</div>

				<button
					type="submit"
					disabled={passwordSaving}
					class="w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
					style="background-color: var(--color-primary); color: var(--color-primary-foreground)"
				>
					{passwordSaving ? 'Saving…' : data.hasPassword ? 'Update password' : 'Set password'}
				</button>
			</form>

			{#if data.hasPassword}
				<form method="POST" action="?/removePassword" class="mt-3">
					<button
						type="submit"
						class="w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-medium border transition-colors hover:opacity-80"
						style="border-color: var(--color-destructive); color: var(--color-destructive)"
						onclick={(e) => { if (!confirm('Remove password protection? The app will be publicly accessible.')) e.preventDefault(); }}
					>
						Remove password
					</button>
				</form>
			{/if}
		</div>

		<!-- Data Import -->
		<details
			class="rounded-xl border overflow-hidden"
			style="background-color: var(--color-card); border-color: var(--color-border)"
			bind:open={importOpen}
		>
			<summary class="flex items-center justify-between px-4 md:px-6 py-5 cursor-pointer list-none select-none">
				<div>
					<h3 class="font-semibold" style="color: var(--color-foreground)">Data Import</h3>
					<p class="text-sm mt-0.5" style="color: var(--color-muted-foreground)">
						Import clients and invoices from a Harvest CSV export
					</p>
				</div>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="18" height="18" viewBox="0 0 24 24"
					fill="none" stroke="currentColor" stroke-width="2"
					stroke-linecap="round" stroke-linejoin="round"
					style="color: var(--color-muted-foreground); transition: transform 0.2s; transform: rotate({importOpen ? 90 : 0}deg)"
				>
					<path d="m9 18 6-6-6-6"/>
				</svg>
			</summary>

			<div class="px-4 md:px-6 pb-4 md:pb-6 pt-5 border-t" style="border-color: var(--color-border)">
				<!-- Upload form — always available; import is idempotent -->
				<p class="text-sm mb-5" style="color: var(--color-muted-foreground)">
					Export your invoices from Harvest (<strong>Invoices → Export → CSV</strong>) and upload the file
					below. Clients, invoices, and line items will be created automatically. The import is idempotent
					— existing records are skipped, so it's safe to re-run.
				</p>

				{#if form?.importSuccess}
					{@const allSkipped = (form.importStats?.invCreated ?? 0) === 0 && (form.importStats?.invSkipped ?? 0) > 0}
					<div class="mb-5 p-4 rounded-lg" style="background-color: {allSkipped ? 'color-mix(in srgb, var(--color-destructive) 10%, transparent)' : 'var(--color-accent)'}">
						<p class="text-sm font-semibold mb-2" style="color: var(--color-foreground)">
							{allSkipped ? 'Import finished — nothing was created' : 'Import complete ✓'}
						</p>
						<ul class="text-sm space-y-0.5" style="color: var(--color-muted-foreground)">
							<li>Clients: {form.importStats?.clientsCreated} created, {form.importStats?.clientsSkipped} already existed</li>
							<li>
								Invoices: {form.importStats?.invCreated} created,
								{form.importStats?.invSkipped} skipped{form.importStats?.invFailed
									? `, ${form.importStats.invFailed} failed`
									: ''}
							</li>
							{#if (form.importStats?.invSkipped ?? 0) > 0}
								<li class="pl-3 text-xs mt-1 space-y-0.5">
									{#if form.importStats?.skipDuplicate}<div>↳ {form.importStats.skipDuplicate} already exist (duplicate)</div>{/if}
									{#if form.importStats?.skipNoClient}<div>↳ {form.importStats.skipNoClient} client name not matched</div>{/if}
									{#if form.importStats?.skipMissingFields}<div>↳ {form.importStats.skipMissingFields} missing ID or client name</div>{/if}
								</li>
							{/if}
						</ul>
						{#if form.importStats?.errors?.length}
							<ul class="mt-3 space-y-1 text-xs font-mono" style="color: var(--color-destructive)">
								{#each form.importStats.errors as err}<li>{err}</li>{/each}
							</ul>
						{/if}
					</div>
				{/if}

				{#if form?.importError}
					<div class="mb-5 px-4 py-3 rounded-lg text-sm" style="background-color: color-mix(in srgb, var(--color-destructive) 12%, transparent); color: var(--color-destructive)">
						{form.importError}
					</div>
				{/if}

				<form
					method="POST"
					action="?/harvestImport"
					enctype="multipart/form-data"
					class="flex items-end gap-3"
					use:enhance={() => {
						importing = true;
						return async ({ update }) => {
							importing = false;
							await update();
						};
					}}
				>
					<div class="flex-1 max-w-sm">
						<label for="harvest-csv-input" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">
							Harvest CSV File
						</label>
						<input
							id="harvest-csv-input"
							name="csv"
							type="file"
							accept=".csv"
							required
							class="w-full text-sm rounded-lg border px-3 py-2 outline-none focus:ring-2 cursor-pointer"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						/>
					</div>
					<button
						type="submit"
						disabled={importing}
						class="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
						style="background-color: var(--color-primary); color: var(--color-primary-foreground)"
					>
						{importing ? 'Importing…' : 'Import'}
					</button>
				</form>

				<!-- Reset panel — only shown when data exists -->
				{#if data.clientCount > 0}
					<div class="mt-8 pt-6 border-t" style="border-color: var(--color-border)">
						{#if form?.resetSuccess}
							<div class="p-4 rounded-lg text-sm" style="background-color: var(--color-accent); color: var(--color-foreground)">
								All data has been deleted. Reload the page to import a fresh dataset.
							</div>
						{:else}
							<details class="rounded-lg border overflow-hidden" style="border-color: var(--color-destructive)" ontoggle={(e) => resetOpen = (e.target as HTMLDetailsElement).open}>
								<summary
									class="flex items-center justify-between px-4 py-3 cursor-pointer list-none select-none text-sm font-medium"
									style="color: var(--color-destructive); background-color: color-mix(in srgb, var(--color-destructive) 8%, transparent)"
								>
									<span>Reset all data…</span>
									<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
										fill="none" stroke="currentColor" stroke-width="2.5"
										stroke-linecap="round" stroke-linejoin="round"
										style="transition: transform 0.2s; transform: rotate({resetOpen ? 90 : 0}deg)"
									>
										<path d="m9 18 6-6-6-6"/>
									</svg>
								</summary>

								<div class="px-4 py-4 border-t space-y-4" style="border-color: var(--color-destructive)">
									<p class="text-sm font-semibold" style="color: var(--color-destructive)">
										⚠ This will permanently delete all clients, invoices, and line items. There is no undo.
									</p>

									{#if form?.resetError}
										<p class="text-sm" style="color: var(--color-destructive)">{form.resetError}</p>
									{/if}

									<div class="space-y-2">
										{#each [
											{ bind: resetCheck1, label: 'I understand all client records will be permanently deleted.' },
											{ bind: resetCheck2, label: 'I understand all invoices and line items will be permanently deleted.' },
											{ bind: resetCheck3, label: 'I understand this cannot be undone and I have a backup if needed.' }
										] as item, i}
											<label class="flex items-start gap-3 cursor-pointer select-none">
												<input
													type="checkbox"
													class="mt-0.5 h-4 w-4 rounded shrink-0 cursor-pointer"
													style="accent-color: var(--color-destructive)"
													checked={i === 0 ? resetCheck1 : i === 1 ? resetCheck2 : resetCheck3}
													onchange={() => {
														if (i === 0) resetCheck1 = !resetCheck1;
														else if (i === 1) resetCheck2 = !resetCheck2;
														else resetCheck3 = !resetCheck3;
													}}
												/>
												<span class="text-sm" style="color: var(--color-foreground)">{item.label}</span>
											</label>
										{/each}
									</div>

									<form
										method="POST"
										action="?/resetData"
										use:enhance={() => {
											resetting = true;
											return async ({ update }) => {
												resetting = false;
												resetCheck1 = false;
												resetCheck2 = false;
												resetCheck3 = false;
												await update();
											};
										}}
									>
										<button
											type="submit"
											disabled={!resetReady || resetting}
											class="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
											style="background-color: var(--color-destructive); color: white"
										>
											{resetting ? 'Deleting…' : 'Delete everything'}
										</button>
									</form>
								</div>
							</details>
						{/if}
					</div>
				{/if}
			</div>
		</details>

	</div>
	{/if}
</div>
