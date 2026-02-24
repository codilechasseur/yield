<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowLeft, Download, Pencil, Trash2, MessageSquare, Mail, ArrowRight, FileText, Banknote, Send, ChevronDown } from 'lucide-svelte';
	import { STATUS_COLORS } from '$lib/pocketbase.js';
	import { addToast } from '$lib/toasts.svelte.js';
	import RichTextarea from '$lib/components/RichTextarea.svelte';
	import FormAlert from '$lib/components/FormAlert.svelte';
	import type { PageData, ActionData } from './$types.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let invoice = $derived(data.invoice);
	let items = $derived(data.items);

	function fmt(n: number, currency = invoice.expand?.client?.currency ?? 'USD'): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
	}
	function fmtDate(d: string) {
		return d ? new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—';
	}
	function fmtDateTime(d: string) {
		return d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
	}

	const subtotal = $derived(items.reduce((s, i) => s + i.quantity * i.unit_price, 0));
	const taxAmt = $derived(subtotal * (invoice.tax_percent / 100));
	const total = $derived(subtotal + taxAmt);

	let remaining = $derived(Math.round((total - (invoice.paid_amount ?? 0)) * 100) / 100);

	// Overdue is computed — a sent invoice past its due date
	const isOverdue = $derived(
		invoice.status === 'sent' && !!invoice.due_date && new Date(invoice.due_date) < new Date()
	);
	const displayStatus = $derived(isOverdue ? 'overdue' : invoice.status);

	let noteText = $state('');
	let noteSubmitting = $state(false);
	let showPayment = $state(false);
	let paymentAmount = $state('');
	let paymentSubmitting = $state(false);
	let showSend = $state(false);
	let sendMessage = $state('');
	let sendSubmitting = $state(false);
	let extraRecipients = $state('');
	let showActionMenu = $state(false);
	let showDeleteConfirm = $state(false);

	// Pre-fill send panel from server-resolved templates
	function openSend() {
		if (!showSend) sendMessage = data.emailBody ?? '';
		showSend = true;
		showActionMenu = false;
	}

	const hasSentBefore = $derived(data.logs.some((l) => l.action === 'email_sent'));
	const sendDisabledReason = $derived(
		!invoice.expand?.client?.email
			? 'This client has no email address — add one on the client page'
			: !data.smtpConfigured
			? 'SMTP is not configured — set it up under Settings → Email'
			: null
	);
	let showSendTip = $state(false);

	function openPaymentForm() {
		paymentAmount = remaining.toFixed(2);
		showPayment = true;
		showActionMenu = false;
	}
</script>

<svelte:head>
	<title>{invoice.number} — Yield</title>
</svelte:head>

<div class="max-w-5xl mx-auto">
	<!-- Toolbar -->
	<div class="mb-6 flex items-center justify-between gap-4 flex-wrap">
		<a href="/invoices" class="inline-flex items-center gap-1.5 text-sm" style="color: var(--color-muted-foreground)">
			<ArrowLeft size={15} /> Invoices
		</a>
		<div class="flex items-center gap-3">
			<!-- Status badge (read-only display) -->
			<span class="{STATUS_COLORS[displayStatus] ?? 'status-badge'}">
				{displayStatus === 'written_off' ? 'Written Off' : displayStatus.replace(/\b\w/g, c => c.toUpperCase())}
			</span>

			<!-- Split action button -->
			<div
				class="relative"
				role="group"
				onmouseenter={() => { if (displayStatus === 'draft') showSendTip = true; }}
				onmouseleave={() => (showSendTip = false)}
			>
				<div class="flex items-center rounded-lg overflow-hidden" style="background: var(--color-primary)">
					<!-- Primary action — context-aware -->
					{#if displayStatus === 'draft'}
					<button
						onclick={sendDisabledReason ? undefined : openSend}
						disabled={!!sendDisabledReason}
						class="flex items-center gap-1.5 pl-3 pr-2.5 py-1.5 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
						style="color: var(--color-primary-foreground)"
					>
						<Send size={15} /> Send Invoice
					</button>
					{:else if displayStatus === 'sent' || displayStatus === 'overdue'}
						<button
							onclick={openPaymentForm}
							class="flex items-center gap-1.5 pl-3 pr-2.5 py-1.5 text-sm font-medium"
							style="color: var(--color-primary-foreground)"
						>
							<Banknote size={15} /> Record Payment
						</button>
					{:else}
						<a
							href="/api/invoice/{invoice.id}/pdf"
							target="_blank"
							class="flex items-center gap-1.5 pl-3 pr-2.5 py-1.5 text-sm font-medium"
							style="color: var(--color-primary-foreground)"
						>
							<Download size={15} /> Download PDF
						</a>
					{/if}
					<!-- Chevron toggles dropdown -->
					<button
						onclick={() => (showActionMenu = !showActionMenu)}
						aria-label="More actions"
						class="flex items-center px-2 py-1.5 border-l"
						style="color: var(--color-primary-foreground); border-color: color-mix(in srgb, var(--color-primary-foreground) 35%, transparent)"
					>
						<ChevronDown size={14} />
					</button>
				</div>

				<!-- Send disabled tooltip -->
				{#if sendDisabledReason && showSendTip}
					<span
						role="tooltip"
						class="absolute top-full left-0 mt-2.5 z-50 w-56 rounded-xl px-3 py-2.5 text-xs leading-relaxed shadow-lg pointer-events-none whitespace-normal"
						style="background-color: var(--color-card); color: var(--color-muted-foreground); border: 1px solid var(--color-border); box-shadow: 0 4px 16px -2px color-mix(in srgb, var(--color-foreground) 12%, transparent)"
					>{sendDisabledReason}<span
							aria-hidden="true"
							class="absolute bottom-full left-4"
							style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:5px solid var(--color-border);"
						></span></span>
				{/if}

				<!-- Click-outside backdrop -->
				{#if showActionMenu}
					<button
						class="fixed inset-0 z-30"
						onclick={() => (showActionMenu = false)}
						aria-hidden="true"
						tabindex="-1"
						style="background: transparent; border: none; cursor: default"
					></button>
				{/if}

				<!-- Dropdown menu -->
				{#if showActionMenu}
					<div
						class="absolute right-0 top-full mt-1.5 z-40 rounded-lg border shadow-lg min-w-48 py-1 overflow-hidden"
						style="background: var(--color-card); border-color: var(--color-border)"
					>
					<!-- Send / Re-send (not for paid or written_off) -->
					{#if invoice.status !== 'paid' && invoice.status !== 'written_off'}
						<button
							onclick={openSend}
							disabled={!!sendDisabledReason}
							class="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left disabled:opacity-50 hover:bg-muted transition-colors"
							style="color: var(--color-foreground)"
						>
							<Send size={14} /> {hasSentBefore ? 'Re-send Invoice' : 'Send Invoice'}
						</button>
					{/if}
						<!-- Record Payment (sent / overdue only, not already covered by primary) -->
						{#if displayStatus !== 'sent' && displayStatus !== 'overdue' && invoice.status !== 'paid' && invoice.status !== 'draft' && invoice.status !== 'written_off'}
							<button
								onclick={openPaymentForm}
								class="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-muted transition-colors"
								style="color: var(--color-foreground)"
							>
								<Banknote size={14} /> Record Payment
							</button>
						{/if}
						<!-- Download PDF -->
						<a
							href="/api/invoice/{invoice.id}/pdf"
							target="_blank"
							onclick={() => (showActionMenu = false)}
							class="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted transition-colors"
							style="color: var(--color-foreground)"
						>
							<Download size={14} /> Download PDF
						</a>
						<!-- Edit -->
						<a
							href="/invoices/{invoice.id}/edit"
							onclick={() => (showActionMenu = false)}
							class="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted transition-colors"
							style="color: var(--color-foreground)"
						>
							<Pencil size={14} /> Edit
						</a>

						<div class="my-1 border-t" style="border-color: var(--color-border)"></div>

						<!-- Mark as Draft -->
						{#if invoice.status !== 'draft'}
							<form method="POST" action="?/updateStatus" use:enhance={() => async ({ update, result }) => { showActionMenu = false; await update(); if (result.type !== 'failure') addToast('Moved to draft'); }}>
								<input type="hidden" name="status" value="draft" />
								<button type="submit" class="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-muted transition-colors" style="color: var(--color-foreground)">
									<FileText size={14} /> Mark as Draft
								</button>
							</form>
						{/if}
						<!-- Mark as Written Off -->
						{#if invoice.status !== 'written_off'}
							<form method="POST" action="?/updateStatus" use:enhance={() => async ({ update, result }) => { showActionMenu = false; await update(); if (result.type !== 'failure') addToast('Marked as written off'); }}>
								<input type="hidden" name="status" value="written_off" />
								<button type="submit" class="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-muted transition-colors" style="color: var(--color-muted-foreground)">
									<FileText size={14} /> Mark as Written Off
								</button>
							</form>
						{/if}

						<div class="my-1 border-t" style="border-color: var(--color-border)"></div>

						<!-- Delete -->
						<button
							onclick={() => { showActionMenu = false; showDeleteConfirm = true; }}
							class="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-red-50 transition-colors"
							style="color: var(--color-destructive, #dc2626)"
						>
							<Trash2 size={14} /> Delete
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Delete confirmation modal -->
	{#if showDeleteConfirm}
		<div class="fixed inset-0 z-50 flex items-center justify-center" style="background: rgba(0,0,0,0.4)">
			<div class="rounded-xl border shadow-xl p-5 max-w-sm w-full mx-4" style="background: var(--color-card); border-color: var(--color-border)">
				<p class="font-semibold mb-1" style="color: var(--color-foreground)">Delete this invoice?</p>
				<p class="text-sm mb-4" style="color: var(--color-muted-foreground)">This action cannot be undone.</p>
				<div class="flex gap-2 justify-end">
					<button onclick={() => (showDeleteConfirm = false)} class="px-3 py-1.5 rounded-lg border text-sm font-medium hover:bg-muted transition-colors" style="border-color: var(--color-border); color: var(--color-muted-foreground)">Cancel</button>
					<form method="POST" action="?/delete" use:enhance={() => async ({ update, result }) => { if (result.type !== 'failure') addToast('Invoice deleted'); await update(); }}>
						<button type="submit" class="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors">Delete</button>
					</form>
				</div>
			</div>
		</div>
	{/if}

	<FormAlert message={form?.error} />
	<FormAlert message={form?.sendError} />
	<FormAlert message={form?.sendSuccess ? `Invoice emailed to ${invoice.expand?.client?.email}.` : null} variant="success" />

	<!-- Record Payment panel -->
	{#if showPayment}
		<div class="mb-6 rounded-xl border p-5" style="background: var(--color-card); border-color: var(--color-border)">
			<div class="flex items-center justify-between mb-4">
			<h3 class="font-semibold text-sm" style="color: var(--color-foreground)">Record Payment</h3>
				<span class="text-xs" style="color: var(--color-muted-foreground)">
					Balance due: <strong>{fmt(remaining)}</strong>
				</span>
			</div>
			<form
				method="POST"
				action="?/recordPayment"
				class="flex flex-wrap items-end gap-3"
				use:enhance={() => {
					paymentSubmitting = true;
					return async ({ update }) => {
						paymentSubmitting = false;
						showPayment = false;
						await update();
					};
				}}
			>
				<div class="flex flex-col gap-1">
					<label for="pay-amount" class="text-xs font-medium" style="color: var(--color-muted-foreground)">Amount</label>
					<input
						id="pay-amount"
						name="amount"
						type="number"
						step="0.01"
						min="0.01"
						max={remaining}
						required
						bind:value={paymentAmount}
						class="px-3 py-2 rounded-lg border text-sm outline-none w-36 font-mono"
						style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
					/>
				</div>
				<div class="flex flex-col gap-1 flex-1 min-w-40">
					<label for="pay-note" class="text-xs font-medium" style="color: var(--color-muted-foreground)">Note (optional)</label>
					<input
						id="pay-note"
						name="note"
						type="text"
						placeholder="e.g. cheque #1234"
						class="px-3 py-2 rounded-lg border text-sm outline-none"
						style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
					/>
				</div>
				<div class="flex gap-2">
					<button
						type="button"
						onclick={() => (showPayment = false)}
						class="px-3 py-2 rounded-lg border text-sm font-medium transition-colors hover:bg-muted"
						style="border-color: var(--color-border); color: var(--color-muted-foreground)"
					>Cancel</button>
					<button
						type="submit"
						disabled={paymentSubmitting}
						class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-opacity hover:opacity-90"
						style="background-color: var(--color-primary); color: var(--color-primary-foreground)"
					>
						<Banknote size={14} /> {paymentSubmitting ? 'Saving…' : 'Record Payment'}
					</button>
				</div>
			</form>
		</div>
	{/if}

	<!-- Send Invoice panel -->
	{#if showSend}
		<div class="mb-6 rounded-xl border p-5" style="background: var(--color-card); border-color: var(--color-border)">
			<div class="flex items-center justify-between mb-4">
				<h3 class="font-semibold text-sm" style="color: var(--color-foreground)">{hasSentBefore ? 'Re-send Invoice' : 'Send Invoice'}</h3>
				{#if invoice.expand?.client?.email}
					<span class="text-xs" style="color: var(--color-muted-foreground)">
						To: <strong>{invoice.expand.client.email}</strong>
					</span>
				{/if}
			</div>
			<form
				method="POST"
				action="?/sendInvoice"
				class="flex flex-col gap-3"
				use:enhance={() => {
					sendSubmitting = true;
					return async ({ update }) => {
						sendSubmitting = false;
						showSend = false;
						sendMessage = '';
						extraRecipients = '';
						await update();
					};
				}}
			>
				<div class="flex flex-col gap-1">
					<label for="send-recipients" class="text-xs font-medium" style="color: var(--color-muted-foreground)">Additional recipients <span style="color: var(--color-muted-foreground); font-weight:400;">(comma-separated)</span></label>
					<input
						id="send-recipients"
						name="extra_recipients"
						type="text"
						placeholder="e.g. accountant@example.com, boss@example.com"
						bind:value={extraRecipients}
						class="px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2"
						style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
					/>
				</div>
				<div class="flex flex-col gap-1">
					<label for="send-subject" class="text-xs font-medium" style="color: var(--color-muted-foreground)">Subject</label>
					<input
						id="send-subject"
						name="subject_preview"
						type="text"
						readonly
						value={data.emailSubject}
						class="px-3 py-2 rounded-lg border text-sm"
						style="background: var(--color-muted); border-color: var(--color-border); color: var(--color-muted-foreground)"
					/>
				</div>
				<div class="flex flex-col gap-1">
					<label for="send-message" class="text-xs font-medium" style="color: var(--color-muted-foreground)">Body</label>
				<RichTextarea
					id="send-message"
					name="message"
					rows={3}
					placeholder="Add a personal note to the email…"
					bind:value={sendMessage}
					class="px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 resize-none"
					style="background: var(--color-background); border-color: var(--color-border); color: var(--color-foreground)"
				/>
				</div>
				<p class="text-xs" style="color: var(--color-muted-foreground)">
					The invoice PDF will be attached automatically.
					{#if !invoice.expand?.client?.email}
						<span class="font-medium" style="color: var(--color-foreground)">No client email on file — you must enter at least one recipient above.</span>
					{/if}
				</p>
				<div class="flex gap-2 justify-end">
					<button
						type="button"
						onclick={() => (showSend = false)}
						class="px-3 py-2 rounded-lg border text-sm font-medium transition-colors hover:bg-muted"
						style="border-color: var(--color-border); color: var(--color-muted-foreground)"
					>Cancel</button>
					<button
						type="submit"
						disabled={sendSubmitting}
						class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-opacity hover:opacity-90"
						style="background-color: var(--color-primary); color: var(--color-primary-foreground)"
					>
						<Send size={14} /> {sendSubmitting ? 'Sending…' : hasSentBefore ? 'Re-send' : 'Send'}
					</button>
				</div>
			</form>
		</div>
	{/if}

	<!-- Invoice preview card -->
	<div class="rounded-xl border overflow-hidden" style="background: var(--color-card); border-color: var(--color-border)">
		<!-- Header band -->
		<div class="px-8 py-6 border-b" style="border-color: var(--color-border)">
			<div class="flex items-start justify-between">
				<div>
					<h1 class="text-2xl font-bold" style="color: var(--color-primary)">INVOICE</h1>
					<p class="text-lg font-semibold mt-1" style="color: var(--color-foreground)">{invoice.number}</p>
				</div>
				<span class="{STATUS_COLORS[displayStatus] ?? 'status-badge'}">{displayStatus === 'written_off' ? 'Written Off' : displayStatus.replace(/\b\w/g, c => c.toUpperCase())}</span>
			</div>

			<div class="mt-6 grid grid-cols-4 gap-6">
				<div>
					<p class="text-xs font-medium uppercase tracking-wide mb-1" style="color: var(--color-muted-foreground)">Billed To</p>
					{#if invoice.expand?.client}
						<p class="font-semibold" style="color: var(--color-foreground)">{invoice.expand.client.name}</p>
						{#if invoice.expand.client.email}
							<p class="text-sm mt-0.5" style="color: var(--color-muted-foreground)">{invoice.expand.client.email}</p>
						{/if}
						{#if invoice.expand.client.address}
							<p class="text-sm mt-1 whitespace-pre-line" style="color: var(--color-muted-foreground)">{invoice.expand.client.address}</p>
						{/if}
					{:else}
						<p class="text-sm" style="color: var(--color-muted-foreground)">—</p>
					{/if}
				</div>
				<div>
					<p class="text-xs font-medium uppercase tracking-wide mb-1" style="color: var(--color-muted-foreground)">Issue Date</p>
					<p class="font-medium" style="color: var(--color-foreground)">{fmtDate(invoice.issue_date)}</p>
				</div>
				<div>
					<p class="text-xs font-medium uppercase tracking-wide mb-1" style="color: var(--color-muted-foreground)">Payment Terms</p>
					<p class="font-medium" style="color: var(--color-foreground)">
						{#if invoice.payment_terms === 'upon_receipt'}Upon Receipt
						{:else if invoice.payment_terms === 'net_15'}Net 15
						{:else if invoice.payment_terms === 'net_30'}Net 30
						{:else if invoice.payment_terms === 'net_45'}Net 45
						{:else if invoice.payment_terms === 'net_60'}Net 60
						{:else}—{/if}
					</p>
				</div>
				<div>
					<p class="text-xs font-medium uppercase tracking-wide mb-1" style="color: var(--color-muted-foreground)">Due Date</p>
					<p class="font-medium" style="color: var(--color-foreground)">{fmtDate(invoice.due_date)}</p>
				</div>
			</div>
		</div>

		<!-- Line items -->
		<table class="w-full">
			<thead>
				<tr style="border-bottom: 1px solid var(--color-border); background: var(--color-muted)">
					<th scope="col" class="px-8 py-3 text-left text-xs font-medium uppercase tracking-wide w-full" style="color: var(--color-muted-foreground)">Description</th>
				<th scope="col" class="px-3 py-3 text-center text-xs font-medium uppercase tracking-wide whitespace-nowrap" style="color: var(--color-muted-foreground)">Qty</th>
				<th scope="col" class="px-3 py-3 text-center text-xs font-medium uppercase tracking-wide whitespace-nowrap" style="color: var(--color-muted-foreground)">Unit Price</th>
					<th scope="col" class="pl-3 pr-8 py-3 text-right text-xs font-medium uppercase tracking-wide whitespace-nowrap" style="color: var(--color-muted-foreground)">Amount</th>
				</tr>
			</thead>
			<tbody>
				{#each items as item}
					<tr style="border-bottom: 1px solid var(--color-border)">
						<td class="px-8 py-4 text-sm w-full" style="color: var(--color-foreground)">{item.description || '—'}</td>
					<td class="px-3 py-4 text-sm text-center font-mono whitespace-nowrap" style="color: var(--color-muted-foreground)">{item.quantity}</td>
					<td class="px-3 py-4 text-sm text-center font-mono whitespace-nowrap" style="color: var(--color-muted-foreground)">{fmt(item.unit_price)}</td>
						<td class="pl-3 pr-8 py-4 text-sm text-right font-mono font-medium whitespace-nowrap" style="color: var(--color-foreground)">{fmt(item.quantity * item.unit_price)}</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<!-- Totals -->
		<div class="px-8 py-6 border-t" style="border-color: var(--color-border); background: var(--color-muted)">
			<div class="max-w-xs ml-auto space-y-2">
				<div class="flex justify-between text-sm" style="color: var(--color-muted-foreground)">
					<span>Subtotal</span>
					<span class="font-mono">{fmt(subtotal)}</span>
				</div>
				{#if invoice.tax_percent > 0}
					<div class="flex justify-between text-sm" style="color: var(--color-muted-foreground)">
						<span>Tax ({invoice.tax_percent}%)</span>
						<span class="font-mono">{fmt(taxAmt)}</span>
					</div>
				{/if}
				<div class="flex justify-between text-base font-bold pt-2 border-t" style="border-color: var(--color-border); color: var(--color-foreground)">
					<span>Total</span>
					<span class="font-mono">{fmt(total)}</span>
				</div>
				{#if (data.invoice.paid_amount ?? 0) > 0 && data.invoice.status !== 'paid'}
					<div class="flex justify-between text-sm pt-1" style="color: var(--color-muted-foreground)">
						<span>Paid</span>
						<span class="font-mono">{fmt(data.invoice.paid_amount)}</span>
					</div>
					<div class="flex justify-between text-sm font-semibold" style="color: var(--color-foreground)">
						<span>Balance due</span>
						<span class="font-mono">{fmt(remaining)}</span>
					</div>
				{/if}
			</div>
		</div>

		{#if invoice.notes}
			<div class="px-8 py-4 border-t" style="border-color: var(--color-border)">
				<p class="text-xs font-medium uppercase tracking-wide mb-1" style="color: var(--color-muted-foreground)">Notes</p>
				<p class="text-sm whitespace-pre-line" style="color: var(--color-foreground)">{invoice.notes}</p>
			</div>
		{/if}
	</div>

	<!-- Activity Log -->
	<div class="mt-8">
		<h3 class="text-base font-semibold mb-4" style="color: var(--color-foreground)">Activity</h3>

		{#if data.logs.length > 0}
			<div class="rounded-xl border overflow-hidden mb-4" style="background: var(--color-card); border-color: var(--color-border)">
				{#each data.logs as log, i}
					<div
						class="flex items-start gap-3 px-5 py-3.5 text-sm"
						style={i < data.logs.length - 1 ? 'border-bottom: 1px solid var(--color-border)' : ''}
					>
						<!-- Icon -->
						<div class="mt-0.5 shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style="background: var(--color-muted)">
							{#if log.action === 'status_changed'}
								<ArrowRight size={12} style="color: var(--color-muted-foreground)" />
							{:else if log.action === 'note'}
								<MessageSquare size={12} style="color: var(--color-muted-foreground)" />
							{:else if log.action === 'email_sent'}
								<Mail size={12} style="color: var(--color-muted-foreground)" />
							{:else if log.action === 'invoice_created'}
								<FileText size={12} style="color: var(--color-muted-foreground)" />
							{:else if log.action === 'payment_recorded'}
						<Banknote size={12} style="color: var(--color-muted-foreground)" />
							{:else}
								<Pencil size={12} style="color: var(--color-muted-foreground)" />
							{/if}
						</div>
						<!-- Detail -->
						<div class="flex-1 min-w-0">
							{#if log.action === 'status_changed'}
								{@const parts = log.detail.split(' → ')}
								{@const fmtStatus = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
								<span style="color: var(--color-foreground)">Status changed: </span>
								<span class="{STATUS_COLORS[parts[0]] ?? ''}">{fmtStatus(parts[0])}</span>
								<span class="mx-1" style="color: var(--color-muted-foreground)">→</span>
								<span class="{STATUS_COLORS[parts[1]] ?? ''}">{fmtStatus(parts[1])}</span>
							{:else}
								<span style="color: var(--color-foreground)">{log.detail}</span>
							{/if}
						</div>
						<!-- Timestamp -->
						<span class="text-xs shrink-0" style="color: var(--color-muted-foreground)">{fmtDateTime(log.occurred_at || log.created)}</span>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Add note + log email sent -->
		<div class="flex flex-col gap-3 sm:flex-row sm:items-start">
			<form
				method="POST"
				action="?/addNote"
				class="flex-1 flex gap-2"
				use:enhance={() => {
					noteSubmitting = true;
					return async ({ update }) => {
						noteSubmitting = false;
						noteText = '';
						await update();
					};
				}}
			>
				<RichTextarea
					name="note"
					rows={1}
					placeholder="Add a note…"
					bind:value={noteText}
					class="flex-1 px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 resize-none"
					style="background: var(--color-card); border-color: var(--color-border); color: var(--color-foreground)"
				/>
				<button
					type="submit"
					disabled={!noteText.trim() || noteSubmitting}
					class="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium disabled:opacity-40 transition-colors hover:bg-muted"
					style="border-color: var(--color-border); color: var(--color-foreground)"
				>
					<MessageSquare size={14} /> Add note
				</button>
			</form>

			<form method="POST" action="?/logEmail" use:enhance>
				<button
					type="submit"
					class="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors hover:bg-muted"
					style="border-color: var(--color-border); color: var(--color-foreground)"
				>
					<Mail size={14} /> Log email sent
				</button>
			</form>
		</div>
	</div>
</div>
