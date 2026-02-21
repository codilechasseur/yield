<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types.js';

	let { form }: { form: ActionData } = $props();

	let submitting = $state(false);
	let showPass = $state(false);
</script>

<svelte:head>
	<title>Sign in — Yield</title>
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
			<div class="w-8 h-8 shrink-0" style="color: var(--color-primary)">
				<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
					<rect x="2" y="21" width="7" height="9" rx="2" fill="currentColor" opacity="0.4"/>
					<rect x="12" y="14" width="7" height="16" rx="2" fill="currentColor" opacity="0.7"/>
					<rect x="22" y="5" width="7" height="25" rx="2" fill="currentColor"/>
					<path d="M5.5 20 L15.5 13 L25.5 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>
				</svg>
			</div>
			<div>
				<h1 class="text-xl font-bold tracking-tight leading-none" style="color: var(--color-primary)">Yield</h1>
				<p class="text-xs mt-0.5" style="color: var(--color-muted-foreground)">Invoice Manager</p>
			</div>
		</div>

		<h2 class="text-lg font-semibold mb-1" style="color: var(--color-foreground)">Sign in</h2>
		<p class="text-sm mb-6" style="color: var(--color-muted-foreground)">Enter your password to continue.</p>

		{#if form?.error}
			<div class="mb-4 px-4 py-3 rounded-lg text-sm" style="background-color: color-mix(in oklch, var(--color-destructive) 12%, transparent); color: var(--color-destructive)">
				{form.error}
			</div>
		{/if}

		<form
			method="POST"
			action="?/login"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					submitting = false;
					await update();
				};
			}}
		>
			<div class="space-y-4">
				<div class="relative">
					<label for="login-password" class="sr-only">Password</label>
					<input
						id="login-password"
						name="password"
						type={showPass ? 'text' : 'password'}
						placeholder="Password"
						autocomplete="current-password"
						required
						class="w-full px-3 py-2.5 pr-16 rounded-lg border text-sm outline-none focus:ring-2 transition-shadow"
						style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
					/>
					<button
						type="button"
						onclick={() => (showPass = !showPass)}
						aria-label={showPass ? 'Hide password' : 'Show password'}
						aria-pressed={showPass}
						aria-controls="login-password"
						class="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium transition-opacity hover:opacity-70"
						style="color: var(--color-muted-foreground)"
					>
						{showPass ? 'Hide' : 'Show'}
					</button>
				</div>

				<button
					type="submit"
					disabled={submitting}
					class="w-full px-4 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
					style="background-color: var(--color-primary); color: var(--color-primary-foreground)"
				>
					{submitting ? 'Signing in…' : 'Sign in'}
				</button>
			</div>
		</form>
	</div>
</div>
