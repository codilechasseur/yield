<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { Sun, Moon, Monitor, Check, Save, Palette, Building2, FileText, Hash, Coins, Mail, FileUp, Image, X } from 'lucide-svelte';
	import Tip from '$lib/components/Tip.svelte';
	import RichTextarea from '$lib/components/RichTextarea.svelte';
	import FormAlert from '$lib/components/FormAlert.svelte';
	import { addToast } from '$lib/toasts.svelte.js';
	import type { PageData, ActionData } from './$types.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	type Theme = 'light' | 'system' | 'dark';

	let current = $state<Theme>(
		(untrack(() => data.smtp?.brand_theme) as Theme)
			?? ((typeof localStorage !== 'undefined'
				? (localStorage.getItem('yield-theme') as Theme)
				: null) ?? 'system')
	);

	function setTheme(t: Theme) {
		current = t;
		localStorage.setItem('yield-theme', t);
		document.documentElement.setAttribute('data-theme', t);
		fetch('?/saveAppearance', {
			method: 'POST',
			body: new URLSearchParams({ brand_theme: t, brand_hue: String(hue) })
		}).catch(() => { /* ignore */ });
	}

	const options: { value: Theme; label: string; desc: string; icon: typeof Sun }[] = [
		{ value: 'light', label: 'Light', desc: 'Always use the light theme', icon: Sun },
		{ value: 'system', label: 'System', desc: 'Follow your OS preference', icon: Monitor },
		{ value: 'dark', label: 'Dark', desc: 'Always use the dark theme', icon: Moon }
	];

	// ── Field state ───────────────────────────────────────────────────────
	let taxPercent        = $state<number>(untrack(() => data.smtp?.default_tax_percent ?? 5));
	let incomeTaxRate     = $state<number>(untrack(() => data.smtp?.income_tax_rate ?? 0));
	let defaultHourlyRate = $state<number>(untrack(() => data.smtp?.default_hourly_rate ?? 0));
	let companyName       = $state(untrack(() => data.smtp?.company_name ?? ''));
	let companyAddress    = $state(untrack(() => data.smtp?.company_address ?? ''));
	let defaultNotes      = $state(untrack(() => data.smtp?.invoice_default_notes ?? ''));
	let invoiceFooter     = $state(untrack(() => data.smtp?.invoice_footer ?? ''));
	let invoiceNumberFormat = $state(untrack(() => data.smtp?.invoice_number_format ?? 'INV-{number}'));
	let invoiceNextNumber   = $state<number>(untrack(() => data.smtp?.invoice_next_number ?? 1));
	let emailSubject      = $state(untrack(() => data.smtp?.email_subject ?? ''));
	let emailBody         = $state(untrack(() => data.smtp?.email_body ?? ''));
	let hideCompanyName   = $state<boolean>(untrack(() => data.smtp?.logo_hide_company_name ?? false));
	let defaultCurrency   = $state(untrack(() => data.smtp?.default_currency ?? 'CAD'));

	// ── Logo upload state ─────────────────────────────────────────────────
	let logoUploading = $state(false);
	let logoRemoving  = $state(false);
	let logoError     = $state('');
	let logoFile      = $state<File | null>(null);

	const currencies = ['CAD', 'USD', 'EUR', 'GBP', 'AUD', 'NZD', 'CHF', 'JPY', 'MXN', 'BRL'];

	// ── Highlight colour ──────────────────────────────────────────────────
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

	let hue = $state<number>(untrack(() => data.smtp?.brand_hue ?? 250));

	function setHue(h: number) {
		hue = h;
		localStorage.setItem('yield-hue', String(h));
		document.documentElement.style.setProperty('--hue', String(h));
		fetch('?/saveAppearance', {
			method: 'POST',
			body: new URLSearchParams({ brand_hue: String(h), brand_theme: current })
		}).catch(() => { /* ignore */ });
	}

	// ── Per-section save state ────────────────────────────────────────────
	let companySaved   = $state({ name: data.smtp?.company_name ?? '', address: data.smtp?.company_address ?? '' });
	let companySaving  = $state(false);
	let companyDirty   = $derived(companyName !== companySaved.name || companyAddress !== companySaved.address);

	let notesSaved     = $state({ notes: data.smtp?.invoice_default_notes ?? '', footer: data.smtp?.invoice_footer ?? '' });
	let notesSaving    = $state(false);
	let notesDirty     = $derived(defaultNotes !== notesSaved.notes || invoiceFooter !== notesSaved.footer);

	let numberingSaved  = $state({ format: data.smtp?.invoice_number_format ?? 'INV-{number}', next: data.smtp?.invoice_next_number ?? 1 });
	let numberingSaving = $state(false);
	let numberingDirty  = $derived(invoiceNumberFormat !== numberingSaved.format || invoiceNextNumber !== numberingSaved.next);

	let taxSaved   = $state({ tax: data.smtp?.default_tax_percent ?? 5, income: data.smtp?.income_tax_rate ?? 0, hourly: data.smtp?.default_hourly_rate ?? 0, currency: data.smtp?.default_currency ?? 'CAD' });
	let taxSaving  = $state(false);
	let taxDirty   = $derived(taxPercent !== taxSaved.tax || incomeTaxRate !== taxSaved.income || defaultHourlyRate !== taxSaved.hourly || defaultCurrency !== taxSaved.currency);

	let emailSaved  = $state({ subject: data.smtp?.email_subject ?? '', body: data.smtp?.email_body ?? '' });
	let emailSaving = $state(false);
	let emailDirty  = $derived(emailSubject !== emailSaved.subject || emailBody !== emailSaved.body);
</script>

<svelte:head>
	<title>Settings — Yield</title>
</svelte:head>

<div class="max-w-5xl mx-auto space-y-14 pb-24">

	<!-- ── Page header ──────────────────────────────────────────────────── -->
	<div>
		<h2 class="text-2xl font-bold" style="color: var(--color-foreground)">Settings</h2>
		<p class="mt-1 text-sm" style="color: var(--color-muted-foreground)">Manage preferences for Yield.</p>
	</div>

	<!-- ════════════════════════════════════════════════════════
	     APPEARANCE — auto-saves on change, no save button needed
	     ════════════════════════════════════════════════════════ -->
	<section id="appearance" class="scroll-mt-6 space-y-6">
		<h3 class="text-base font-semibold" style="color: var(--color-foreground)">Appearance</h3>

		<!-- Theme -->
		<div class="rounded-xl border p-4 md:p-6" style="background-color: var(--color-card); border-color: var(--color-border)">
			<div class="flex items-center gap-2 mb-1">
				<Monitor size={16} style="color: var(--color-primary)" aria-hidden="true" />
				<h4 class="font-semibold" style="color: var(--color-foreground)">Theme</h4>
			</div>
			<p class="text-sm mb-5" style="color: var(--color-muted-foreground)">Choose how Yield looks to you. Changes apply instantly.</p>

			<div class="grid grid-cols-3 gap-3">
				{#each options as opt}
					{@const active = current === opt.value}
					{@const Icon = opt.icon}
					<button
						type="button"
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
			<div class="flex items-center gap-2 mb-1">
				<Palette size={16} style="color: var(--color-primary)" aria-hidden="true" />
				<h4 class="font-semibold" style="color: var(--color-foreground)">Highlight Colour</h4>
			</div>
			<p class="text-sm mb-5" style="color: var(--color-muted-foreground)">Accent colour used throughout the interface and on invoice PDFs. Changes apply instantly.</p>

			<div class="flex flex-wrap gap-3 mb-5">
				{#each presets as p}
					{@const active = Math.abs(hue - p.hue) < 8}
					<button
						type="button"
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

			<div class="space-y-2">
				<div class="flex items-center justify-between text-xs font-medium" style="color: var(--color-muted-foreground)">
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

			<div class="mt-5 flex items-center gap-3 flex-wrap">
				<span class="text-xs font-medium" style="color: var(--color-muted-foreground)">Preview:</span>
				<button type="button" class="px-3 py-1.5 rounded-lg text-xs font-medium"
					style="background-color: var(--color-primary); color: var(--color-primary-foreground)">
					Primary
				</button>
				<span class="status-badge status-sent">sent</span>
				<a class="text-xs font-medium" style="color: var(--color-primary)" href="/settings">Link</a>
			</div>
		</div>
	</section>

	<!-- ════════════════════════════════════════════════════════
	     INVOICES
	     ════════════════════════════════════════════════════════ -->
	<section id="invoices" class="scroll-mt-6 space-y-6">
		<h3 class="text-base font-semibold" style="color: var(--color-foreground)">Invoices</h3>

		<!-- Company -->
		<div class="rounded-xl border p-4 md:p-6" style="background-color: var(--color-card); border-color: var(--color-border)">
			<div class="flex items-center gap-2 mb-1">
				<Building2 size={16} style="color: var(--color-primary)" aria-hidden="true" />
				<h4 class="font-semibold" style="color: var(--color-foreground)">Your Company</h4>
			</div>
			<p class="text-sm mb-5" style="color: var(--color-muted-foreground)">Shown as the sender on invoice PDFs and emails.</p>
			<form
				method="POST"
				action="?/saveInvoiceDefaults"
				class="space-y-4"
				use:enhance={() => {
					companySaving = true;
					return async ({ update, result }) => {
						companySaving = false;
						await update({ reset: false });
						if (result.type === 'success') {
							companySaved = { name: companyName, address: companyAddress };
							addToast('Company details saved');
						} else if (result.type === 'failure') {
							addToast((result.data as any)?.invoiceDefaultsError ?? 'Failed to save', 'error');
						}
					};
				}}
			>
				<!-- Preserve notes/footer so saveInvoiceDefaults doesn't blank them -->
				<input type="hidden" name="invoice_default_notes" value={defaultNotes} />
				<input type="hidden" name="invoice_footer" value={invoiceFooter} />
				<div class="flex flex-col gap-1">
					<label for="company-name" class="text-xs font-medium" style="color: var(--color-muted-foreground)">Name / Company</label>
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
					<label for="company-address" class="text-xs font-medium inline-flex items-center" style="color: var(--color-muted-foreground)">Address <Tip tip="Shown below your name in the invoice PDF header." /></label>
					<RichTextarea
						id="company-address"
						name="company_address"
						rows={3}
						placeholder={"e.g. 123 Main St\nToronto, ON M5V 1A1"}
						bind:value={companyAddress}
						class="w-full px-3 py-2 rounded-lg border text-sm resize-none"
						style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
					/>
				</div>
				<div class="flex justify-end pt-1">
					<button
						type="submit"
						disabled={companySaving}
						class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
						style={companyDirty
							? 'background-color: var(--color-primary); color: var(--color-primary-foreground)'
							: 'background-color: var(--color-muted); color: var(--color-muted-foreground); opacity: 0.6'}
					>
						<Save size={14} aria-hidden="true" />
						{companySaving ? 'Saving…' : 'Save'}
					</button>
				</div>
			</form>
		</div>

		<!-- Company Logo -->
		<div class="rounded-xl border p-4 md:p-6" style="background-color: var(--color-card); border-color: var(--color-border)">
			<div class="flex items-center gap-2 mb-1">
				<Image size={16} style="color: var(--color-primary)" aria-hidden="true" />
				<h4 class="font-semibold" style="color: var(--color-foreground)">Company Logo</h4>
			</div>
			<p class="text-sm mb-5" style="color: var(--color-muted-foreground)">Displayed in invoice PDF headers alongside your company name.</p>

			{#if data.logoUrl}
				<div class="mb-4 p-3 rounded-lg border inline-flex" style="border-color: var(--color-border); background: var(--color-muted)">
					<img src={data.logoUrl} alt="Company logo preview" style="max-height:64px;max-width:220px;width:auto;height:auto;object-fit:contain;display:block;" />
				</div>

				<!-- Hide company name toggle — own form, saves immediately -->
				<form
					method="POST"
					action="?/saveLogoSettings"
					use:enhance={() => {
						return async ({ update, result }) => {
							await update({ reset: false });
							if (result.type === 'success') addToast('Saved');
						};
					}}
				>
					<input type="hidden" name="logo_hide_company_name" value={hideCompanyName ? 'on' : 'off'} />
					<div class="flex items-center gap-3 mb-5">
						<button
							id="hide-company-name"
							type="submit"
							role="switch"
							aria-label="Hide company name on PDFs"
							aria-checked={hideCompanyName}
							onclick={() => hideCompanyName = !hideCompanyName}
							class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
							style={hideCompanyName
								? 'background-color: var(--color-primary); outline-color: var(--color-primary)'
								: 'background-color: var(--color-muted); outline-color: var(--color-primary)'}
						>
							<span
								aria-hidden="true"
								class="pointer-events-none inline-block size-5 rounded-full shadow-sm ring-0 transition-transform"
								style="background-color: white; transform: translateX({hideCompanyName ? '20px' : '0px'})"
							></span>
						</button>
						<label for="hide-company-name" class="text-sm cursor-pointer" style="color: var(--color-foreground)">Hide company name on PDFs</label>
						<Tip tip="Use this when your logo already contains your company name, to avoid showing it twice on invoices." />
					</div>
				</form>
			{/if}

			<FormAlert message={logoError || null} class="mb-3" />

			<div class="flex flex-wrap items-end gap-3">
				<!-- Upload form -->
				<form
					method="POST"
					action="?/saveLogo"
					enctype="multipart/form-data"
					use:enhance={() => {
						logoUploading = true;
						logoError = '';
						return async ({ update, result }) => {
							logoUploading = false;
							logoFile = null;
							await update();
							if (result.type === 'success') {
								addToast('Logo saved');
							} else if (result.type === 'failure') {
								logoError = (result.data as any)?.logoError ?? 'Failed to save logo';
							}
						};
					}}
					class="flex items-end gap-2"
				>
					<div class="flex flex-col gap-1">
						<label for="logo-upload" class="text-xs font-medium" style="color: var(--color-muted-foreground)">{data.logoUrl ? 'Replace logo' : 'Upload logo'}</label>
						<input
							id="logo-upload"
							name="logo"
							type="file"
							accept="image/jpeg,image/png,image/gif,image/svg+xml,image/webp"
							onchange={(e) => { logoFile = (e.target as HTMLInputElement).files?.[0] ?? null; }}
							class="text-sm rounded-lg border px-2 py-1.5 file:mr-2 file:rounded file:border-0 file:px-2 file:py-1 file:text-xs file:font-medium"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground); file:background-color: var(--color-muted); file:color: var(--color-muted-foreground)"
						/>
					</div>
					<button
						type="submit"
						disabled={logoUploading || !logoFile}
						class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all"
						style={logoFile && !logoUploading
							? 'background-color: var(--color-primary); color: var(--color-primary-foreground)'
							: 'background-color: var(--color-muted); color: var(--color-muted-foreground); opacity: 0.7'}
					>
						<FileUp size={14} aria-hidden="true" />
						{logoUploading ? 'Uploading…' : 'Upload'}
					</button>
				</form>

				<!-- Remove logo -->
				{#if data.logoUrl}
					<form
						method="POST"
						action="?/removeLogo"
						use:enhance={() => {
							logoRemoving = true;
							logoError = '';
							return async ({ update, result }) => {
								logoRemoving = false;
								await update();
								if (result.type === 'success') {
									addToast('Logo removed');
								} else if (result.type === 'failure') {
									logoError = (result.data as any)?.logoError ?? 'Failed to remove logo';
								}
							};
						}}
					>
						<button
							type="submit"
							disabled={logoRemoving}
							class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-all"
							style="border-color: var(--color-border); color: var(--color-muted-foreground); background: var(--color-background)"
						>
							<X size={13} aria-hidden="true" />
							{logoRemoving ? 'Removing…' : 'Remove logo'}
						</button>
					</form>
				{/if}
			</div>
		</div>

		<!-- Invoice Defaults -->
		<div class="rounded-xl border p-4 md:p-6" style="background-color: var(--color-card); border-color: var(--color-border)">
			<div class="flex items-center gap-2 mb-1">
				<FileText size={16} style="color: var(--color-primary)" aria-hidden="true" />
				<h4 class="font-semibold" style="color: var(--color-foreground)">Invoice Defaults</h4>
			</div>
			<p class="text-sm mb-5" style="color: var(--color-muted-foreground)">Default notes pre-filled on new invoices, and a footer printed on every PDF.</p>
			<form
				method="POST"
				action="?/saveInvoiceDefaults"
				class="space-y-4"
				use:enhance={() => {
					notesSaving = true;
					return async ({ update, result }) => {
						notesSaving = false;
						await update({ reset: false });
						if (result.type === 'success') {
							notesSaved = { notes: defaultNotes, footer: invoiceFooter };
							addToast('Invoice defaults saved');
						} else if (result.type === 'failure') {
							addToast((result.data as any)?.invoiceDefaultsError ?? 'Failed to save', 'error');
						}
					};
				}}
			>
				<!-- Preserve company fields so saveInvoiceDefaults doesn't blank them -->
				<input type="hidden" name="company_name" value={companyName} />
				<input type="hidden" name="company_address" value={companyAddress} />
				<div class="flex flex-col gap-1">
					<label for="default-notes" class="text-xs font-medium inline-flex items-center" style="color: var(--color-muted-foreground)">Default Notes <Tip tip="Pre-filled in the Notes field when creating a new invoice. Editable per invoice." /></label>
					<RichTextarea
						id="default-notes"
						name="invoice_default_notes"
						rows={3}
						placeholder="e.g. Payment due within 30 days. Thank you for your business!"
						bind:value={defaultNotes}
						class="w-full px-3 py-2 rounded-lg border text-sm resize-none"
						style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
					/>
				</div>
				<div class="flex flex-col gap-1">
					<label for="invoice-footer" class="text-xs font-medium inline-flex items-center" style="color: var(--color-muted-foreground)">Invoice Footer <Tip tip="Printed on every invoice PDF below the line items — bank account, payment instructions, etc." /></label>
					<RichTextarea
						id="invoice-footer"
						name="invoice_footer"
						rows={12}
						placeholder={"e.g. E-transfer: you@example.com\nBank: TD Canada Trust · Transit 12345 · Account 678900"}
						bind:value={invoiceFooter}
						class="w-full px-3 py-2 rounded-lg border text-sm resize-none font-mono"
						style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
					/>
				</div>
				<div class="flex justify-end pt-1">
					<button
						type="submit"
						disabled={notesSaving}
						class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
						style={notesDirty
							? 'background-color: var(--color-primary); color: var(--color-primary-foreground)'
							: 'background-color: var(--color-muted); color: var(--color-muted-foreground); opacity: 0.6'}
					>
						<Save size={14} aria-hidden="true" />
						{notesSaving ? 'Saving…' : 'Save'}
					</button>
				</div>
			</form>
		</div>

		<!-- Invoice Numbering -->
		<div class="rounded-xl border p-4 md:p-6" style="background-color: var(--color-card); border-color: var(--color-border)">
			<div class="flex items-center gap-2 mb-1">
				<Hash size={16} style="color: var(--color-primary)" aria-hidden="true" />
				<h4 class="font-semibold" style="color: var(--color-foreground)">Invoice Numbering</h4>
			</div>
			<p class="text-sm mb-5" style="color: var(--color-muted-foreground)">
				Use <code class="font-mono text-xs">{'{number}'}</code> as the counter placeholder — e.g. <code class="font-mono text-xs">INV-{'{number}'}</code> produces <code class="font-mono text-xs">INV-615</code>.
			</p>
			<form
				method="POST"
				action="?/saveInvoiceNumbering"
				class="space-y-4"
				use:enhance={() => {
					numberingSaving = true;
					return async ({ update, result }) => {
						numberingSaving = false;
						await update({ reset: false });
						if (result.type === 'success') {
							numberingSaved = { format: invoiceNumberFormat, next: invoiceNextNumber };
							addToast('Invoice numbering saved');
						} else if (result.type === 'failure') {
							addToast((result.data as any)?.invoiceNumberingError ?? 'Failed to save', 'error');
						}
					};
				}}
			>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div class="flex flex-col gap-1">
						<label for="invoice-number-format" class="text-xs font-medium" style="color: var(--color-muted-foreground)">Number Format</label>
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
						<label for="invoice-next-number" class="text-xs font-medium inline-flex items-center" style="color: var(--color-muted-foreground)">Next Number <Tip tip="Increments automatically when an invoice is created." /></label>
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
				<div class="text-sm px-3 py-1.5 rounded-md inline-flex" style="background: var(--color-muted); color: var(--color-muted-foreground)">
					Preview: <span class="font-mono font-semibold ml-2" style="color: var(--color-foreground)">{(invoiceNumberFormat || 'INV-{number}').replace('{number}', String(invoiceNextNumber || 1))}</span>
				</div>
				<div class="flex justify-end pt-1">
					<button
						type="submit"
						disabled={numberingSaving}
						class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
						style={numberingDirty
							? 'background-color: var(--color-primary); color: var(--color-primary-foreground)'
							: 'background-color: var(--color-muted); color: var(--color-muted-foreground); opacity: 0.6'}
					>
						<Save size={14} aria-hidden="true" />
						{numberingSaving ? 'Saving…' : 'Save'}
					</button>
				</div>
			</form>
		</div>

		<!-- Tax & Currency -->
		<div class="rounded-xl border p-4 md:p-6" style="background-color: var(--color-card); border-color: var(--color-border)">
			<div class="flex items-center gap-2 mb-1">
				<Coins size={16} style="color: var(--color-primary)" aria-hidden="true" />
				<h4 class="font-semibold" style="color: var(--color-foreground)">Tax & Currency</h4>
			</div>
			<p class="text-sm mb-5" style="color: var(--color-muted-foreground)">Defaults applied when creating new invoices and clients. Existing records are not affected.</p>
			<form
				method="POST"
				action="?/saveAll"
				class="space-y-4"
				use:enhance={() => {
					taxSaving = true;
					return async ({ update, result }) => {
						taxSaving = false;
						await update({ reset: false });
						if (result.type === 'success') {
							taxSaved = { tax: taxPercent, income: incomeTaxRate, hourly: defaultHourlyRate, currency: defaultCurrency };
							addToast('Tax & currency saved');
						} else if (result.type === 'failure') {
							addToast((result.data as any)?.saveAllError ?? 'Failed to save', 'error');
						}
					};
				}}
			>
				<!-- Pass all other fields through so saveAll doesn't wipe them -->
				<input type="hidden" name="company_name" value={companyName} />
				<input type="hidden" name="company_address" value={companyAddress} />
				<input type="hidden" name="invoice_default_notes" value={defaultNotes} />
				<input type="hidden" name="invoice_footer" value={invoiceFooter} />
				<input type="hidden" name="invoice_number_format" value={invoiceNumberFormat} />
				<input type="hidden" name="invoice_next_number" value={invoiceNextNumber} />
				<input type="hidden" name="brand_hue" value={hue} />
				<input type="hidden" name="brand_theme" value={current} />
				<input type="hidden" name="logo_hide_company_name" value={hideCompanyName ? 'on' : 'off'} />
				<input type="hidden" name="email_subject" value={emailSubject} />
				<input type="hidden" name="email_body" value={emailBody} />
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
					<div class="flex flex-col gap-1">
						<label for="default_currency" class="text-xs font-medium" style="color: var(--color-muted-foreground)">Default Currency</label>
						<select
							id="default_currency"
							name="default_currency"
							bind:value={defaultCurrency}
							class="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						>
							{#each currencies as c}
								<option value={c}>{c}</option>
							{/each}
						</select>
					</div>
					<div class="flex flex-col gap-1">
						<label for="tax-rate" class="text-xs font-medium inline-flex items-center" style="color: var(--color-muted-foreground)">GST / Tax Rate (%) <Tip tip="Default rate applied to new invoices." /></label>
						<input
							id="tax-rate"
							name="default_tax_percent"
							type="number"
							min="0" max="100" step="0.01"
							bind:value={taxPercent}
							class="w-full px-3 py-2 rounded-lg border text-sm font-mono"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						/>
					</div>
					<div id="income-tax-rate" class="flex flex-col gap-1 scroll-mt-6">
						<label for="income-tax-rate-input" class="text-xs font-medium inline-flex items-center" style="color: var(--color-muted-foreground)">Income Tax Rate (%) <Tip tip="Your personal rate used in Tax Reports. Not applied to invoice totals." /></label>
						<input
							id="income-tax-rate-input"
							name="income_tax_rate"
							type="number"
							min="0" max="100" step="0.1"
							bind:value={incomeTaxRate}
							class="w-full px-3 py-2 rounded-lg border text-sm font-mono"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						/>
					</div>
					<div class="flex flex-col gap-1">
						<label for="default-hourly-rate" class="text-xs font-medium inline-flex items-center" style="color: var(--color-muted-foreground)">Default Hourly Rate <Tip tip="Default rate pre-filled when adding line items. Can be overridden per client." /></label>
						<input
							id="default-hourly-rate"
							name="default_hourly_rate"
							type="number"
							min="0" step="0.01"
							bind:value={defaultHourlyRate}
							class="w-full px-3 py-2 rounded-lg border text-sm font-mono"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						/>
					</div>
				</div>
				<div class="flex justify-end pt-1">
					<button
						type="submit"
						disabled={taxSaving}
						class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
						style={taxDirty
							? 'background-color: var(--color-primary); color: var(--color-primary-foreground)'
							: 'background-color: var(--color-muted); color: var(--color-muted-foreground); opacity: 0.6'}
					>
						<Save size={14} aria-hidden="true" />
						{taxSaving ? 'Saving…' : 'Save'}
					</button>
				</div>
			</form>
		</div>
	</section>

	<!-- ════════════════════════════════════════════════════════
	     EMAIL
	     ════════════════════════════════════════════════════════ -->
	<section id="email" class="scroll-mt-6 space-y-6">
		<h3 class="text-base font-semibold" style="color: var(--color-foreground)">Email</h3>

		<div class="rounded-xl border p-4 md:p-6" style="background-color: var(--color-card); border-color: var(--color-border)">
			<div class="flex items-center gap-2 mb-1">
				<Mail size={16} style="color: var(--color-primary)" aria-hidden="true" />
				<h4 class="font-semibold" style="color: var(--color-foreground)">Email Template</h4>
			</div>
			<p class="text-sm mb-1" style="color: var(--color-muted-foreground)">Boilerplate used when sending invoices. Leave blank to use the built-in defaults.</p>
			<p class="text-xs mb-5" style="color: var(--color-muted-foreground)">
				Placeholders: <code class="font-mono">{'{invoice_number}'}</code> <code class="font-mono">{'{client_name}'}</code> <code class="font-mono">{'{total}'}</code> <code class="font-mono">{'{due_date}'}</code> <code class="font-mono">{'{issue_date}'}</code> <code class="font-mono">{'{company_name}'}</code>
			</p>
			<form
				method="POST"
				action="?/saveEmailTemplate"
				class="space-y-4"
				use:enhance={() => {
					emailSaving = true;
					return async ({ update, result }) => {
						emailSaving = false;
						await update({ reset: false });
						if (result.type === 'success') {
							emailSaved = { subject: emailSubject, body: emailBody };
							addToast('Email template saved');
						} else if (result.type === 'failure') {
							addToast((result.data as any)?.emailTemplateError ?? 'Failed to save', 'error');
						}
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
					<label for="email-body" class="text-xs font-medium inline-flex items-center" style="color: var(--color-muted-foreground)">Body <Tip tip="The body can be edited per-send on the invoice detail page." /></label>
					<RichTextarea
						id="email-body"
						name="email_body"
						rows={8}
						bind:value={emailBody}
						placeholder={data.DEFAULT_EMAIL_BODY}
						class="w-full px-3 py-2 rounded-lg border text-sm resize-none font-mono"
						style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
					/>
				</div>
				<div class="flex justify-end pt-1">
					<button
						type="submit"
						disabled={emailSaving}
						class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
						style={emailDirty
							? 'background-color: var(--color-primary); color: var(--color-primary-foreground)'
							: 'background-color: var(--color-muted); color: var(--color-muted-foreground); opacity: 0.6'}
					>
						<Save size={14} aria-hidden="true" />
						{emailSaving ? 'Saving…' : 'Save'}
					</button>
				</div>
			</form>
		</div>
	</section>

</div>
