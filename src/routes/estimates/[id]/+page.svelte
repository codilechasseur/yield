<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowLeft, Download, Pencil, Trash2, MessageSquare, Mail, FileText, Send, ChevronDown, CheckCircle, XCircle, ArrowRight } from 'lucide-svelte';
	import { STATUS_COLORS } from '$lib/pocketbase.js';
	import { addToast } from '$lib/toasts.svelte.js';
	import RichTextarea from '$lib/components/RichTextarea.svelte';
	import FormAlert from '$lib/components/FormAlert.svelte';
	import type { PageData, ActionData } from './$types.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let estimate = $derived(data.estimate);
	let items = $derived(data.items);

	function fmt(n: number, currency = estimate.expand?.client?.currency ?? 'USD'): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
	}
	function fmtDate(d: string) {
		return d ? new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—';
	}
	function fmtDateTime(d: string) {
		return d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
	}

	const subtotal = $derived(items.reduce((s, i) => s + i.quantity * i.unit_price, 0));
	const taxAmt = $derived(subtotal * (estimate.tax_percent / 100));
	const total = $derived(subtotal + taxAmt);

	const isExpired = $derived(
		estimate.status === 'sent' && !!estimate.expiry_date && new Date(estimate.expiry_date) < new Date()
	);
	const displayStatus = $derived(isExpired ? 'expired' : estimate.status);

	let noteText = $state('');
	let noteSubmitting = $state(false);
	let showSend = $state(false);
	let sendMessage = $state('');
	let sendSubmitting = $state(false);
	let extraRecipients = $state('');
	let showActionMenu = $state(false);
	let showDeleteConfirm = $state(false);
	let convertSubmitting = $state(false);

	let selectedContactIds: Set<string> = $state(new Set());
	$effect(() => {
		selectedContactIds = new Set<string>(
			(data.contacts ?? []).filter((c) => c.email).map((c) => c.id)
		);
	});

	function toggleContact(id: string) {
		const next = new Set(selectedContactIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedContactIds = next;
	}

	function openSend() {
		if (!showSend) {
			sendMessage = data.emailBody ?? '';
			selectedContactIds = new Set(
				(data.contacts ?? []).filter((c) => c.email).map((c) => c.id)
			);
		}
		showSend = true;
		showActionMenu = false;
	}

	const hasSentBefore = $derived(data.logs.some((l) => l.action === 'email_sent'));
	const hasEmailRecipient = $derived(
		!!(estimate.expand?.client?.email) ||
		(data.contacts ?? []).some((c) => c.email)
	);
	const sendDisabledReason = $derived(
		!hasEmailRecipient
			? 'This client has no email address or contacts — add one on the client page'
			: !data.smtpConfigured
			? 'SMTP is not configured — set it up under Settings → Email'
			: null
	);
	let showSendTip = $state(false);

	const isTerminal = $derived(
		estimate.status === 'accepted' || estimate.status === 'declined'
	);

	// Log action icon/label map
	const LOG_ICONS: Record<string, string> = {
		estimate_created: '📄',
		status_changed: '🔄',
		email_sent: '📧',
		note: '💬',
		edited: '✏️',
		converted_to_invoice: '🧾'
	};
</script>

<svelte:head>
	<title>{estimate.number} — Yield</title>
</svelte:head>

<div class="max-w-5xl mx-auto">
	<!-- Toolbar -->
	<div class="mb-6 flex items-center justify-between gap-4 flex-wrap">
		<a href="/estimates" class="inline-flex items-center gap-1.5 text-sm" style="color: var(--color-muted-foreground)">
			<ArrowLeft size={15} /> Estimates
		</a>
		<div class="flex items-center gap-3">
			<span class="{STATUS_COLORS[displayStatus] ?? 'status-badge status-draft'}">
				{displayStatus.replace(/\b\w/g, c => c.toUpperCase())}
			</span>

			<div
				class="relative"
				role="group"
				onmouseenter={() => { if (displayStatus === 'draft') showSendTip = true; }}
				onmouseleave={() => (showSendTip = false)}
			>
				<div class="flex items-center rounded-lg overflow-hidden" style="background: var(--color-primary)">
					{#if displayStatus === 'draft'}
						<button
							onclick={sendDisabledReason ? undefined : openSend}
							disabled={!!sendDisabledReason}
							class="flex items-center gap-1.5 pl-3 pr-2.5 py-1.5 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
							style="color: var(--color-primary-foreground)"
						>
							<Send size={15} /> Send Estimate
						</button>
					{:else if displayStatus === 'sent' || displayStatus === 'expired'}
						<form method="POST" action="?/updateStatus" use:enhance={() => async ({ update, result }) => {
							showActionMenu = false;
							if (result.type === 'failure') addToast((result.data as any)?.error ?? 'Failed', 'error');
							else addToast('Marked as accepted');
							await update();
						}}>
							<input type="hidden" name="status" value="accepted" />
							<button type="submit" class="flex items-center gap-1.5 pl-3 pr-2.5 py-1.5 text-sm font-medium" style="color: var(--color-primary-foreground)">
								<CheckCircle size={15} /> Mark Accepted
							</button>
						</form>
					{:else if displayStatus === 'accepted'}
						<form method="POST" action="?/convertToInvoice" use:enhance={() => {
							convertSubmitting = true;
							return async ({ update, result }) => {
								convertSubmitting = false;
								if (result.type === 'failure') addToast((result.data as any)?.error ?? 'Conversion failed', 'error');
								await update();
							};
						}}>
							<button type="submit" disabled={convertSubmitting} class="flex items-center gap-1.5 pl-3 pr-2.5 py-1.5 text-sm font-medium disabled:opacity-50" style="color: var(--color-primary-foreground)">
								<ArrowRight size={15} /> {convertSubmitting ? 'Creating…' : 'Create Invoice'}
							</button>
						</form>
					{:else}
						<a
							href="/api/estimate/{estimate.id}/pdf"
							target="_blank"
							class="flex items-center gap-1.5 pl-3 pr-2.5 py-1.5 text-sm font-medium"
							style="color: var(--color-primary-foreground)"
						>
							<Download size={15} /> Download PDF
						</a>
					{/if}

					<button
						onclick={() => (showActionMenu = !showActionMenu)}
						aria-label="More actions"
						class="flex items-center px-2 py-1.5 border-l"
						style="color: var(--color-primary-foreground); border-color: color-mix(in srgb, var(--color-primary-foreground) 35%, transparent)"
					>
						<ChevronDown size={14} />
					</button>
				</div>

				{#if sendDisabledReason && showSendTip && displayStatus === 'draft' && !showActionMenu}
					<span
						role="tooltip"
						class="absolute top-full right-0 mt-2.5 z-50 w-56 rounded-xl px-3 py-2.5 text-xs leading-relaxed shadow-lg pointer-events-none whitespace-normal"
						style="background-color: var(--color-card); color: var(--color-muted-foreground); border: 1px solid var(--color-border); box-shadow: 0 4px 16px -2px color-mix(in srgb, var(--color-foreground) 12%, transparent)"
					>{sendDisabledReason}<span
							aria-hidden="true"
							class="absolute bottom-full right-4"
							style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:5px solid var(--color-border);"
						></span></span>
				{/if}

				{#if showActionMenu}
					<button class="fixed inset-0 z-30" onclick={() => (showActionMenu = false)} aria-hidden="true" tabindex="-1" style="background: transparent; border: none; cursor: default"></button>
				{/if}

				{#if showActionMenu}
					<div class="absolute right-0 top-full mt-1.5 z-40 rounded-lg border shadow-lg min-w-48 py-1 overflow-hidden" style="background: var(--color-card); border-color: var(--color-border)">
						{#if !isTerminal}
							<button onclick={openSend} disabled={!!sendDisabledReason} class="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left disabled:opacity-50 hover:bg-muted transition-colors" style="color: var(--color-foreground)">
								<Send size={14} /> {hasSentBefore ? 'Re-send Estimate' : 'Send Estimate'}
							</button>
						{/if}

						{#if displayStatus === 'sent' || displayStatus === 'expired' || displayStatus === 'draft'}
							<form method="POST" action="?/updateStatus" use:enhance={() => async ({ update, result }) => {
								showActionMenu = false;
								if (result.type === 'failure') addToast((result.data as any)?.error ?? 'Failed', 'error');
								else addToast('Marked as accepted');
								await update();
							}}>
								<input type="hidden" name="status" value="accepted" />
								<button type="submit" class="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-muted transition-colors" style="color: var(--color-foreground)">
									<CheckCircle size={14} /> Mark Accepted
								</button>
							</form>
							<form method="POST" action="?/updateStatus" use:enhance={() => async ({ update, result }) => {
								showActionMenu = false;
								if (result.type === 'failure') addToast((result.data as any)?.error ?? 'Failed', 'error');
								else addToast('Marked as declined');
								await update();
							}}>
								<input type="hidden" name="status" value="declined" />
								<button type="submit" class="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-muted transition-colors" style="color: var(--color-foreground)">
									<XCircle size={14} /> Mark Declined
								</button>
							</form>
						{/if}

						{#if estimate.status === 'accepted' && !estimate.invoice}
							<form method="POST" action="?/convertToInvoice" use:enhance={() => {
								convertSubmitting = true;
								return async ({ update, result }) => {
									convertSubmitting = false;
									showActionMenu = false;
									if (result.type === 'failure') addToast((result.data as any)?.error ?? 'Conversion failed', 'error');
									await update();
								};
							}}>
								<button type="submit" class="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-muted transition-colors" style="color: var(--color-foreground)">
									<ArrowRight size={14} /> Create Invoice
								</button>
							</form>
						{/if}

						<a href="/api/estimate/{estimate.id}/pdf" target="_blank" onclick={() => (showActionMenu = false)} class="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted transition-colors" style="color: var(--color-foreground)">
							<Download size={14} /> Download PDF
						</a>
						<a href="/estimates/{estimate.id}/edit" onclick={() => (showActionMenu = false)} class="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted transition-colors" style="color: var(--color-foreground)">
							<Pencil size={14} /> Edit
						</a>

						{#if estimate.status !== 'draft'}
							<div class="my-1 border-t" style="border-color: var(--color-border)"></div>
							<form method="POST" action="?/updateStatus" use:enhance={() => async ({ update, result }) => {
								showActionMenu = false;
								if (result.type === 'failure') addToast((result.data as any)?.error ?? 'Failed', 'error');
								else addToast('Moved to draft');
								await update();
							}}>
								<input type="hidden" name="status" value="draft" />
								<button type="submit" class="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-muted transition-colors" style="color: var(--color-foreground)">
									<FileText size={14} /> Mark as Draft
								</button>
							</form>
						{/if}

						<div class="my-1 border-t" style="border-color: var(--color-border)"></div>
						<button onclick={() => { showDeleteConfirm = true; showActionMenu = false; }} class="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-muted transition-colors" style="color: var(--color-destructive)">
							<Trash2 size={14} /> Delete
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Body grid -->
	<div class="grid gap-6 lg:grid-cols-3">
		<!-- Left col: estimate details -->
		<div class="lg:col-span-2 space-y-6">
			<!-- Estimate header card -->
			<div class="rounded-xl border p-6" style="background: var(--color-card); border-color: var(--color-border)">
				<div class="flex items-start justify-between mb-6">
					<div>
						<p class="text-2xl font-bold" style="color: var(--color-foreground)">{estimate.number}</p>
						{#if estimate.expand?.client}
							<p class="text-sm mt-1" style="color: var(--color-muted-foreground)">{estimate.expand.client.name}</p>
						{/if}
					</div>
					<div class="text-right">
						<p class="text-2xl font-bold" style="color: var(--color-foreground)">{fmt(total)}</p>
						<p class="text-xs mt-1 uppercase tracking-wide font-medium" style="color: var(--color-muted-foreground)">Total</p>
					</div>
				</div>

				<!-- Meta row -->
				<div class="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t" style="border-color: var(--color-border)">
					<div>
						<p class="text-xs font-semibold uppercase tracking-wide mb-1" style="color: var(--color-muted-foreground)">Issued</p>
						<p class="text-sm" style="color: var(--color-foreground)">{fmtDate(estimate.issue_date)}</p>
					</div>
					<div>
						<p class="text-xs font-semibold uppercase tracking-wide mb-1" style="color: var(--color-muted-foreground)">Valid Until</p>
						<p class="text-sm" style="color: {isExpired ? 'var(--color-destructive)' : 'var(--color-foreground)'}">{fmtDate(estimate.expiry_date)}</p>
					</div>
					{#if estimate.invoice}
						<div>
							<p class="text-xs font-semibold uppercase tracking-wide mb-1" style="color: var(--color-muted-foreground)">Invoice</p>
							<a href="/invoices/{estimate.invoice}" class="text-sm font-medium underline underline-offset-2" style="color: var(--color-primary)">View Invoice →</a>
						</div>
					{/if}
				</div>
			</div>

			<!-- Line items -->
			<div class="rounded-xl border overflow-hidden" style="background: var(--color-card); border-color: var(--color-border)">
				<table class="w-full">
					<thead>
						<tr style="background: var(--color-muted); border-bottom: 1px solid var(--color-border)">
							<th class="text-left px-4 py-3" style="color: var(--color-muted-foreground)">Description</th>
							<th class="text-right px-4 py-3 hidden sm:table-cell" style="color: var(--color-muted-foreground)">Qty</th>
							<th class="text-right px-4 py-3 hidden sm:table-cell" style="color: var(--color-muted-foreground)">Unit Price</th>
							<th class="text-right px-4 py-3" style="color: var(--color-muted-foreground)">Amount</th>
						</tr>
					</thead>
					<tbody>
						{#each items as item}
							<tr style="border-bottom: 1px solid var(--color-border)">
								<td class="px-4 py-3 text-sm" style="color: var(--color-foreground)">{item.description || '—'}</td>
								<td class="px-4 py-3 text-sm text-right hidden sm:table-cell" style="color: var(--color-muted-foreground)">{item.quantity}</td>
								<td class="px-4 py-3 text-sm text-right hidden sm:table-cell" style="color: var(--color-muted-foreground)">{fmt(item.unit_price)}</td>
								<td class="px-4 py-3 text-sm text-right font-medium" style="color: var(--color-foreground)">{fmt(item.quantity * item.unit_price)}</td>
							</tr>
						{/each}
					</tbody>
				</table>

				<!-- Totals -->
				<div class="flex justify-end p-4" style="background: var(--color-muted); border-top: 1px solid var(--color-border)">
					<div class="w-56 space-y-1.5">
						<div class="flex justify-between text-sm" style="color: var(--color-muted-foreground)">
							<span>Subtotal</span><span>{fmt(subtotal)}</span>
						</div>
						{#if estimate.tax_percent > 0}
							<div class="flex justify-between text-sm" style="color: var(--color-muted-foreground)">
								<span>Tax ({estimate.tax_percent}%)</span><span>{fmt(taxAmt)}</span>
							</div>
						{/if}
						<div class="flex justify-between text-sm font-semibold pt-1 border-t" style="color: var(--color-foreground); border-color: var(--color-border)">
							<span>Total</span><span>{fmt(total)}</span>
						</div>
					</div>
				</div>
			</div>

			<!-- Notes -->
			{#if estimate.notes}
				<div class="rounded-xl border p-5" style="background: var(--color-card); border-color: var(--color-border)">
					<p class="text-xs font-semibold uppercase tracking-wide mb-2" style="color: var(--color-muted-foreground)">Notes</p>
					<div class="text-sm whitespace-pre-wrap" style="color: var(--color-foreground)">{estimate.notes}</div>
				</div>
			{/if}
		</div>

		<!-- Right col: activity + actions -->
		<div class="space-y-5">
			<!-- Send panel -->
			{#if showSend}
				<div class="rounded-xl border p-5" style="background: var(--color-card); border-color: var(--color-border)">
					<p class="text-sm font-semibold mb-4" style="color: var(--color-foreground)">Send Estimate</p>
					<FormAlert message={form?.sendError} />

					<form method="POST" action="?/sendEstimate" use:enhance={() => {
						sendSubmitting = true;
						return async ({ update, result }) => {
							sendSubmitting = false;
							if (result.type !== 'failure' && result.type !== 'error') {
								addToast('Estimate sent');
								showSend = false;
							}
							await update();
						};
					}}>
						<!-- Contacts -->
						{#if data.contacts.length > 0}
							<div class="mb-3">
								<p class="text-xs font-medium mb-2" style="color: var(--color-muted-foreground)">Recipients</p>
								<div class="space-y-1.5">
									{#each data.contacts.filter(c => c.email) as contact}
										<label class="flex items-center gap-2 text-sm cursor-pointer">
											<input
												type="checkbox"
												name="contact_ids"
												value={contact.id}
												checked={selectedContactIds.has(contact.id)}
												onchange={() => toggleContact(contact.id)}
											/>
											<span style="color: var(--color-foreground)">{contact.first_name} {contact.last_name}</span>
											<span class="text-xs" style="color: var(--color-muted-foreground)">{contact.email}</span>
										</label>
									{/each}
								</div>
							</div>
						{/if}

						<div class="mb-3">
							<label for="send-extra" class="block text-xs font-medium mb-1" style="color: var(--color-muted-foreground)">Additional recipients</label>
							<input
								id="send-extra"
								type="text"
								name="extra_recipients"
								bind:value={extraRecipients}
								placeholder="email@example.com, …"
								class="w-full px-3 py-2 rounded-lg border text-sm"
								style="background: var(--color-background); color: var(--color-foreground); border-color: var(--color-border)"
							/>
						</div>

						<div class="mb-4">
							<label for="send-msg" class="block text-xs font-medium mb-1" style="color: var(--color-muted-foreground)">Message</label>
							<RichTextarea id="send-msg" name="message" bind:value={sendMessage} rows={7} />
						</div>

						<div class="flex gap-2">
							<button type="submit" disabled={sendSubmitting} class="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50" style="background: var(--color-primary); color: var(--color-primary-foreground)">
								{sendSubmitting ? 'Sending…' : 'Send'}
							</button>
							<button type="button" onclick={() => (showSend = false)} class="px-4 py-2 rounded-lg text-sm border transition-colors hover:bg-muted" style="border-color: var(--color-border); color: var(--color-muted-foreground)">
								Cancel
							</button>
						</div>
					</form>
				</div>
			{/if}

			<!-- Quick actions (shown when send panel is closed) -->
			{#if !showSend}
				<div class="rounded-xl border p-5 space-y-2" style="background: var(--color-card); border-color: var(--color-border)">
					<p class="text-xs font-semibold uppercase tracking-wide mb-3" style="color: var(--color-muted-foreground)">Actions</p>

					{#if estimate.status === 'accepted' && !estimate.invoice}
						<form method="POST" action="?/convertToInvoice" use:enhance={() => {
							convertSubmitting = true;
							return async ({ update, result }) => {
								convertSubmitting = false;
								if (result.type === 'failure') addToast((result.data as any)?.error ?? 'Conversion failed', 'error');
								await update();
							};
						}}>
							<button type="submit" disabled={convertSubmitting} class="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors hover:opacity-90 disabled:opacity-50" style="background: var(--color-primary); color: var(--color-primary-foreground)">
								<ArrowRight size={15} /> {convertSubmitting ? 'Creating…' : 'Create Invoice'}
							</button>
						</form>
					{/if}

					<a href="/estimates/{estimate.id}/edit" class="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm border transition-colors hover:bg-muted" style="border-color: var(--color-border); color: var(--color-foreground)">
						<Pencil size={14} /> Edit Estimate
					</a>
					<a href="/api/estimate/{estimate.id}/pdf" target="_blank" class="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm border transition-colors hover:bg-muted" style="border-color: var(--color-border); color: var(--color-foreground)">
						<Download size={14} /> Download PDF
					</a>
				</div>
			{/if}

			<!-- Activity log -->
			<div class="rounded-xl border p-5" style="background: var(--color-card); border-color: var(--color-border)">
				<p class="text-xs font-semibold uppercase tracking-wide mb-4" style="color: var(--color-muted-foreground)">Activity</p>

				{#if data.logs.length === 0}
					<p class="text-sm" style="color: var(--color-muted-foreground)">No activity yet.</p>
				{:else}
					<ol class="relative border-l space-y-4 ml-2" style="border-color: var(--color-border)">
						{#each [...data.logs].reverse() as log}
							<li class="ml-4">
								<span class="absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full text-[10px]" style="background: var(--color-muted); color: var(--color-muted-foreground)">
									{LOG_ICONS[log.action] ?? '·'}
								</span>
								<p class="text-sm" style="color: var(--color-foreground)">{log.detail}</p>
								<p class="text-xs mt-0.5" style="color: var(--color-muted-foreground)">{fmtDateTime(log.occurred_at || log.created)}</p>
							</li>
						{/each}
					</ol>
				{/if}

				<!-- Add note -->
				<form method="POST" action="?/addNote" class="mt-5 pt-4 border-t" style="border-color: var(--color-border)"
					use:enhance={() => {
						noteSubmitting = true;
						return async ({ update, result }) => {
							noteSubmitting = false;
							if (result.type !== 'failure' && result.type !== 'error') noteText = '';
							await update();
						};
					}}
				>
					<label for="note-text" class="block text-xs font-medium mb-1.5" style="color: var(--color-muted-foreground)">Add note</label>
					<textarea
						id="note-text"
						name="note"
						rows={2}
						bind:value={noteText}
						placeholder="Internal note…"
						class="w-full px-3 py-2 rounded-lg border text-sm resize-none"
						style="background: var(--color-background); color: var(--color-foreground); border-color: var(--color-border)"
					></textarea>
					<button type="submit" disabled={noteSubmitting || !noteText.trim()} class="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors hover:opacity-90 disabled:opacity-50" style="background: var(--color-primary); color: var(--color-primary-foreground)">
						<MessageSquare size={13} /> {noteSubmitting ? 'Saving…' : 'Add Note'}
					</button>
				</form>
			</div>
		</div>
	</div>
</div>

<!-- Delete confirmation dialog -->
{#if showDeleteConfirm}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.5)">
		<div class="rounded-xl border p-6 w-full max-w-sm shadow-xl" style="background: var(--color-card); border-color: var(--color-border)">
			<h3 class="text-base font-semibold mb-2" style="color: var(--color-foreground)">Delete Estimate</h3>
			<p class="text-sm mb-5" style="color: var(--color-muted-foreground)">This will permanently delete estimate {estimate.number} and all its data. This cannot be undone.</p>
			<div class="flex gap-3">
				<form method="POST" action="?/delete" class="flex-1" use:enhance>
					<button type="submit" class="w-full py-2 rounded-lg text-sm font-medium" style="background: var(--color-destructive); color: white">Delete</button>
				</form>
				<button onclick={() => (showDeleteConfirm = false)} class="flex-1 py-2 rounded-lg text-sm border transition-colors hover:bg-muted" style="border-color: var(--color-border); color: var(--color-muted-foreground)">Cancel</button>
			</div>
		</div>
	</div>
{/if}
