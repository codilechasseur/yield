<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { Lock, Save, Server, FileUp, Bug, HardDrive, Download, Trash2, ArrowLeft, Check } from 'lucide-svelte';
	import FormAlert from '$lib/components/FormAlert.svelte';
	import { addToast } from '$lib/toasts.svelte.js';
	import { debugState, setDebugEnabled } from '$lib/debug.svelte.js';
	import type { PageData, ActionData } from './$types.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// ── SMTP field state ──────────────────────────────────────────────────
	let smtpHost      = $state(untrack(() => data.smtp?.smtp_host ?? ''));
	let smtpPort      = $state<number>(untrack(() => data.smtp?.smtp_port || 587));
	let smtpUser      = $state(untrack(() => data.smtp?.smtp_user ?? ''));
	let smtpPass      = $state(untrack(() => data.smtp?.smtp_pass ?? ''));
	let smtpFromName  = $state(untrack(() => data.smtp?.smtp_from_name ?? ''));
	let smtpFromEmail = $state(untrack(() => data.smtp?.smtp_from_email ?? ''));
	let smtpSecure    = $state(untrack(() => data.smtp?.smtp_secure ?? false));
	let showPass      = $state(false);
	let smtpSaving    = $state(false);
	let testSending   = $state(false);
	let testTo        = $state('');

	// ── Security state ────────────────────────────────────────────────────
	let passwordSaving = $state(false);
	let showNewPass    = $state(false);
	let showRemovePasswordConfirm = $state(false);

	// ── Data import / reset state ─────────────────────────────────────────
	let importing   = $state(false);
	let importOpen  = $state(false);
	let resetOpen   = $state(false);
	let resetting   = $state(false);
	let resetCheck1 = $state(false);
	let resetCheck2 = $state(false);
	let resetCheck3 = $state(false);
	let resetReady  = $derived(resetCheck1 && resetCheck2 && resetCheck3);

	// ── Backup state ──────────────────────────────────────────────────────
	let creatingBackup = $state(false);
	let deletingBackup = $state<string | null>(null);

	// ── Dirty tracking ─────────────────────────────────────────────────────────
	let smtpSavedSnapshot = $state({
		smtpHost:      data.smtp?.smtp_host ?? '',
		smtpPort:      data.smtp?.smtp_port || 587,
		smtpUser:      data.smtp?.smtp_user ?? '',
		smtpPass:      data.smtp?.smtp_pass ?? '',
		smtpFromName:  data.smtp?.smtp_from_name ?? '',
		smtpFromEmail: data.smtp?.smtp_from_email ?? '',
		smtpSecure:    data.smtp?.smtp_secure ?? false,
	});

	let smtpDirty = $derived(
		smtpHost      !== smtpSavedSnapshot.smtpHost      ||
		smtpPort      !== smtpSavedSnapshot.smtpPort      ||
		smtpUser      !== smtpSavedSnapshot.smtpUser      ||
		smtpPass      !== smtpSavedSnapshot.smtpPass      ||
		smtpFromName  !== smtpSavedSnapshot.smtpFromName  ||
		smtpFromEmail !== smtpSavedSnapshot.smtpFromEmail ||
		smtpSecure    !== smtpSavedSnapshot.smtpSecure
	);

	function markSmtpClean() {
		smtpSavedSnapshot.smtpHost      = smtpHost;
		smtpSavedSnapshot.smtpPort      = smtpPort;
		smtpSavedSnapshot.smtpUser      = smtpUser;
		smtpSavedSnapshot.smtpPass      = smtpPass;
		smtpSavedSnapshot.smtpFromName  = smtpFromName;
		smtpSavedSnapshot.smtpFromEmail = smtpFromEmail;
		smtpSavedSnapshot.smtpSecure    = smtpSecure;
	}

</script>

<svelte:head>
	<title>System Settings — Yield</title>
</svelte:head>

<div class="max-w-5xl mx-auto">

	<!-- ── Page header ──────────────────────────────────────────────── -->
	<div class="mb-6">
		<h2 class="text-2xl font-bold" style="color: var(--color-foreground)">System Settings</h2>
		<p class="mt-1 text-sm" style="color: var(--color-muted-foreground)">Server configuration, security, data, and backups.</p>
	</div>

	<div class="space-y-14 pb-24">

			<!-- ════════════════════════════════════════════════════════
			     SMTP
			     ════════════════════════════════════════════════════════ -->
			<section id="smtp" class="scroll-mt-6 space-y-6">
				<h3 class="text-base font-semibold" style="color: var(--color-foreground)">SMTP</h3>

				<div class="rounded-xl border p-4 md:p-6" style="background-color: var(--color-card); border-color: var(--color-border)">
					<div class="flex items-center gap-2 mb-1">
						<Server size={16} style="color: var(--color-primary)" aria-hidden="true" />
						<h4 class="font-semibold" style="color: var(--color-foreground)">SMTP Server</h4>
					</div>
					<p class="text-sm mb-5" style="color: var(--color-muted-foreground)">Configure a third-party SMTP service to send invoices directly to clients.</p>

					<FormAlert message={form?.smtpError ?? null} class="mb-4" />
					{#if form?.smtpSuccess}
						<div class="mb-4 text-sm px-3 py-2 rounded-lg" style="background-color: var(--color-accent); color: var(--color-primary)">SMTP settings saved.</div>
					{/if}

					<form
						id="smtp-save-form"
						method="POST"
						action="?/saveSmtp"
						class="space-y-4"
						use:enhance={() => {
							smtpSaving = true;
							return async ({ update, result }) => {
								smtpSaving = false;
								await update({ reset: false });
							if (result.type === 'success') { markSmtpClean(); addToast('SMTP settings saved'); }
								else if (result.type === 'failure') addToast((result.data as any)?.smtpError ?? 'Failed to save SMTP settings', 'error');
							};
						}}
					>
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
									class="px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2"
									style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
								/>
							</div>
						</div>

						<!-- SSL toggle -->
						<input type="hidden" name="smtp_secure" value={smtpSecure ? 'on' : 'off'} />
						<div class="flex items-center gap-3">
							<button
								id="smtp-secure"
								type="button"
								role="switch"
								aria-label="Use SSL/TLS (port 465)"
								aria-checked={smtpSecure}
								onclick={() => smtpSecure = !smtpSecure}
								class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
								style={smtpSecure
									? 'background-color: var(--color-primary); outline-color: var(--color-primary)'
									: 'background-color: var(--color-muted); outline-color: var(--color-primary)'}
							>
								<span
									aria-hidden="true"
									class="pointer-events-none inline-block size-5 rounded-full shadow-sm ring-0 transition-transform"
									style="background-color: white; transform: translateX({smtpSecure ? '20px' : '0px'})"
								></span>
							</button>
							<label for="smtp-secure" class="text-sm cursor-pointer" style="color: var(--color-foreground)">Use SSL/TLS (port 465)</label>
						</div>

						<div>
							<button
								type="submit"
								disabled={smtpSaving}
							class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
							style={smtpDirty
								? 'background-color: var(--color-primary); color: var(--color-primary-foreground)'
								: 'background-color: var(--color-muted); color: var(--color-muted-foreground); opacity: 0.6'}
							>
								<Save size={14} aria-hidden="true" />
								{smtpSaving ? 'Saving…' : 'Save SMTP settings'}
							</button>
						</div>
					</form>

					<!-- Test email (separate form) -->
					<div class="mt-6 pt-6 border-t" style="border-color: var(--color-border)">
						<h5 class="text-sm font-semibold mb-1" style="color: var(--color-foreground)">Send a test email</h5>
						<p class="text-xs mb-3" style="color: var(--color-muted-foreground)">Save your settings first, then enter an address to verify delivery.</p>

						<FormAlert message={form?.testSuccess ? 'Test email sent!' : null} variant="success" class="mb-3" />
						<FormAlert message={form?.testError ?? null} class="mb-3" />

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
			     SECURITY
			     ════════════════════════════════════════════════════════ -->
			<section id="security" class="scroll-mt-6 space-y-6">
				<h3 class="text-base font-semibold" style="color: var(--color-foreground)">Security</h3>

				<div class="rounded-xl border p-4 md:p-6" style="background-color: var(--color-card); border-color: var(--color-border)">
					<div class="flex items-center gap-2 mb-1">
						<Lock size={16} style="color: var(--color-primary)" />
						<h4 class="font-semibold" style="color: var(--color-foreground)">Password Protection</h4>
					</div>
					<p class="text-sm mb-1" style="color: var(--color-muted-foreground)">
						Protect access with a password. When set, all visitors must sign in before viewing the app.
					</p>
					<p class="text-xs mb-5" style="color: var(--color-muted-foreground)">
						Status: {data.hasPassword
							? '🔒 Password protection is enabled.'
							: '🔓 No password set — app is publicly accessible.'}
					</p>

					<form
						id="security-save-form"
						method="POST"
						action="?/setPassword"
						class="flex flex-col sm:flex-row sm:items-end gap-3"
						use:enhance={() => {
							passwordSaving = true;
							return async ({ update, result }) => {
								passwordSaving = false;
								if (result.type === 'success') {
									addToast('Password saved.');
								} else if (result.type === 'failure') {
									addToast((result.data as any)?.passwordError ?? 'Failed to save password.', 'error');
								}
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
						<div class="mt-3">
							<button
								type="button"
								class="w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-medium border transition-colors hover:opacity-80"
								style="border-color: var(--color-destructive); color: var(--color-destructive)"
								onclick={() => (showRemovePasswordConfirm = true)}
							>
								Remove password
							</button>
						</div>
					{/if}
				</div>
			</section>

			<!-- ════════════════════════════════════════════════════════
			     DATA
			     ════════════════════════════════════════════════════════ -->
			<section id="data" class="scroll-mt-6 space-y-6">
				<h3 class="text-base font-semibold" style="color: var(--color-foreground)">Data</h3>

				<!-- Data Import -->
				<details
					id="import"
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
									<li>Contacts: {form.importStats?.contactsCreated} created, {form.importStats?.contactsSkipped} already existed</li>
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

						<FormAlert message={form?.importError ?? null} class="mb-5" />

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
												return async ({ update, result }) => {
													resetting = false;
													resetCheck1 = false;
													resetCheck2 = false;
													resetCheck3 = false;
													if (result.type === 'success') addToast('All data deleted.');
													else if (result.type === 'failure') addToast((result.data as any)?.resetError ?? 'Reset failed.', 'error');
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
							</div>
						{/if}
					</div>
				</details>
			</section>

			<!-- ════════════════════════════════════════════════════════
			     BACKUPS
			     ════════════════════════════════════════════════════════ -->
			<section id="backup" class="scroll-mt-6 space-y-6">
				<h3 class="text-base font-semibold" style="color: var(--color-foreground)">Backups</h3>

				<div class="rounded-xl border p-4 md:p-5" style="background-color: var(--color-card); border-color: var(--color-border)">
					<div class="flex items-center gap-2 mb-1">
						<HardDrive size={16} style="color: var(--color-primary)" aria-hidden="true" />
						<h4 class="font-semibold" style="color: var(--color-foreground)">Database backups</h4>
					</div>
					<p class="text-sm mb-4" style="color: var(--color-muted-foreground)">
						Create a full backup of your PocketBase database. Backups are stored on the server and can be downloaded or deleted here.
					</p>

					{#if data.backupsMissingCreds}
						<p class="text-sm rounded-lg px-3 py-2 mb-4" style="background: var(--color-muted, #f8fafc); color: var(--color-muted-foreground)">
							Backup management requires superuser credentials. Set the <code>PB_ADMIN_EMAIL</code> and <code>PB_ADMIN_PASSWORD</code> environment variables to enable this feature.
						</p>
					{:else if data.backupsError}
						<p class="text-sm rounded-lg px-3 py-2 mb-4" style="background: var(--color-destructive-muted, #fef2f2); color: var(--color-destructive, #dc2626)">
							{data.backupsError}
						</p>
					{/if}

					<form
						method="POST"
						action="?/createBackup"
						use:enhance={() => {
							creatingBackup = true;
							return async ({ update, result }) => {
								creatingBackup = false;
								if (result.type === 'success') {
									addToast('Backup created');
								} else if (result.type === 'failure') {
									addToast((result.data as any)?.backupError ?? 'Failed to create backup', 'error');
								}
								await update();
							};
						}}
					>
						<button
							type="submit"
							disabled={creatingBackup || data.backupsMissingCreds}
							class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
							style="background-color: var(--color-primary); color: var(--color-primary-foreground)"
						>
							<HardDrive size={14} aria-hidden="true" />
							{creatingBackup ? 'Creating…' : 'Create backup now'}
						</button>
					</form>

					{#if data.backups && data.backups.length > 0}
						<div class="mt-5 overflow-x-auto">
							<table class="w-full text-sm">
								<thead>
									<tr style="border-bottom: 1px solid var(--color-border)">
										<th scope="col" class="text-left py-2 pr-4 font-medium" style="color: var(--color-muted-foreground)">Filename</th>
										<th scope="col" class="text-left py-2 pr-4 font-medium" style="color: var(--color-muted-foreground)">Size</th>
										<th scope="col" class="text-left py-2 pr-4 font-medium" style="color: var(--color-muted-foreground)">Created</th>
										<th scope="col" class="text-right py-2 font-medium" style="color: var(--color-muted-foreground)">Actions</th>
									</tr>
								</thead>
								<tbody>
									{#each data.backups as backup (backup.key)}
										<tr style="border-bottom: 1px solid var(--color-border)">
											<td class="py-2 pr-4" style="color: var(--color-foreground)">{backup.key}</td>
											<td class="py-2 pr-4" style="color: var(--color-muted-foreground)">
												{backup.size < 1024 * 1024
													? `${(backup.size / 1024).toFixed(1)} KB`
													: `${(backup.size / (1024 * 1024)).toFixed(1)} MB`}
											</td>
											<td class="py-2 pr-4" style="color: var(--color-muted-foreground)">
												{new Date(backup.modified).toLocaleString()}
											</td>
											<td class="py-2 text-right">
												<div class="flex items-center justify-end gap-2">
													<a
														href="/api/backup/{encodeURIComponent(backup.key)}"
														download={backup.key}
														class="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border transition-opacity hover:opacity-70"
														style="color: var(--color-primary); border-color: var(--color-border)"
													>
														<Download size={12} aria-hidden="true" />
														Download
													</a>
													<form
														method="POST"
														action="?/deleteBackup"
														use:enhance={() => {
															deletingBackup = backup.key;
															return async ({ update, result }) => {
																deletingBackup = null;
																if (result.type === 'success') {
																	addToast('Backup deleted');
																} else if (result.type === 'failure') {
																	addToast((result.data as any)?.backupError ?? 'Failed to delete backup', 'error');
																}
																await update();
															};
														}}
													>
														<input type="hidden" name="key" value={backup.key} />
														<button
															type="submit"
															disabled={deletingBackup === backup.key}
															aria-label="Delete backup {backup.key}"
															class="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border transition-opacity hover:opacity-70 disabled:opacity-40"
															style="color: var(--color-destructive, #dc2626); border-color: var(--color-border)"
														>
															<Trash2 size={12} aria-hidden="true" />
															Delete
														</button>
													</form>
												</div>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{:else if !data.backupsError}
						<p class="mt-4 text-sm" style="color: var(--color-muted-foreground)">No backups yet. Click "Create backup now" to create your first one.</p>
					{/if}
				</div>
			</section>

			<!-- ════════════════════════════════════════════════════════
			     DEBUG
			     ════════════════════════════════════════════════════════ -->
			<section id="debug" class="scroll-mt-6 space-y-6">
				<h3 class="text-base font-semibold" style="color: var(--color-foreground)">Debug</h3>

				<div class="rounded-xl border p-4 md:p-5" style="background-color: var(--color-card); border-color: var(--color-border)">
					<div class="flex items-center gap-2 mb-1">
						<Bug size={16} style="color: var(--color-primary)" aria-hidden="true" />
						<h4 class="font-semibold" style="color: var(--color-foreground)">Debug logging</h4>
					</div>
					<p class="text-sm mb-5" style="color: var(--color-muted-foreground)">
						Captures toasts, JavaScript errors, and unhandled promise rejections. View the live log on the dedicated Debug page.
					</p>

					<div class="flex flex-wrap items-center justify-between gap-4">
						<div class="flex items-center gap-3">
							<button
								id="debug-enabled"
								type="button"
								role="switch"
								aria-label="Enable debug mode"
								aria-checked={debugState.enabled}
								onclick={() => setDebugEnabled(!debugState.enabled)}
								class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
								style={debugState.enabled
									? 'background-color: var(--color-primary); outline-color: var(--color-primary)'
									: 'background-color: var(--color-muted); outline-color: var(--color-primary)'}
							>
								<span
									aria-hidden="true"
									class="pointer-events-none inline-block size-5 rounded-full shadow-sm ring-0 transition-transform"
									style="background-color: white; transform: translateX({debugState.enabled ? '20px' : '0px'})"
								></span>
							</button>
							<label for="debug-enabled" class="text-sm font-medium" style="color: var(--color-foreground)">
								{debugState.enabled ? 'Enabled' : 'Disabled'}
							</label>
						</div>

						{#if debugState.enabled}
							<a
								href="/debug"
								class="flex items-center gap-1.5 text-sm font-medium underline-offset-2 hover:underline transition-opacity hover:opacity-80"
								style="color: var(--color-primary)"
							>
								<Bug size={14} aria-hidden="true" />
								View debug log
							</a>
						{/if}
					</div>
				</div>
			</section>
	</div>
</div>

<!-- Remove password confirmation modal -->
{#if showRemovePasswordConfirm}
	<div class="fixed inset-0 z-50 flex items-center justify-center" style="background: rgba(0,0,0,0.4)">
		<div class="rounded-xl border shadow-xl p-5 max-w-sm w-full mx-4" style="background: var(--color-card); border-color: var(--color-border)">
			<p class="font-semibold mb-1" style="color: var(--color-foreground)">Remove password protection?</p>
			<p class="text-sm mb-4" style="color: var(--color-muted-foreground)">The app will be publicly accessible.</p>
			<div class="flex gap-2 justify-end">
				<button onclick={() => (showRemovePasswordConfirm = false)} class="px-3 py-1.5 rounded-lg border text-sm font-medium hover:bg-muted transition-colors" style="border-color: var(--color-border); color: var(--color-muted-foreground)">Cancel</button>
				<form method="POST" action="?/removePassword" use:enhance={() => {
					return async ({ update, result }) => {
						showRemovePasswordConfirm = false;
						if (result.type === 'success') {
							addToast('Password protection removed.');
						} else if (result.type === 'failure') {
							addToast((result.data as any)?.passwordError ?? 'Failed to remove password.', 'error');
						}
						await update();
					};
				}}>
					<button type="submit" class="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors">Remove password</button>
				</form>
			</div>
		</div>
	</div>
{/if}
