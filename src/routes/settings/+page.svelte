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

	// ── Logo upload state ─────────────────────────────────────────────────
	let logoUploading   = $state(false);
	let logoRemoving    = $state(false);
	let logoError       = $state('');
	let logoFile        = $state<File | null>(null);

	const currencies = ['CAD', 'USD', 'EUR', 'GBP', 'AUD', 'NZD', 'CHF', 'JPY', 'MXN', 'BRL'];
	let defaultCurrency = $state(untrack(() => data.smtp?.default_currency ?? 'CAD'));

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
		hideCompanyName     !== snapshot.hideCompanyName     ||
		current             !== snapshot.brandTheme
	);

	function markClean() {
		snapshot = {
			taxPercent, incomeTaxRate, defaultHourlyRate, companyName, companyAddress,
			defaultNotes, invoiceFooter, invoiceNumberFormat, invoiceNextNumber,
			emailSubject, emailBody, defaultCurrency,
			hideCompanyName,
			brandTheme: current,
		};
	}

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
	type Section = 'appearance' | 'invoices' | 'email';
	const sections: { id: Section; label: string }[] = [
		{ id: 'appearance', label: 'Appearance' },
		{ id: 'invoices',   label: 'Invoices' },
		{ id: 'email',      label: 'Email' },
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
						<input type="hidden" name="logo_hide_company_name" form="settings-form" value={hideCompanyName ? 'on' : 'off'} />
						<div class="flex items-center gap-3 mb-5">
							<button
								id="hide-company-name"
								type="button"
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
						<div id="income-tax-rate" class="flex flex-col gap-1 scroll-mt-6">
							<label for="income-tax-rate-input" class="text-xs font-medium inline-flex items-center" style="color: var(--color-muted-foreground)">Income Tax Rate (%) <Tip tip="Your personal rate used in Tax Reports. Not applied to invoice totals." /></label>
							<input
								id="income-tax-rate-input"
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
			</section>
		</div>
	</div>
</div>
