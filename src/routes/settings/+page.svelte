<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { untrack } from 'svelte';
	import { Sun, Moon, Monitor, Check, Save, Palette, Building2, FileText, Hash, Coins, Mail, FileUp, Image, X, BellRing, Sparkles, Type, Code } from 'lucide-svelte';
	import { PRESETS, FONTS, getPreset } from '$lib/presets.js';
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
	let estimateNumberFormat = $state(untrack(() => data.smtp?.estimate_number_format ?? 'EST-{number}'));
	let estimateNextNumber   = $state<number>(untrack(() => data.smtp?.estimate_next_number ?? 1));
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
	let companySaved   = $state(untrack(() => ({ name: data.smtp?.company_name ?? '', address: data.smtp?.company_address ?? '' })));
	let companySaving  = $state(false);
	let companyDirty   = $derived(companyName !== companySaved.name || companyAddress !== companySaved.address);

	let notesSaved     = $state(untrack(() => ({ notes: data.smtp?.invoice_default_notes ?? '', footer: data.smtp?.invoice_footer ?? '' })));
	let notesSaving    = $state(false);
	let notesDirty     = $derived(defaultNotes !== notesSaved.notes || invoiceFooter !== notesSaved.footer);

	let numberingSaved  = $state(untrack(() => ({ format: data.smtp?.invoice_number_format ?? 'INV-{number}', next: data.smtp?.invoice_next_number ?? 1 })));
	let numberingSaving = $state(false);
	let numberingDirty  = $derived(invoiceNumberFormat !== numberingSaved.format || invoiceNextNumber !== numberingSaved.next);

	let estNumberingSaved  = $state(untrack(() => ({ format: data.smtp?.estimate_number_format ?? 'EST-{number}', next: data.smtp?.estimate_next_number ?? 1 })));
	let estNumberingSaving = $state(false);
	let estNumberingDirty  = $derived(estimateNumberFormat !== estNumberingSaved.format || estimateNextNumber !== estNumberingSaved.next);

	let taxSaved   = $state(untrack(() => ({ tax: data.smtp?.default_tax_percent ?? 5, income: data.smtp?.income_tax_rate ?? 0, hourly: data.smtp?.default_hourly_rate ?? 0, currency: data.smtp?.default_currency ?? 'CAD' })));
	let taxSaving  = $state(false);
	let taxDirty   = $derived(taxPercent !== taxSaved.tax || incomeTaxRate !== taxSaved.income || defaultHourlyRate !== taxSaved.hourly || defaultCurrency !== taxSaved.currency);

	let emailSaved  = $state(untrack(() => ({ subject: data.smtp?.email_subject ?? '', body: data.smtp?.email_body ?? '' })));
	let emailSaving = $state(false);
	let emailDirty  = $derived(emailSubject !== emailSaved.subject || emailBody !== emailSaved.body);

	// ── Payment reminders state ───────────────────────────────────────────
	let remindersEnabled = $state(untrack(() => data.smtp?.reminders_enabled ?? false));
	let reminderDays     = $state<number>(untrack(() => data.smtp?.reminder_days || 7));
	let remindersSaving  = $state(false);

	// ── Brand preset + font ───────────────────────────────────────────────
	let preset = $state(untrack(() => data.smtp?.brand_preset ?? ''));
	let font   = $state(untrack(() => data.smtp?.brand_font ?? ''));
	const activePreset = $derived(getPreset(preset));

	function applyRootAttr(attr: string, storageKey: string, value: string) {
		if (value) {
			localStorage.setItem(storageKey, value);
			document.documentElement.setAttribute(attr, value);
		} else {
			localStorage.removeItem(storageKey);
			document.documentElement.removeAttribute(attr);
		}
	}

	function setPreset(id: string) {
		preset = id;
		applyRootAttr('data-preset', 'yield-preset', id);
		fetch('?/saveAppearance', {
			method: 'POST',
			body: new URLSearchParams({ brand_preset: id })
		})
			// Refresh layout data so the logo mark and manifest metas follow.
			.then(() => invalidateAll())
			.catch(() => { /* ignore */ });
	}

	function setFont(id: string) {
		font = id;
		applyRootAttr('data-font', 'yield-font', id);
		fetch('?/saveAppearance', {
			method: 'POST',
			body: new URLSearchParams({ brand_font: id })
		}).catch(() => { /* ignore */ });
	}

	// ── App logo (UI chrome) state ────────────────────────────────────────
	let appLogoUploading = $state(false);
	let appLogoRemoving  = $state(false);
	let appLogoError     = $state('');
	let appLogoFile      = $state<File | null>(null);

	// ── Custom CSS state ──────────────────────────────────────────────────
	let customCss       = $state(untrack(() => data.smtp?.brand_custom_css ?? ''));
	let customCssSaved  = $state(untrack(() => data.smtp?.brand_custom_css ?? ''));
	let customCssSaving = $state(false);
	let customCssDirty  = $derived(customCss !== customCssSaved);

	// ── Branding (app name + favicon) state ───────────────────────────────
	let appNameValue  = $state(untrack(() => data.smtp?.app_name ?? ''));
	let appNameSaved  = $state(untrack(() => data.smtp?.app_name ?? ''));
	let appNameSaving = $state(false);
	let appNameDirty  = $derived(appNameValue !== appNameSaved);
	let faviconUploading = $state(false);
	let faviconRemoving  = $state(false);
	let faviconError     = $state('');
	let faviconFile      = $state<File | null>(null);
</script>

<svelte:head>
	<title>Settings — {page.data.appName}</title>
</svelte:head>

<div class="max-w-5xl mx-auto space-y-14 pb-24">

	<!-- ── Page header ──────────────────────────────────────────────────── -->
	<div>
		<h2 class="text-2xl font-bold" style="color: var(--color-foreground)">Settings</h2>
		<p class="mt-1 text-sm" style="color: var(--color-muted-foreground)">Business preferences — appearance, company details, invoicing, and email.</p>
		<nav aria-label="Settings sections" class="mt-4 flex flex-wrap gap-2">
			{#each [['#appearance', 'Appearance'], ['#company', 'Company'], ['#invoices', 'Invoices'], ['#email', 'Email']] as [href, label]}
				<a
					{href}
					class="px-3 py-1.5 rounded-full border text-xs font-medium transition-colors hover:bg-muted"
					style="border-color: var(--color-border); color: var(--color-muted-foreground)"
				>{label}</a>
			{/each}
		</nav>
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

		<!-- Brand preset -->
		<div class="rounded-xl border p-4 md:p-6" style="background-color: var(--color-card); border-color: var(--color-border)">
			<div class="flex items-center gap-2 mb-1">
				<Sparkles size={16} style="color: var(--color-primary)" aria-hidden="true" />
				<h4 class="font-semibold" style="color: var(--color-foreground)">Brand Preset</h4>
			</div>
			<p class="text-sm mb-5" style="color: var(--color-muted-foreground)">A complete look — colours, typography, and shape — defined in code. Changes apply instantly.</p>

			<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
				{#each PRESETS as p}
					{@const active = preset === p.id}
					<button
						type="button"
						onclick={() => setPreset(p.id)}
						aria-pressed={active}
						class="flex items-start gap-3 rounded-xl border p-4 text-left transition-all"
						style={active
							? 'border-color: var(--color-primary); background-color: var(--color-accent)'
							: 'border-color: var(--color-border); background-color: var(--color-background)'}
					>
						<span class="flex shrink-0 rounded overflow-hidden border mt-0.5" style="border-color: var(--color-border)" aria-hidden="true">
							<span style="background: {p.preview.bg}; width: 13px; height: 26px; display: block"></span>
							<span style="background: {p.preview.fg}; width: 13px; height: 26px; display: block"></span>
							<span style="background: {p.preview.accent}; width: 13px; height: 26px; display: block"></span>
						</span>
						<span class="min-w-0">
							<span class="flex items-center gap-1.5 text-sm font-semibold" style="color: var(--color-foreground)">
								{p.label}
								{#if active}<Check size={13} strokeWidth={3} style="color: var(--color-primary)" aria-hidden="true" />{/if}
							</span>
							<span class="block text-xs mt-0.5" style="color: var(--color-muted-foreground)">{p.description}</span>
						</span>
					</button>
				{/each}
			</div>
		</div>

		<!-- Interface font -->
		<div class="rounded-xl border p-4 md:p-6" style="background-color: var(--color-card); border-color: var(--color-border)">
			<div class="flex items-center gap-2 mb-1">
				<Type size={16} style="color: var(--color-primary)" aria-hidden="true" />
				<h4 class="font-semibold" style="color: var(--color-foreground)">Interface Font</h4>
			</div>
			<p class="text-sm mb-5" style="color: var(--color-muted-foreground)">Typeface for the app interface. “Preset default” uses whatever the active brand preset ships.</p>

			<div class="flex flex-wrap gap-3">
				{#each FONTS as f}
					{@const active = font === f.id}
					<button
						type="button"
						onclick={() => setFont(f.id)}
						aria-pressed={active}
						class="px-4 py-2.5 rounded-xl border text-sm transition-all"
						style="font-family: {f.stack}; {active
							? 'border-color: var(--color-primary); background-color: var(--color-accent); color: var(--color-primary); font-weight: 600'
							: 'border-color: var(--color-border); background-color: var(--color-background); color: var(--color-muted-foreground)'}"
					>
						{f.label}
					</button>
				{/each}
			</div>
		</div>

		{#if !activePreset.hueLocked}
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
		{:else}
		<p class="text-xs px-1" style="color: var(--color-muted-foreground)">
			The {activePreset.label} preset defines its own colour palette, so the highlight colour picker is hidden. Switch back to the Yield preset to choose a custom hue.
		</p>
		{/if}

		<!-- Branding: app name + favicon overrides -->
		<div class="rounded-xl border p-4 md:p-6" style="background-color: var(--color-card); border-color: var(--color-border)">
			<div class="flex items-center gap-2 mb-1">
				<Sparkles size={16} style="color: var(--color-primary)" aria-hidden="true" />
				<h4 class="font-semibold" style="color: var(--color-foreground)">Branding</h4>
			</div>
			<p class="text-sm mb-5" style="color: var(--color-muted-foreground)">
				Rename the app, upload your own logo for the sidebar and login screen, and swap the browser-tab icon. Leave blank to keep the Yield defaults.
			</p>

			<!-- App name -->
			<FormAlert message={form?.appNameError ?? null} class="mb-3" />
			<form
				method="POST"
				action="?/saveAppName"
				class="flex items-end gap-2 mb-6"
				use:enhance={() => {
					appNameSaving = true;
					return async ({ update, result }) => {
						appNameSaving = false;
						await update({ reset: false });
						if (result.type === 'success') {
							appNameSaved = appNameValue;
							addToast('App name saved');
						} else if (result.type === 'failure') {
							addToast((result.data as any)?.appNameError ?? 'Failed to save app name', 'error');
						}
					};
				}}
			>
				<div class="flex flex-col gap-1 flex-1 max-w-xs">
					<label for="app-name" class="text-xs font-medium" style="color: var(--color-muted-foreground)">App Name</label>
					<input
						id="app-name"
						name="app_name"
						type="text"
						maxlength="40"
						placeholder="Yield"
						bind:value={appNameValue}
						class="px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2"
						style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
					/>
				</div>
				<button
					type="submit"
					disabled={appNameSaving || !appNameDirty}
					class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all"
					style={appNameDirty && !appNameSaving
						? 'background-color: var(--color-primary); color: var(--color-primary-foreground)'
						: 'background-color: var(--color-muted); color: var(--color-muted-foreground); opacity: 0.7'}
				>
					<Save size={14} aria-hidden="true" />
					{appNameSaving ? 'Saving…' : 'Save'}
				</button>
			</form>

			<!-- App logo (UI chrome — distinct from the invoice/PDF logo) -->
			<FormAlert message={appLogoError || null} class="mb-3" />
			<div class="flex flex-wrap items-end gap-3 mb-6">
				{#if data.appLogoUrl}
					<div class="p-2 rounded-lg border inline-flex self-center" style="border-color: var(--color-border); background: var(--color-muted)">
						<img src={data.appLogoUrl} alt="App logo preview" style="height:32px;max-width:120px;object-fit:contain;display:block;" />
					</div>
				{/if}
				<form
					method="POST"
					action="?/saveAppLogo"
					enctype="multipart/form-data"
					use:enhance={() => {
						appLogoUploading = true;
						appLogoError = '';
						return async ({ update, result }) => {
							appLogoUploading = false;
							appLogoFile = null;
							await update();
							if (result.type === 'success') {
								addToast('App logo saved');
							} else if (result.type === 'failure') {
								appLogoError = (result.data as any)?.appLogoError ?? 'Failed to save app logo';
							}
						};
					}}
					class="flex items-end gap-2"
				>
					<div class="flex flex-col gap-1">
						<label for="app-logo-upload" class="text-xs font-medium" style="color: var(--color-muted-foreground)">{data.appLogoUrl ? 'Replace app logo' : 'Upload app logo'}</label>
						<input
							id="app-logo-upload"
							name="app_logo"
							type="file"
							accept="image/png,image/svg+xml,image/jpeg,image/webp,image/gif"
							onchange={(e) => { appLogoFile = (e.target as HTMLInputElement).files?.[0] ?? null; }}
							class="text-sm rounded-lg border px-2 py-1.5 file:mr-2 file:rounded file:border-0 file:px-2 file:py-1 file:text-xs file:font-medium"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						/>
					</div>
					<button
						type="submit"
						disabled={appLogoUploading || !appLogoFile}
						class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all"
						style={appLogoFile && !appLogoUploading
							? 'background-color: var(--color-primary); color: var(--color-primary-foreground)'
							: 'background-color: var(--color-muted); color: var(--color-muted-foreground); opacity: 0.7'}
					>
						<FileUp size={14} aria-hidden="true" />
						{appLogoUploading ? 'Uploading…' : 'Upload'}
					</button>
				</form>

				{#if data.appLogoUrl}
					<form
						method="POST"
						action="?/removeAppLogo"
						use:enhance={() => {
							appLogoRemoving = true;
							appLogoError = '';
							return async ({ update, result }) => {
								appLogoRemoving = false;
								await update();
								if (result.type === 'success') {
									addToast('App logo removed');
								} else if (result.type === 'failure') {
									appLogoError = (result.data as any)?.appLogoError ?? 'Failed to remove app logo';
								}
							};
						}}
					>
						<button
							type="submit"
							disabled={appLogoRemoving}
							class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-all"
							style="border-color: var(--color-border); color: var(--color-muted-foreground); background: var(--color-background)"
						>
							<X size={13} aria-hidden="true" />
							{appLogoRemoving ? 'Removing…' : 'Remove app logo'}
						</button>
					</form>
				{/if}
			</div>
			<p class="text-xs -mt-4 mb-6" style="color: var(--color-muted-foreground)">Shown in the sidebar and on the sign-in page. Without one, the active preset's built-in mark is used. SVG, PNG, or WebP up to 1 MB.</p>

			<!-- Favicon -->
			<FormAlert message={faviconError || null} class="mb-3" />
			<div class="flex flex-wrap items-end gap-3">
				{#if data.faviconUrl}
					<div class="p-2 rounded-lg border inline-flex self-center" style="border-color: var(--color-border); background: var(--color-muted)">
						<img src={data.faviconUrl} alt="Favicon preview" style="width:24px;height:24px;object-fit:contain;display:block;" />
					</div>
				{/if}
				<form
					method="POST"
					action="?/saveFavicon"
					enctype="multipart/form-data"
					use:enhance={() => {
						faviconUploading = true;
						faviconError = '';
						return async ({ update, result }) => {
							faviconUploading = false;
							faviconFile = null;
							await update();
							if (result.type === 'success') {
								addToast('Favicon saved');
							} else if (result.type === 'failure') {
								faviconError = (result.data as any)?.faviconError ?? 'Failed to save favicon';
							}
						};
					}}
					class="flex items-end gap-2"
				>
					<div class="flex flex-col gap-1">
						<label for="favicon-upload" class="text-xs font-medium" style="color: var(--color-muted-foreground)">{data.faviconUrl ? 'Replace favicon' : 'Upload favicon'}</label>
						<input
							id="favicon-upload"
							name="favicon"
							type="file"
							accept="image/png,image/svg+xml,image/x-icon,image/vnd.microsoft.icon,image/jpeg,image/webp,image/gif"
							onchange={(e) => { faviconFile = (e.target as HTMLInputElement).files?.[0] ?? null; }}
							class="text-sm rounded-lg border px-2 py-1.5 file:mr-2 file:rounded file:border-0 file:px-2 file:py-1 file:text-xs file:font-medium"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						/>
					</div>
					<button
						type="submit"
						disabled={faviconUploading || !faviconFile}
						class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all"
						style={faviconFile && !faviconUploading
							? 'background-color: var(--color-primary); color: var(--color-primary-foreground)'
							: 'background-color: var(--color-muted); color: var(--color-muted-foreground); opacity: 0.7'}
					>
						<FileUp size={14} aria-hidden="true" />
						{faviconUploading ? 'Uploading…' : 'Upload'}
					</button>
				</form>

				{#if data.faviconUrl}
					<form
						method="POST"
						action="?/removeFavicon"
						use:enhance={() => {
							faviconRemoving = true;
							faviconError = '';
							return async ({ update, result }) => {
								faviconRemoving = false;
								await update();
								if (result.type === 'success') {
									addToast('Favicon removed');
								} else if (result.type === 'failure') {
									faviconError = (result.data as any)?.faviconError ?? 'Failed to remove favicon';
								}
							};
						}}
					>
						<button
							type="submit"
							disabled={faviconRemoving}
							class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-all"
							style="border-color: var(--color-border); color: var(--color-muted-foreground); background: var(--color-background)"
						>
							<X size={13} aria-hidden="true" />
							{faviconRemoving ? 'Removing…' : 'Remove favicon'}
						</button>
					</form>
				{/if}
			</div>
			<p class="text-xs mt-3" style="color: var(--color-muted-foreground)">Square images work best — PNG, SVG, or ICO up to 1 MB.</p>
		</div>

		<!-- Custom CSS (advanced) -->
		<div class="rounded-xl border p-4 md:p-6" style="background-color: var(--color-card); border-color: var(--color-border)">
			<div class="flex items-center gap-2 mb-1">
				<Code size={16} style="color: var(--color-primary)" aria-hidden="true" />
				<h4 class="font-semibold" style="color: var(--color-foreground)">Custom CSS</h4>
			</div>
			<p class="text-sm mb-4" style="color: var(--color-muted-foreground)">
				Advanced: appended after the app's stylesheets on every page. Override design tokens like
				<code class="font-mono text-xs">--color-primary</code> or <code class="font-mono text-xs">--font-sans</code>
				for a full rebrand beyond what the presets offer. Leave empty for none.
			</p>
			<FormAlert message={form?.customCssError ?? null} class="mb-3" />
			<form
				method="POST"
				action="?/saveCustomCss"
				use:enhance={() => {
					customCssSaving = true;
					return async ({ update, result }) => {
						customCssSaving = false;
						await update({ reset: false });
						if (result.type === 'success') {
							customCssSaved = customCss;
							addToast('Custom CSS saved — reload to see it applied');
						} else if (result.type === 'failure') {
							addToast((result.data as any)?.customCssError ?? 'Failed to save custom CSS', 'error');
						}
					};
				}}
			>
				<textarea
					name="brand_custom_css"
					rows="8"
					maxlength="20000"
					spellcheck="false"
					bind:value={customCss}
					placeholder={`:root[data-theme] {\n\t--color-primary: #c93a0d;\n}`}
					class="w-full rounded-lg border px-3 py-2 text-xs font-mono outline-none focus:ring-2"
					style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
				></textarea>
				<div class="mt-3">
					<button
						type="submit"
						disabled={customCssSaving || !customCssDirty}
						class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all"
						style={customCssDirty && !customCssSaving
							? 'background-color: var(--color-primary); color: var(--color-primary-foreground)'
							: 'background-color: var(--color-muted); color: var(--color-muted-foreground); opacity: 0.7'}
					>
						<Save size={14} aria-hidden="true" />
						{customCssSaving ? 'Saving…' : 'Save CSS'}
					</button>
				</div>
			</form>
		</div>
	</section>

	<!-- ════════════════════════════════════════════════════════
	     COMPANY
	     ════════════════════════════════════════════════════════ -->
	<section id="company" class="scroll-mt-6 space-y-6">
		<h3 class="text-base font-semibold" style="color: var(--color-foreground)">Company</h3>

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
							class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline focus-visible:outline-offset-2"
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
	</section>

	<!-- ════════════════════════════════════════════════════════
	     INVOICES
	     ════════════════════════════════════════════════════════ -->
	<section id="invoices" class="scroll-mt-6 space-y-6">
		<h3 class="text-base font-semibold" style="color: var(--color-foreground)">Invoices</h3>

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

		<!-- Estimate Numbering -->
		<div class="rounded-xl border p-4 md:p-6" style="background-color: var(--color-card); border-color: var(--color-border)">
			<div class="flex items-center gap-2 mb-1">
				<Hash size={16} style="color: var(--color-primary)" aria-hidden="true" />
				<h4 class="font-semibold" style="color: var(--color-foreground)">Estimate Numbering</h4>
			</div>
			<p class="text-sm mb-5" style="color: var(--color-muted-foreground)">
				Use <code class="font-mono text-xs">{'{number}'}</code> as the counter placeholder — e.g. <code class="font-mono text-xs">EST-{'{number}'}</code> produces <code class="font-mono text-xs">EST-42</code>.
			</p>
			<form
				method="POST"
				action="?/saveEstimateNumbering"
				class="space-y-4"
				use:enhance={() => {
					estNumberingSaving = true;
					return async ({ update, result }) => {
						estNumberingSaving = false;
						await update({ reset: false });
						if (result.type === 'success') {
							estNumberingSaved = { format: estimateNumberFormat, next: estimateNextNumber };
							addToast('Estimate numbering saved');
						} else if (result.type === 'failure') {
							addToast((result.data as any)?.estimateNumberingError ?? 'Failed to save', 'error');
						}
					};
				}}
			>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div class="flex flex-col gap-1">
						<label for="estimate-number-format" class="text-xs font-medium" style="color: var(--color-muted-foreground)">Number Format</label>
						<input
							id="estimate-number-format"
							name="estimate_number_format"
							type="text"
							placeholder="EST-{'{number}'}"
							bind:value={estimateNumberFormat}
							class="w-full px-3 py-2 rounded-lg border text-sm font-mono"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						/>
					</div>
					<div class="flex flex-col gap-1">
						<label for="estimate-next-number" class="text-xs font-medium inline-flex items-center" style="color: var(--color-muted-foreground)">Next Number <Tip tip="Increments automatically when an estimate is created." /></label>
						<input
							id="estimate-next-number"
							name="estimate_next_number"
							type="number"
							min="1"
							step="1"
							bind:value={estimateNextNumber}
							class="w-full px-3 py-2 rounded-lg border text-sm"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						/>
					</div>
				</div>
				<div class="text-sm px-3 py-1.5 rounded-md inline-flex" style="background: var(--color-muted); color: var(--color-muted-foreground)">
					Preview: <span class="font-mono font-semibold ml-2" style="color: var(--color-foreground)">{(estimateNumberFormat || 'EST-{number}').replace('{number}', String(estimateNextNumber || 1))}</span>
				</div>
				<div class="flex justify-end pt-1">
					<button
						type="submit"
						disabled={estNumberingSaving}
						class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
						style={estNumberingDirty
							? 'background-color: var(--color-primary); color: var(--color-primary-foreground)'
							: 'background-color: var(--color-muted); color: var(--color-muted-foreground); opacity: 0.6'}
					>
						<Save size={14} aria-hidden="true" />
						{estNumberingSaving ? 'Saving…' : 'Save'}
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
							min="0" step="0.25"
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

		<!-- Payment Reminders -->
		<div class="rounded-xl border p-4 md:p-6" style="background-color: var(--color-card); border-color: var(--color-border)">
			<div class="flex items-center gap-2 mb-1">
				<BellRing size={16} style="color: var(--color-primary)" aria-hidden="true" />
				<h4 class="font-semibold" style="color: var(--color-foreground)">Payment Reminders</h4>
			</div>
			<p class="text-sm mb-5" style="color: var(--color-muted-foreground)">
				Invoices past their due date are marked overdue automatically. Optionally email the client a
				reminder — the first goes out once the invoice is overdue, then repeats until it's paid.
				Invoices more than 6 months past due are never emailed.
			</p>

			<FormAlert message={form?.remindersError ?? null} class="mb-4" />

			<form
				method="POST"
				action="?/saveReminders"
				class="space-y-4"
				use:enhance={() => {
					remindersSaving = true;
					return async ({ update, result }) => {
						remindersSaving = false;
						await update({ reset: false });
						if (result.type === 'success') addToast('Reminder settings saved');
						else if (result.type === 'failure') addToast((result.data as any)?.remindersError ?? 'Failed to save reminder settings', 'error');
					};
				}}
			>
				<input type="hidden" name="reminders_enabled" value={remindersEnabled ? 'on' : 'off'} />
				<div class="flex items-center gap-3">
					<button
						id="reminders-enabled"
						type="button"
						role="switch"
						aria-label="Send automatic payment reminders"
						aria-checked={remindersEnabled}
						onclick={() => remindersEnabled = !remindersEnabled}
						class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors"
						style={remindersEnabled
							? 'background-color: var(--color-primary)'
							: 'background-color: var(--color-muted)'}
					>
						<span
							aria-hidden="true"
							class="pointer-events-none inline-block size-5 rounded-full shadow-sm ring-0 transition-transform"
							style="background-color: white; transform: translateX({remindersEnabled ? '20px' : '0px'})"
						></span>
					</button>
					<label for="reminders-enabled" class="text-sm cursor-pointer" style="color: var(--color-foreground)">Email clients about overdue invoices</label>
				</div>

				<div class="flex items-center gap-2 max-w-xs">
					<label for="reminder-days" class="text-sm" style="color: var(--color-foreground)">Repeat every</label>
					<input
						id="reminder-days"
						name="reminder_days"
						type="number"
						min="1"
						max="90"
						bind:value={reminderDays}
						disabled={!remindersEnabled}
						class="w-20 px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 font-mono disabled:opacity-40"
						style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
					/>
					<span class="text-sm" style="color: var(--color-foreground)">days</span>
				</div>

				<div>
					<button
						type="submit"
						disabled={remindersSaving}
						class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
						style="background-color: var(--color-primary); color: var(--color-primary-foreground)"
					>
						<Save size={14} aria-hidden="true" />
						{remindersSaving ? 'Saving…' : 'Save reminder settings'}
					</button>
				</div>
			</form>
		</div>

		<p class="text-xs" style="color: var(--color-muted-foreground)">
			These emails are delivered through the mail server configured in
			<a href="/settings/system#smtp" class="underline underline-offset-2" style="color: var(--color-primary)">System → SMTP</a>.
		</p>
	</section>

</div>
