<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { Sun, Moon, Monitor, Check, Lock, Save, Palette, Building2, FileText, Hash, Coins, Mail, Server, FileUp, Image, X } from 'lucide-svelte';
	import Tip from '$lib/components/Tip.svelte';
	import RichTextarea from '$lib/components/RichTextarea.svelte';
	import FormAlert from '$lib/components/FormAlert.svelte';
	import { addToast } from '$lib/toasts.svelte.js';
	import type { PageData, ActionData } from './$types.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	type Theme = 'light' | 'system' | 'dark';

	let current = $state<Theme>(
		data.smtp?.brand_theme as Theme
			?? ((typeof localStorage !== 'undefined'
				? (localStorage.getItem('yield-theme') as Theme)
				: null) ?? 'system')
	);

	function setTheme(t: Theme) {
		current = t;
		localStorage.setItem('yield-theme', t);
		document.documentElement.setAttribute('data-theme', t);
		// Persist to DB immediately
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

	// ── Global save state ─────────────────────────────────────────────────
	let saving = $state(false);

	// Field state (fed into the single global form)
	let taxPercent      = $state<number>(untrack(() => data.smtp?.default_tax_percent ?? 5));
	let incomeTaxRate   = $state<number>(untrack(() => data.smtp?.income_tax_rate ?? 0));
	let defaultHourlyRate = $state<number>(untrack(() => data.smtp?.default_hourly_rate ?? 0));
	let companyName     = $state(untrack(() => data.smtp?.company_name ?? ''));
	let companyAddress  = $state(untrack(() => data.smtp?.company_address ?? ''));
	let defaultNotes    = $state(untrack(() => data.smtp?.invoice_default_notes ?? ''));
	let invoiceFooter   = $state(untrack(() => data.smtp?.invoice_footer ?? ''));
	let invoiceNumberFormat = $state(untrack(() => data.smtp?.invoice_number_format ?? 'INV-{number}'));
	let invoiceNextNumber   = $state<number>(untrack(() => data.smtp?.invoice_next_number ?? 1));
	let emailSubject    = $state(untrack(() => data.smtp?.email_subject ?? ''));
	let emailBody       = $state(untrack(() => data.smtp?.email_body ?? ''));
	let hideCompanyName = $state<boolean>(untrack(() => data.smtp?.logo_hide_company_name ?? false));
	let showPass        = $state(false);

	// ── Logo upload state ─────────────────────────────────────────────────
	let logoUploading   = $state(false);
	let logoRemoving    = $state(false);
	let logoError       = $state('');
	let logoFile        = $state<File | null>(null);

	const currencies = ['CAD', 'USD', 'EUR', 'GBP', 'AUD', 'NZD', 'CHF', 'JPY', 'MXN', 'BRL'];
	let defaultCurrency = $state(untrack(() => data.smtp?.default_currency ?? 'CAD'));

	// SMTP field state (bound so dirty-tracking works)
	let smtpHost      = $state(untrack(() => data.smtp?.smtp_host ?? ''));
	let smtpPort      = $state<number>(untrack(() => data.smtp?.smtp_port || 587));
	let smtpUser      = $state(untrack(() => data.smtp?.smtp_user ?? ''));
	let smtpPass      = $state(untrack(() => data.smtp?.smtp_pass ?? ''));
	let smtpFromName  = $state(untrack(() => data.smtp?.smtp_from_name ?? ''));
	let smtpFromEmail = $state(untrack(() => data.smtp?.smtp_from_email ?? ''));
	let smtpSecure    = $state(untrack(() => data.smtp?.smtp_secure ?? false));

	// ── Dirty tracking ────────────────────────────────────────────────────
	let snapshot = $state(untrack(() => ({
		taxPercent:           data.smtp?.default_tax_percent ?? 5,
		incomeTaxRate:        data.smtp?.income_tax_rate ?? 0,
		defaultHourlyRate:    data.smtp?.default_hourly_rate ?? 0,
		companyName:          data.smtp?.company_name ?? '',
		companyAddress:       data.smtp?.company_address ?? '',
		defaultNotes:         data.smtp?.invoice_default_notes ?? '',
		invoiceFooter:        data.smtp?.invoice_footer ?? '',
		invoiceNumberFormat:  data.smtp?.invoice_number_format ?? 'INV-{number}',
		invoiceNextNumber:    data.smtp?.invoice_next_number ?? 1,
		emailSubject:         data.smtp?.email_subject ?? '',
		emailBody:            data.smtp?.email_body ?? '',
		defaultCurrency:      data.smtp?.default_currency ?? 'CAD',
		smtpHost:             data.smtp?.smtp_host ?? '',
		smtpPort:             data.smtp?.smtp_port || 587,
		smtpUser:             data.smtp?.smtp_user ?? '',
		smtpPass:             data.smtp?.smtp_pass ?? '',
		smtpFromName:         data.smtp?.smtp_from_name ?? '',
		smtpFromEmail:        data.smtp?.smtp_from_email ?? '',
		smtpSecure:           data.smtp?.smtp_secure ?? false,
		hideCompanyName:      data.smtp?.logo_hide_company_name ?? false,
		brandTheme:           (data.smtp?.brand_theme as Theme) ?? 'system',
	})));

	let isDirty = $derived(
		taxPercent          !== snapshot.taxPercent          ||
		incomeTaxRate       !== snapshot.incomeTaxRate       ||
		defaultHourlyRate   !== snapshot.defaultHourlyRate   ||
		companyName         !== snapshot.companyName         ||
		companyAddress      !== snapshot.companyAddress      ||
		defaultNotes        !== snapshot.defaultNotes        ||
		invoiceFooter       !== snapshot.invoiceFooter       ||
		invoiceNumberFormat !== snapshot.invoiceNumberFormat ||
		invoiceNextNumber   !== snapshot.invoiceNextNumber   ||
		emailSubject        !== snapshot.emailSubject        ||
		emailBody           !== snapshot.emailBody           ||
		defaultCurrency     !== snapshot.defaultCurrency     ||
		smtpHost            !== snapshot.smtpHost            ||
		smtpPort            !== snapshot.smtpPort            ||
		smtpUser            !== snapshot.smtpUser            ||
		smtpPass            !== snapshot.smtpPass            ||
		smtpFromName        !== snapshot.smtpFromName        ||
		smtpFromEmail       !== snapshot.smtpFromEmail       ||
		smtpSecure          !== snapshot.smtpSecure          ||
		hideCompanyName     !== snapshot.hideCompanyName     ||
		current             !== snapshot.brandTheme
	);

	function markClean() {
		snapshot = {
			taxPercent, incomeTaxRate, defaultHourlyRate, companyName, companyAddress,
			defaultNotes, invoiceFooter, invoiceNumberFormat, invoiceNextNumber,
			emailSubject, emailBody, defaultCurrency,
			smtpHost, smtpPort, smtpUser, smtpPass, smtpFromName, smtpFromEmail, smtpSecure,
			hideCompanyName,
			brandTheme: current,
		};
	}

	// ── Security / import / reset state ───────────────────────────────────
	let passwordSaving = $state(false);
	let showNewPass    = $state(false);
	let testSending    = $state(false);
	let testTo         = $state('');
	let importing      = $state(false);
	let importOpen     = $state(false);
	let resetOpen      = $state(false);
	let resetting      = $state(false);
	let resetCheck1    = $state(false);
	let resetCheck2    = $state(false);
	let resetCheck3    = $state(false);
	let resetReady     = $derived(resetCheck1 && resetCheck2 && resetCheck3);

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
		// Persist to DB silently so the PDF generator picks it up
		fetch('?/saveAppearance', {
			method: 'POST',
			body: new URLSearchParams({ brand_hue: String(h), brand_theme: current })
		}).catch(() => { /* ignore */ });
	}

	// ── Scrollspy ─────────────────────────────────────────────────────────
	type Section = 'appearance' | 'invoices' | 'email' | 'security';
	const sections: { id: Section; label: string }[] = [
		{ id: 'appearance', label: 'Appearance' },
		{ id: 'invoices',   label: 'Invoices' },
		{ id: 'email',      label: 'Email' },
		{ id: 'security',   label: 'Security & Data' }
	];
	let activeSection = $state<Section>('appearance');

	$effect(() => {
		const observers = sections.map(({ id }) => {
			const el = document.getElementById(id);
			if (!el) return null;
			const obs = new IntersectionObserver(
				([entry]) => { if (entry.isIntersecting) activeSection = id as Section; },
				{ rootMargin: '-15% 0px -75% 0px' }
			);
			obs.observe(el);
			return obs;
		});

		// When scrolled to the bottom, force the last section active
		function onScroll() {
			if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 80) {
				activeSection = sections[sections.length - 1].id;
			}
		}
		window.addEventListener('scroll', onScroll, { passive: true });

		return () => {
			observers.forEach(o => o?.disconnect());
			window.removeEventListener('scroll', onScroll);
		};
	});

	function scrollTo(id: Section) {
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
</script>

<svelte:head>
	<title>Settings — Yield</title>
</svelte:head>

<!-- ── Hidden global-save form (inputs are associated via form= attr) ── -->
<form
	id="settings-form"
	method="POST"
	action="?/saveAll"
	use:enhance={() => {
		saving = true;
		return async ({ update, result }) => {
			saving = false;
			await update({ reset: false });
			if (result.type === 'success') {
				markClean();
				addToast('Settings saved');
			} else if (result.type === 'failure') {
				addToast((result.data as any)?.saveAllError ?? 'Failed to save settings', 'error');
			}
		};
	}}
></form>

<div class="max-w-5xl mx-auto">

	<!-- ── Page header ──────────────────────────────────────────────── -->
	<div class="mb-6 flex items-start justify-between gap-4">
		<div>
			<h2 class="text-2xl font-bold" style="color: var(--color-foreground)">Settings</h2>
			<p class="mt-1 text-sm" style="color: var(--color-muted-foreground)">Manage preferences for Yield.</p>
		</div>
		<!-- Mobile save button (in header) -->
		<button
			type="submit"
			form="settings-form"
			disabled={saving || !isDirty}
			class="sm:hidden flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium shrink-0 transition-all"
			style={isDirty
				? 'background-color: var(--color-primary); color: var(--color-primary-foreground); opacity: 1'
				: 'background-color: var(--color-muted); color: var(--color-muted-foreground); opacity: 0.7'}
		>
			<Save size={14} aria-hidden="true" />
			{saving ? 'Saving…' : isDirty ? 'Save' : 'Saved'}
		</button>
	</div>

	<!-- ── Mobile sticky section tabs ───────────────────────────────── -->
	<div
		class="sm:hidden sticky top-0 z-30 -mx-4 px-4 py-2 mb-8 flex gap-1 overflow-x-auto border-b"
		style="background-color: var(--color-background); border-color: var(--color-border)"
	>
		{#each sections as s}
			<button
				type="button"
				onclick={() => scrollTo(s.id)}
				class="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
				style={activeSection === s.id
					? 'background-color: var(--color-accent); color: var(--color-primary)'
					: 'color: var(--color-muted-foreground)'}
			>{s.label}</button>
		{/each}
	</div>

	<!-- ── Layout: sticky sidebar (sm+) + scrolling content ─────────── -->
	<div class="sm:grid sm:grid-cols-[200px_1fr] sm:gap-10">

		<!-- Floating sidebar (desktop only) -->
		<aside
			class="hidden sm:flex sm:flex-col sticky top-6 h-fit gap-0.5 rounded-2xl border p-3"
			style="background-color: var(--color-card); border-color: var(--color-border); box-shadow: 0 4px 24px -4px color-mix(in srgb, var(--color-foreground) 8%, transparent)"
		>
			{#each sections as s}
				<button
					type="button"
					onclick={() => scrollTo(s.id)}
					class="w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors"
					style={activeSection === s.id
						? 'background-color: var(--color-accent); color: var(--color-primary)'
						: 'color: var(--color-muted-foreground)'}
				>{s.label}</button>
			{/each}
			<div class="pt-2 mt-1 border-t" style="border-color: var(--color-border)">
				<button
					type="submit"
					form="settings-form"
					disabled={saving || !isDirty}
					class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
					style={isDirty
						? 'background-color: var(--color-primary); color: var(--color-primary-foreground)'
						: 'background-color: transparent; color: var(--color-muted-foreground); cursor: default'}
				>
					{#if saving}
						<Save size={14} aria-hidden="true" />
						Saving…
					{:else if isDirty}
						<span class="relative flex size-2 shrink-0">
							<span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style="background-color: var(--color-primary-foreground)"></span>
							<span class="relative inline-flex rounded-full size-2" style="background-color: var(--color-primary-foreground)"></span>
						</span>
						Save changes
					{:else}
						<Check size={14} aria-hidden="true" />
						Up to date
					{/if}
				</button>
			</div>
		</aside>

		<!-- ── All settings sections ────────────────────────────────── -->
		<div class="space-y-14 pb-24">

			<!-- ════════════════════════════════════════════════════════
			     APPEARANCE
			     ════════════════════════════════════════════════════════ -->
			<section id="appearance" class="scroll-mt-6 space-y-6">
				<h3 class="text-base font-semibold" style="color: var(--color-foreground)">Appearance</h3>

				<!-- Theme -->
				<div class="rounded-xl border p-4 md:p-6" style="background-color: var(--color-card); border-color: var(--color-border)">
					<div class="flex items-center gap-2 mb-1">
						<Monitor size={16} style="color: var(--color-primary)" aria-hidden="true" />
						<h4 class="font-semibold" style="color: var(--color-foreground)">Theme</h4>
					</div>
					<p class="text-sm mb-5" style="color: var(--color-muted-foreground)">Choose how Yield looks to you.</p>

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

				<!-- Hidden field for the global save form -->
				<input type="hidden" name="brand_theme" value={current} form="settings-form" />

				<!-- Highlight colour -->
				<div class="rounded-xl border p-4 md:p-6" style="background-color: var(--color-card); border-color: var(--color-border)">
					<div class="flex items-center gap-2 mb-1">
						<Palette size={16} style="color: var(--color-primary)" aria-hidden="true" />
						<h4 class="font-semibold" style="color: var(--color-foreground)">Highlight Colour</h4>
					</div>
					<p class="text-sm mb-5" style="color: var(--color-muted-foreground)">Accent colour used throughout the interface and on invoice PDFs.</p>

					<!-- Hidden field associated with global save form -->
					<input type="hidden" name="brand_hue" value={hue} form="settings-form" />

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
					<div class="space-y-4">
						<div class="flex flex-col gap-1">
							<label for="company-name" class="text-xs font-medium" style="color: var(--color-muted-foreground)">Name / Company</label>
							<input
								id="company-name"
								name="company_name"
								type="text"
								placeholder="e.g. Acme Corp or Jane Smith"
								bind:value={companyName}
								form="settings-form"
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
								form="settings-form"
								class="w-full px-3 py-2 rounded-lg border text-sm resize-none"
								style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
							/>
						</div>
					</div>
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

						<!-- Hide company name toggle — only shown when a logo is uploaded -->
						<label class="flex items-center gap-2.5 mb-5 cursor-pointer w-fit">
							<input
								type="checkbox"
								name="logo_hide_company_name"
								bind:checked={hideCompanyName}
								form="settings-form"
								class="rounded border"
								style="accent-color: var(--color-primary); width:15px; height:15px;"
							/>
							<span class="text-sm" style="color: var(--color-foreground)">Hide company name on PDFs</span>
							<Tip tip="Use this when your logo already contains your company name, to avoid showing it twice on invoices." />
						</label>
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
					<div class="space-y-4">
						<div class="flex flex-col gap-1">
							<label for="default-notes" class="text-xs font-medium inline-flex items-center" style="color: var(--color-muted-foreground)">Default Notes <Tip tip="Pre-filled in the Notes field when creating a new invoice. Editable per invoice." /></label>
							<RichTextarea
								id="default-notes"
								name="invoice_default_notes"
								rows={3}
								placeholder="e.g. Payment due within 30 days. Thank you for your business!"
								bind:value={defaultNotes}
								form="settings-form"
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
								form="settings-form"
								class="w-full px-3 py-2 rounded-lg border text-sm resize-none font-mono"
								style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
							/>
						</div>
					</div>
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
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div class="flex flex-col gap-1">
							<label for="invoice-number-format" class="text-xs font-medium" style="color: var(--color-muted-foreground)">Number Format</label>
							<input
								id="invoice-number-format"
								name="invoice_number_format"
								type="text"
								placeholder="INV-{'{number}'}"
								bind:value={invoiceNumberFormat}
								form="settings-form"
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
								form="settings-form"
								class="w-full px-3 py-2 rounded-lg border text-sm"
								style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
							/>
						</div>
					</div>
					<div class="mt-3 text-sm px-3 py-1.5 rounded-md inline-flex" style="background: var(--color-muted); color: var(--color-muted-foreground)">
						Preview: <span class="font-mono font-semibold ml-2" style="color: var(--color-foreground)">{(invoiceNumberFormat || 'INV-{number}').replace('{number}', String(invoiceNextNumber || 1))}</span>
					</div>
				</div>

				<!-- Tax & Currency -->
				<div class="rounded-xl border p-4 md:p-6" style="background-color: var(--color-card); border-color: var(--color-border)">
					<div class="flex items-center gap-2 mb-1">
						<Coins size={16} style="color: var(--color-primary)" aria-hidden="true" />
						<h4 class="font-semibold" style="color: var(--color-foreground)">Tax & Currency</h4>
					</div>
					<p class="text-sm mb-5" style="color: var(--color-muted-foreground)">Defaults applied when creating new invoices and clients. Existing records are not affected.</p>
					<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
						<div class="flex flex-col gap-1">
							<label for="default_currency" class="text-xs font-medium" style="color: var(--color-muted-foreground)">Default Currency</label>
							<select
								id="default_currency"
								name="default_currency"
								bind:value={defaultCurrency}
								form="settings-form"
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
								form="settings-form"
								class="w-full px-3 py-2 rounded-lg border text-sm font-mono"
								style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
							/>
						</div>
						<div class="flex flex-col gap-1">
							<label for="income-tax-rate" class="text-xs font-medium inline-flex items-center" style="color: var(--color-muted-foreground)">Income Tax Rate (%) <Tip tip="Your personal rate used in Tax Reports. Not applied to invoice totals." /></label>
							<input
								id="income-tax-rate"
								name="income_tax_rate"
								type="number"
								min="0" max="100" step="0.1"
								bind:value={incomeTaxRate}
								form="settings-form"
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
								form="settings-form"
								class="w-full px-3 py-2 rounded-lg border text-sm font-mono"
								style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
							/>
						</div>
					</div>
				</div>
			</section>

			<!-- ════════════════════════════════════════════════════════
			     EMAIL
			     ════════════════════════════════════════════════════════ -->
			<section id="email" class="scroll-mt-6 space-y-6">
				<h3 class="text-base font-semibold" style="color: var(--color-foreground)">Email</h3>

				<!-- Email template -->
				<div class="rounded-xl border p-4 md:p-6" style="background-color: var(--color-card); border-color: var(--color-border)">
					<div class="flex items-center gap-2 mb-1">
						<Mail size={16} style="color: var(--color-primary)" aria-hidden="true" />
						<h4 class="font-semibold" style="color: var(--color-foreground)">Email Template</h4>
					</div>
					<p class="text-sm mb-1" style="color: var(--color-muted-foreground)">Boilerplate used when sending invoices. Leave blank to use the built-in defaults.</p>
					<p class="text-xs mb-5" style="color: var(--color-muted-foreground)">
						Placeholders: <code class="font-mono">{'{invoice_number}'}</code> <code class="font-mono">{'{client_name}'}</code> <code class="font-mono">{'{total}'}</code> <code class="font-mono">{'{due_date}'}</code> <code class="font-mono">{'{issue_date}'}</code> <code class="font-mono">{'{company_name}'}</code>
					</p>
					<div class="space-y-4">
						<div class="flex flex-col gap-1">
							<label for="email-subject" class="text-xs font-medium" style="color: var(--color-muted-foreground)">Subject</label>
							<input
								id="email-subject"
								name="email_subject"
								type="text"
								bind:value={emailSubject}
								placeholder={data.DEFAULT_EMAIL_SUBJECT}
								form="settings-form"
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
								form="settings-form"
								class="w-full px-3 py-2 rounded-lg border text-sm resize-none font-mono"
								style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
							/>
						</div>
					</div>
				</div>

				<!-- SMTP -->
				<div class="rounded-xl border p-4 md:p-6" style="background-color: var(--color-card); border-color: var(--color-border)">
					<div class="flex items-center gap-2 mb-1">
						<Server size={16} style="color: var(--color-primary)" aria-hidden="true" />
						<h4 class="font-semibold" style="color: var(--color-foreground)">SMTP</h4>
					</div>
					<p class="text-sm mb-5" style="color: var(--color-muted-foreground)">Configure a third-party SMTP service to send invoices directly to clients.</p>

					<div class="space-y-4">
						<!-- host + port -->
						<div class="grid grid-cols-3 gap-3">
							<div class="col-span-2 flex flex-col gap-1">
								<label for="smtp-host" class="text-xs font-medium" style="color: var(--color-muted-foreground)">SMTP Host</label>
								<input
									id="smtp-host"
									name="smtp_host"
									type="text"
									placeholder="smtp.example.com"
								bind:value={smtpHost}
									form="settings-form"
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
									min="1" max="65535"
									placeholder="587"
								bind:value={smtpPort}
									form="settings-form"
									class="px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 font-mono"
									style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
								/>
							</div>
						</div>

						<!-- user + pass -->
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
							<div class="flex flex-col gap-1">
								<label for="smtp-user" class="text-xs font-medium" style="color: var(--color-muted-foreground)">Username / API key</label>
								<input
									id="smtp-user"
									name="smtp_user"
									type="text"
									autocomplete="off"
									placeholder="user@example.com"
								bind:value={smtpUser}
									form="settings-form"
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
									bind:value={smtpPass}
										form="settings-form"
										class="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 pr-16"
										style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
									/>
									<button
										type="button"
										onclick={() => (showPass = !showPass)}
										class="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-1.5 py-0.5 rounded"
										style="color: var(--color-muted-foreground)"
									>{showPass ? 'Hide' : 'Show'}</button>
								</div>
							</div>
						</div>

						<!-- from name + from email -->
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
							<div class="flex flex-col gap-1">
								<label for="smtp-from-name" class="text-xs font-medium" style="color: var(--color-muted-foreground)">From Name</label>
								<input
									id="smtp-from-name"
									name="smtp_from_name"
									type="text"
									placeholder="Your Name or Company"
								bind:value={smtpFromName}
									form="settings-form"
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
								bind:value={smtpFromEmail}
									form="settings-form"
									class="px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2"
									style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
								/>
							</div>
						</div>

						<!-- SSL toggle -->
						<label class="flex items-center gap-2.5 text-sm cursor-pointer select-none" style="color: var(--color-foreground)">
							<input
								name="smtp_secure"
								type="checkbox"
								bind:checked={smtpSecure}
								form="settings-form"
								class="w-4 h-4 rounded"
								style="accent-color: var(--color-primary)"
							/>
							Use SSL/TLS (port 465)
						</label>
					</div>

					<!-- Test email (separate form — cannot nest inside global form) -->
					<div class="mt-6 pt-6 border-t" style="border-color: var(--color-border)">
						<h5 class="text-sm font-semibold mb-1" style="color: var(--color-foreground)">Send a test email</h5>
						<p class="text-xs mb-3" style="color: var(--color-muted-foreground)">Save your settings first, then enter an address to verify delivery.</p>

						<FormAlert message={form?.testSuccess ? 'Test email sent!' : null} variant="success" class="mb-3" />
						<FormAlert message={form?.testError} class="mb-3" />

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
			</section>

			<!-- ════════════════════════════════════════════════════════
			     SECURITY & DATA
			     ════════════════════════════════════════════════════════ -->
			<section id="security" class="scroll-mt-6 space-y-6">
				<h3 class="text-base font-semibold" style="color: var(--color-foreground)">Security & Data</h3>

				<!-- Password -->
				<div class="rounded-xl border p-4 md:p-6" style="background-color: var(--color-card); border-color: var(--color-border)">
					<div class="flex items-center gap-2 mb-1">
						<Lock size={16} style="color: var(--color-primary)" />
						<h4 class="font-semibold" style="color: var(--color-foreground)">Security</h4>
					</div>
					<p class="text-sm mb-1" style="color: var(--color-muted-foreground)">
						Protect access with a password. When set, all visitors must sign in before viewing the app.
					</p>
					<p class="text-xs mb-5" style="color: var(--color-muted-foreground)">
						Status: {data.hasPassword
							? '🔒 Password protection is enabled.'
							: '🔓 No password set — app is publicly accessible.'}
					</p>

					<FormAlert message={form?.passwordSuccess ? 'Password saved.' : null} variant="success" />
					<FormAlert message={form?.passwordRemoved ? 'Password protection removed.' : null} variant="success" />
					<FormAlert message={form?.passwordError} />

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
							<div class="flex items-center gap-2">
								<FileUp size={16} style="color: var(--color-primary)" aria-hidden="true" />
								<h4 class="font-semibold" style="color: var(--color-foreground)">Data Import</h4>
							</div>
							<p class="text-sm mt-0.5" style="color: var(--color-muted-foreground)">
								Import clients and invoices directly from the Harvest API
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
<p class="text-sm mb-1" style="color: var(--color-muted-foreground)">
						Enter your Harvest credentials below. Clients (with emails), invoices, and line items will be
						created automatically. The import is idempotent — existing records are skipped, so it's safe
						to re-run. Existing clients with a blank email will have their email backfilled.
					</p>
					<p class="text-xs mb-5" style="color: var(--color-muted-foreground)">
						Find your Account ID and Personal Access Token at
						<a href="https://id.getharvest.com/developers" target="_blank" rel="noopener noreferrer" class="underline underline-offset-2" style="color: var(--color-primary)">id.getharvest.com/developers</a>.
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
											{#if form.importStats?.skipNoClient}<div>↳ {form.importStats.skipNoClient} no matching client found</div>{/if}
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

						<FormAlert message={form?.importError} class="mb-5" />

						<form
							method="POST"
							action="?/harvestImport"
						class="space-y-4"
						use:enhance={() => {
							importing = true;
							return async ({ update }) => {
								importing = false;
								await update();
							};
						}}
					>
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
							<div>
								<label for="harvest-account-id" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">
									Account ID
								</label>
								<input
									id="harvest-account-id"
									name="harvest_account_id"
									type="text"
									placeholder="123456"
									required
									class="w-full text-sm rounded-lg border px-3 py-2 outline-none focus:ring-2"
									style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
								/>
							</div>
							<div>
								<label for="harvest-token" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">
									Personal Access Token
								</label>
								<input
									id="harvest-token"
									name="harvest_token"
									type="password"
									placeholder="your-token"
									required
									class="w-full text-sm rounded-lg border px-3 py-2 outline-none focus:ring-2"
									style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
								/>
							</div>
						</div>
						<button
							type="submit"
							disabled={importing}
							class="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
							style="background-color: var(--color-primary); color: var(--color-primary-foreground)"
						>
							{importing ? 'Importing…' : 'Import from Harvest'}
						</button>
					</form>

					<!-- Reset panel -->
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

<FormAlert message={form?.resetError} class="" />

											<div class="space-y-2">
												{#each [
													{ label: 'I understand all client records will be permanently deleted.' },
													{ label: 'I understand all invoices and line items will be permanently deleted.' },
													{ label: 'I understand this cannot be undone and I have a backup if needed.' }
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

			</section>
		</div>
	</div>
</div>
