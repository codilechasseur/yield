<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import Logo from '$lib/components/Logo.svelte';
	import type { ActionData } from './$types.js';

	let { form }: { form: ActionData } = $props();

	let submitting = $state(false);
	let showPass = $state(false);
	let showConfirm = $state(false);
</script>

<svelte:head>
	<title>Set up access — {page.data.appName}</title>
</svelte:head>

<div
	class="min-h-screen flex items-center justify-center p-4"
	style="background-color: var(--color-background)"
>
	<div
		class="w-full max-w-sm rounded-2xl border p-8 shadow-sm"
		style="background-color: var(--color-card); border-color: var(--color-border)"
	>
		<!-- Brand -->
		<div class="flex items-center gap-2.5 mb-8">
			<Logo class="w-8 h-8" />
			<div>
				<h1 class="text-xl font-bold tracking-tight leading-none" style="color: var(--color-primary)">{page.data.appName}</h1>
				<p class="text-xs mt-0.5" style="color: var(--color-muted-foreground)">Invoice Manager</p>
			</div>
		</div>

		<h2 class="text-lg font-semibold mb-1" style="color: var(--color-foreground)">Create a password</h2>
		<p class="text-sm mb-6" style="color: var(--color-muted-foreground)">
			Welcome! Set a password to protect access to your Yield instance. You can change it later in
			Settings.
		</p>

		{#if form?.error}
			<div
				class="mb-4 px-4 py-3 rounded-lg text-sm"
				style="background-color: color-mix(in oklch, var(--color-destructive) 12%, transparent); color: var(--color-destructive)"
			>
				{form.error}
			</div>
		{/if}

		<form
			method="POST"
			action="?/setup"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					submitting = false;
					await update();
				};
			}}
		>
			<div class="space-y-4">
				<!-- Password -->
				<div>
					<label for="setup-password" class="block text-sm font-medium mb-1.5" style="color: var(--color-foreground)">
						Password
					</label>
					<div class="relative">
						<input
							id="setup-password"
							name="password"
							type={showPass ? 'text' : 'password'}
							placeholder="At least 8 characters"
							autocomplete="new-password"
							minlength="8"
							required
							class="w-full px-3 py-2.5 pr-16 rounded-lg border text-sm outline-none focus:ring-2 transition-shadow"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						/>
						<button
							type="button"
							onclick={() => (showPass = !showPass)}
							aria-label={showPass ? 'Hide password' : 'Show password'}
							aria-pressed={showPass}
							aria-controls="setup-password"
							class="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium transition-opacity hover:opacity-70"
							style="color: var(--color-muted-foreground)"
						>
							{showPass ? 'Hide' : 'Show'}
						</button>
					</div>
				</div>

				<!-- Confirm -->
				<div>
					<label for="setup-confirm" class="block text-sm font-medium mb-1.5" style="color: var(--color-foreground)">
						Confirm password
					</label>
					<div class="relative">
						<input
							id="setup-confirm"
							name="confirm"
							type={showConfirm ? 'text' : 'password'}
							placeholder="Repeat your password"
							autocomplete="new-password"
							minlength="8"
							required
							class="w-full px-3 py-2.5 pr-16 rounded-lg border text-sm outline-none focus:ring-2 transition-shadow"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						/>
						<button
							type="button"
							onclick={() => (showConfirm = !showConfirm)}
							aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
							aria-pressed={showConfirm}
							aria-controls="setup-confirm"
							class="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium transition-opacity hover:opacity-70"
							style="color: var(--color-muted-foreground)"
						>
							{showConfirm ? 'Hide' : 'Show'}
						</button>
					</div>
				</div>

				<button
					type="submit"
					disabled={submitting}
					class="w-full px-4 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
					style="background-color: var(--color-primary); color: var(--color-primary-foreground)"
				>
					{submitting ? 'Saving…' : 'Set password & continue'}
				</button>
			</div>
		</form>
	</div>
</div>
