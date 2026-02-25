<script lang="ts">
	import { Plus, X } from 'lucide-svelte';
	import { untrack } from 'svelte';
	import type { Client } from '$lib/types.js';

	interface Props {
		clients: Client[];
		selectedId?: string;
		inputId?: string;
	}

	let { clients: initialClients, selectedId = $bindable(''), inputId = 'quick-client' }: Props = $props();

	let clients = $state<Client[]>(untrack(() => [...initialClients]));
	let dialogEl = $state<HTMLDialogElement | null>(null);

	let newName = $state('');
	let newEmail = $state('');
	let creating = $state(false);
	let createError = $state('');

	function openDialog() {
		newName = '';
		newEmail = '';
		createError = '';
		dialogEl?.showModal();
	}

	function closeDialog() {
		dialogEl?.close();
	}

	async function handleCreate() {
		const name = newName.trim();
		if (!name) {
			createError = 'Name is required';
			return;
		}
		creating = true;
		createError = '';
		try {
			const res = await fetch('/api/clients', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, email: newEmail.trim() })
			});
			const json = await res.json();
			if (!res.ok) {
				createError = json.error || 'Failed to create client';
				return;
			}
			clients = [...clients, json.client as Client].sort((a, b) => a.name.localeCompare(b.name));
			selectedId = (json.client as Client).id;
			closeDialog();
		} catch {
			createError = 'Network error — please try again';
		} finally {
			creating = false;
		}
	}

	function onKeydown(e: KeyboardEvent) {
		// Prevent Enter inside the dialog inputs from submitting the outer invoice form
		if (e.key === 'Enter') {
			e.preventDefault();
			handleCreate();
		}
		if (e.key === 'Escape') {
			closeDialog();
		}
	}
</script>

<div class="grid gap-x-2" style="grid-template-columns: 1fr auto">
	<label for={inputId} class="block text-xs font-medium mb-1.5 col-start-1 row-start-1" style="color: var(--color-muted-foreground)">
		Client <span aria-hidden="true">*</span>
	</label>
	<select
		id={inputId}
		name="client"
		required
		bind:value={selectedId}
		class="col-start-1 row-start-2 w-full px-3 py-2 rounded-lg border text-sm"
		style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
	>
		<option value="">Select a client…</option>
		{#each clients as c (c.id)}
			<option value={c.id}>{c.name}</option>
		{/each}
	</select>
	<button
		type="button"
		onclick={openDialog}
		aria-label="Add new client"
		title="Add new client"
		class="col-start-2 row-start-2 flex items-center justify-center w-9 self-stretch rounded-lg border transition-colors hover:opacity-80"
		style="background: var(--color-primary); border-color: var(--color-primary); color: var(--color-primary-foreground)"
	>
		<Plus size={16} aria-hidden="true" />
	</button>
</div>

<!-- Quick-add dialog — positioned outside the visual flow but inside the DOM -->
<!-- dialog is used so focus is trapped and Escape closes it natively -->
<dialog
	bind:this={dialogEl}
	aria-labelledby="qac-title"
	class="m-auto rounded-xl border shadow-xl w-full max-w-sm p-0 backdrop:bg-black/40"
	style="background: var(--color-card); border-color: var(--color-border)"
>
	<div class="flex items-center justify-between px-5 pt-5 pb-3">
		<h2 id="qac-title" class="text-base font-semibold" style="color: var(--color-foreground)">New Client</h2>
		<button
			type="button"
			onclick={closeDialog}
			aria-label="Close"
			class="p-1 rounded-lg hover:opacity-70 transition-opacity"
			style="color: var(--color-muted-foreground)"
		>
			<X size={16} aria-hidden="true" />
		</button>
	</div>

	<div class="px-5 pb-5 space-y-4">
		{#if createError}
			<p role="alert" class="text-sm px-3 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200">{createError}</p>
		{/if}

		<div>
			<label for="qac-name" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">
				Name <span aria-hidden="true">*</span>
			</label>
			<input
				id="qac-name"
				type="text"
				bind:value={newName}
				placeholder="Acme Corp"
				autocomplete="off"
				onkeydown={onKeydown}
				class="w-full px-3 py-2 rounded-lg border text-sm"
				style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
			/>
		</div>

		<div>
			<label for="qac-email" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">
				Email <span class="font-normal" style="color: var(--color-muted-foreground)">(optional)</span>
			</label>
			<input
				id="qac-email"
				type="email"
				bind:value={newEmail}
				placeholder="billing@acme.com"
				autocomplete="off"
				onkeydown={onKeydown}
				class="w-full px-3 py-2 rounded-lg border text-sm"
				style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
			/>
		</div>

		<div class="flex justify-end gap-2 pt-1">
			<button
				type="button"
				onclick={closeDialog}
				disabled={creating}
				class="px-4 py-2 rounded-lg text-sm font-medium border transition-opacity disabled:opacity-50"
				style="border-color: var(--color-border); color: var(--color-muted-foreground)"
			>
				Cancel
			</button>
			<button
				type="button"
				onclick={handleCreate}
				disabled={creating}
				class="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60 transition-opacity"
				style="background: var(--color-primary); color: var(--color-primary-foreground)"
			>
				{creating ? 'Creating…' : 'Create Client'}
			</button>
		</div>
	</div>
</dialog>
