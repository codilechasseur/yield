<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import FormAlert from '$lib/components/FormAlert.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import type { ActionData } from './$types.js';

	let { form }: { form: ActionData } = $props();

	let submitting = $state(false);
	let showPass = $state(false);
</script>

<svelte:head>
	<title>Sign in — {page.data.appName}</title>
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

		<h2 class="text-lg font-semibold mb-1" style="color: var(--color-foreground)">Sign in</h2>
		<p class="text-sm mb-6" style="color: var(--color-muted-foreground)">Enter your password to continue.</p>

		<FormAlert message={form?.error} />

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
