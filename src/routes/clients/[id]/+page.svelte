<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowLeft, Mail, MapPin, Save, UserPlus, Phone, Briefcase, Pencil, Trash2, User } from 'lucide-svelte';
	import { STATUS_COLORS, formatCurrency } from '$lib/pocketbase.js';
	import { addToast } from '$lib/toasts.svelte.js';
	import RichTextarea from '$lib/components/RichTextarea.svelte';
	import FormAlert from '$lib/components/FormAlert.svelte';
	import type { Contact } from '$lib/types.js';
	import type { PageData, ActionData } from './$types.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let editing = $state(false);
	let saving = $state(false);
	let editAddress = $state(data.client.address ?? '');

	// Contacts state
	let showAddContact = $state(false);
	let contactSaving = $state(false);
	let editingContact = $state<Contact | null>(null);

	$effect(() => {
		if (form?.contactSuccess) {
			showAddContact = false;
			editingContact = null;
			addToast('Contact saved');
		}
		if (form?.contactError) {
			addToast(form.contactError, 'error');
		}
	});

	function contactDisplayName(c: Contact): string {
		const full = [c.first_name, c.last_name].filter(Boolean).join(' ');
		return full || '(unnamed)';
	}

	function formatDate(d: string) {
		return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}
</script>

<svelte:head>
	<title>{data.client.name} — Yield</title>
</svelte:head>

<div class="max-w-5xl mx-auto">
	<a href="/clients" class="inline-flex items-center gap-1.5 text-sm mb-6" style="color: var(--color-muted-foreground)">
		<ArrowLeft size={15} /> Back to Clients
	</a>

	<FormAlert message={form?.error} />

	<!-- Client Header -->
	<div class="rounded-xl border p-4 md:p-6 mb-6" style="background-color: var(--color-card); border-color: var(--color-border)">
		{#if editing}
			<form
				method="POST"
				action="?/update"
				use:enhance={() => {
					saving = true;
					return async ({ update, result }) => {
						saving = false;
						await update();
						if (result.type !== 'failure') {
							editing = false;
							addToast('Client saved');
						}
					};
				}}
				class="space-y-4"
			>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div>
						<label for="edit-name" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">Name *</label>
						<input id="edit-name" name="name" required value={data.client.name}
							class="w-full px-3 py-2 rounded-lg border text-sm"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						/>
					</div>
					<div>
						<label for="edit-email" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">Email</label>
						<input id="edit-email" name="email" type="email" value={data.client.email}
							class="w-full px-3 py-2 rounded-lg border text-sm"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						/>
					</div>
					<div class="col-span-2">
						<label for="edit-address" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">Address</label>
						<RichTextarea id="edit-address" name="address" rows={2}
							bind:value={editAddress}
							class="w-full px-3 py-2 rounded-lg border text-sm resize-none"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						/>
					</div>
					<div>
						<label for="edit-currency" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">Currency</label>
						<select id="edit-currency" name="currency" class="w-full px-3 py-2 rounded-lg border text-sm"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						>
							{#each ['USD', 'EUR', 'GBP', 'CAD', 'AUD'] as c}
								<option selected={data.client.currency === c}>{c}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="edit-hourly-rate" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">Default Hourly Rate</label>
						<input id="edit-hourly-rate" name="default_hourly_rate" type="number" min="0" step="0.01"
							value={data.client.default_hourly_rate ?? ''}
							placeholder="Use global default"
							class="w-full px-3 py-2 rounded-lg border text-sm font-mono"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						/>
					</div>
				</div>
				<div class="flex gap-3 justify-end">
					<button type="button" onclick={() => editing = false}
						class="px-4 py-2 text-sm rounded-lg border"
						style="border-color: var(--color-border); color: var(--color-muted-foreground)"
					>Cancel</button>
					<button type="submit" disabled={saving}
						class="flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium disabled:opacity-60"
						style="background: var(--color-primary); color: var(--color-primary-foreground)"
					>
						<Save size={15} /> {saving ? 'Saving...' : 'Save'}
					</button>
				</div>
			</form>
		{:else}
			<div class="flex items-start justify-between">
				<div>
					<h2 class="text-xl font-bold" style="color: var(--color-foreground)">{data.client.name}</h2>
					<div class="flex items-center gap-2 mt-1 flex-wrap">
						<span class="inline-block px-2 py-0.5 rounded text-xs font-mono"
							style="background: var(--color-muted); color: var(--color-muted-foreground)"
						>{data.client.currency}</span>
						{#if data.client.default_hourly_rate}
							<span class="inline-block px-2 py-0.5 rounded text-xs font-mono"
								style="background: var(--color-muted); color: var(--color-muted-foreground)"
							>{formatCurrency(data.client.default_hourly_rate, data.client.currency)}/hr</span>
						{/if}
					</div>
				</div>
				<button onclick={() => editing = true}
					class="px-3 py-1.5 text-sm rounded-lg border font-medium"
					style="border-color: var(--color-border); color: var(--color-foreground)"
				>Edit</button>
			</div>
			<div class="mt-4 space-y-2">
				{#if data.client.email}
					<div class="flex items-center gap-2 text-sm" style="color: var(--color-muted-foreground)">
						<Mail size={14} /> {data.client.email}
					</div>
				{/if}
				{#if data.client.address}
					<div class="flex items-start gap-2 text-sm" style="color: var(--color-muted-foreground)">
						<MapPin size={14} class="mt-0.5 shrink-0" /> <span>{@html data.client.address}</span>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Contacts -->
	<div class="rounded-xl border overflow-hidden mb-6" style="background: var(--color-card); border-color: var(--color-border)">
		<div class="px-6 py-4 border-b flex items-center justify-between" style="border-color: var(--color-border)">
			<h3 class="font-semibold" style="color: var(--color-foreground)">Contacts ({data.contacts.length})</h3>
			<button
				onclick={() => { showAddContact = !showAddContact; editingContact = null; }}
				class="flex items-center gap-1.5 text-xs font-medium"
				style="color: var(--color-primary)"
			>
				<UserPlus size={13} /> Add Contact
			</button>
		</div>

		<!-- Add contact form -->
		{#if showAddContact}
			<div class="px-6 py-4 border-b" style="border-color: var(--color-border); background: var(--color-background)">
				<form
					method="POST"
					action="?/addContact"
					use:enhance={() => {
						contactSaving = true;
						return async ({ update }) => {
							contactSaving = false;
							await update();
						};
					}}
					class="grid grid-cols-1 sm:grid-cols-2 gap-3"
				>
					<div>
						<label for="new-first-name" class="block text-xs font-medium mb-1" style="color: var(--color-muted-foreground)">First Name</label>
						<input id="new-first-name" name="first_name" type="text"
							class="w-full px-3 py-2 rounded-lg border text-sm"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						/>
					</div>
					<div>
						<label for="new-last-name" class="block text-xs font-medium mb-1" style="color: var(--color-muted-foreground)">Last Name</label>
						<input id="new-last-name" name="last_name" type="text"
							class="w-full px-3 py-2 rounded-lg border text-sm"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						/>
					</div>
					<div>
						<label for="new-contact-email" class="block text-xs font-medium mb-1" style="color: var(--color-muted-foreground)">Email</label>
						<input id="new-contact-email" name="email" type="email"
							class="w-full px-3 py-2 rounded-lg border text-sm"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						/>
					</div>
					<div>
						<label for="new-contact-phone" class="block text-xs font-medium mb-1" style="color: var(--color-muted-foreground)">Phone</label>
						<input id="new-contact-phone" name="phone" type="tel"
							class="w-full px-3 py-2 rounded-lg border text-sm"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						/>
					</div>
					<div class="sm:col-span-2">
						<label for="new-contact-title" class="block text-xs font-medium mb-1" style="color: var(--color-muted-foreground)">Title / Role</label>
						<input id="new-contact-title" name="title" type="text"
							class="w-full px-3 py-2 rounded-lg border text-sm"
							style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
						/>
					</div>
					<div class="sm:col-span-2 flex gap-2 justify-end">
						<button type="button" onclick={() => (showAddContact = false)}
							class="px-3 py-1.5 rounded-lg border text-sm"
							style="border-color: var(--color-border); color: var(--color-muted-foreground)"
						>Cancel</button>
						<button type="submit" disabled={contactSaving}
							class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-60"
							style="background: var(--color-primary); color: var(--color-primary-foreground)"
						>
							<UserPlus size={14} /> {contactSaving ? 'Saving…' : 'Add Contact'}
						</button>
					</div>
				</form>
			</div>
		{/if}

		{#if data.contacts.length === 0 && !showAddContact}
			<p class="px-6 py-6 text-sm text-center" style="color: var(--color-muted-foreground)">No contacts yet. Add one above.</p>
		{:else}
			<ul>
				{#each data.contacts as contact}
					<li class="border-b last:border-b-0" style="border-color: var(--color-border)">
						{#if editingContact?.id === contact.id}
							<!-- Inline edit form -->
							<form
								method="POST"
								action="?/updateContact"
								use:enhance={() => {
									contactSaving = true;
									return async ({ update }) => {
										contactSaving = false;
										await update();
									};
								}}
								class="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3"
								style="background: var(--color-background)"
							>
								<input type="hidden" name="contact_id" value={contact.id} />
								<div>
									<label for="edit-first-{contact.id}" class="block text-xs font-medium mb-1" style="color: var(--color-muted-foreground)">First Name</label>
									<input id="edit-first-{contact.id}" name="first_name" type="text" value={contact.first_name}
										class="w-full px-3 py-2 rounded-lg border text-sm"
										style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
									/>
								</div>
								<div>
									<label for="edit-last-{contact.id}" class="block text-xs font-medium mb-1" style="color: var(--color-muted-foreground)">Last Name</label>
									<input id="edit-last-{contact.id}" name="last_name" type="text" value={contact.last_name}
										class="w-full px-3 py-2 rounded-lg border text-sm"
										style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
									/>
								</div>
								<div>
									<label for="edit-cemail-{contact.id}" class="block text-xs font-medium mb-1" style="color: var(--color-muted-foreground)">Email</label>
									<input id="edit-cemail-{contact.id}" name="email" type="email" value={contact.email}
										class="w-full px-3 py-2 rounded-lg border text-sm"
										style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
									/>
								</div>
								<div>
									<label for="edit-cphone-{contact.id}" class="block text-xs font-medium mb-1" style="color: var(--color-muted-foreground)">Phone</label>
									<input id="edit-cphone-{contact.id}" name="phone" type="tel" value={contact.phone}
										class="w-full px-3 py-2 rounded-lg border text-sm"
										style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
									/>
								</div>
								<div class="sm:col-span-2">
									<label for="edit-ctitle-{contact.id}" class="block text-xs font-medium mb-1" style="color: var(--color-muted-foreground)">Title / Role</label>
									<input id="edit-ctitle-{contact.id}" name="title" type="text" value={contact.title}
										class="w-full px-3 py-2 rounded-lg border text-sm"
										style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
									/>
								</div>
								<div class="sm:col-span-2 flex gap-2 justify-end">
									<button type="button" onclick={() => (editingContact = null)}
										class="px-3 py-1.5 rounded-lg border text-sm"
										style="border-color: var(--color-border); color: var(--color-muted-foreground)"
									>Cancel</button>
									<button type="submit" disabled={contactSaving}
										class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-60"
										style="background: var(--color-primary); color: var(--color-primary-foreground)"
									>
										<Save size={14} /> {contactSaving ? 'Saving…' : 'Save'}
									</button>
								</div>
							</form>
						{:else}
							<div class="px-6 py-4 flex items-start justify-between gap-4">
								<div class="min-w-0">
									<div class="flex items-center gap-2">
										<User size={14} style="color: var(--color-muted-foreground); flex-shrink: 0" />
										<span class="text-sm font-medium" style="color: var(--color-foreground)">{contactDisplayName(contact)}</span>
										{#if contact.title}
											<span class="text-xs" style="color: var(--color-muted-foreground)">· {contact.title}</span>
										{/if}
									</div>
									<div class="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
										{#if contact.email}
											<div class="flex items-center gap-1.5 text-sm" style="color: var(--color-muted-foreground)">
												<Mail size={12} /> {contact.email}
											</div>
										{/if}
										{#if contact.phone}
											<div class="flex items-center gap-1.5 text-sm" style="color: var(--color-muted-foreground)">
												<Phone size={12} /> {contact.phone}
											</div>
										{/if}
									</div>
								</div>
								<div class="flex items-center gap-1 shrink-0">
									<button
										onclick={() => { editingContact = contact; showAddContact = false; }}
										aria-label="Edit contact"
										class="p-1.5 rounded-lg hover:bg-muted transition-colors"
										style="color: var(--color-muted-foreground)"
									>
										<Pencil size={13} />
									</button>
									<form
										method="POST"
										action="?/deleteContact"
										use:enhance={() => async ({ update }) => {
											await update();
											addToast('Contact removed');
										}}
									>
										<input type="hidden" name="contact_id" value={contact.id} />
										<button
											type="submit"
											aria-label="Delete contact"
											class="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
											style="color: var(--color-destructive, #dc2626)"
											onclick={(e) => { if (!confirm('Delete this contact?')) e.preventDefault(); }}
										>
											<Trash2 size={13} />
										</button>
									</form>
								</div>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<!-- Client Invoices -->
	<div class="rounded-xl border overflow-hidden" style="background: var(--color-card); border-color: var(--color-border)">
		<div class="px-6 py-4 border-b flex items-center justify-between" style="border-color: var(--color-border)">
			<h3 class="font-semibold" style="color: var(--color-foreground)">Invoices ({data.invoices.length})</h3>
			<a href="/invoices/new?client={data.client.id}"
				class="text-xs font-medium"
				style="color: var(--color-primary)"
			>+ New Invoice</a>
		</div>
		{#if data.invoices.length === 0}
			<p class="px-6 py-8 text-sm text-center" style="color: var(--color-muted-foreground)">No invoices for this client yet.</p>
		{:else}
			<div class="overflow-x-auto">
			<table class="w-full min-w-100">
				<thead>
					<tr style="border-bottom: 1px solid var(--color-border)">
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium" style="color: var(--color-muted-foreground)">Number</th>
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium" style="color: var(--color-muted-foreground)">Issue Date</th>
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium" style="color: var(--color-muted-foreground)">Due Date</th>
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium" style="color: var(--color-muted-foreground)">Status</th>					<th scope="col" class="px-6 py-3 text-right text-xs font-medium" style="color: var(--color-muted-foreground)">Total</th>					</tr>
				</thead>
				<tbody>
					{#each data.invoices as inv}
						<tr style="border-bottom: 1px solid var(--color-border)">
							<td class="px-6 py-3">
								<a href="/invoices/{inv.id}" class="text-sm font-medium" style="color: var(--color-primary)">{inv.number}</a>
							</td>
							<td class="px-6 py-3 text-sm" style="color: var(--color-muted-foreground)">{inv.issue_date ? formatDate(inv.issue_date) : '—'}</td>
							<td class="px-6 py-3 text-sm" style="color: var(--color-muted-foreground)">{inv.due_date ? formatDate(inv.due_date) : '—'}</td>
							<td class="px-6 py-3">
								<span class="{STATUS_COLORS[inv.status] ?? ''}">{inv.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
							</td>						<td class="px-6 py-3 text-right text-sm font-medium" style="color: var(--color-foreground)">{formatCurrency(inv.total, data.client.currency)}</td>						</tr>
					{/each}
				</tbody>
			</table>
			</div>
		{/if}
	</div>
</div>
