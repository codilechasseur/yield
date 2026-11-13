<script lang="ts">
	import { CopyPlus } from 'lucide-svelte';
	import { STATUS_COLORS, formatCurrency } from '$lib/pocketbase.js';
	import { richTextToPlainText } from '$lib/rich-text.js';
	import type { RecentInvoice } from '$lib/types.js';

	interface Props {
		clientId: string;
		clientName: string;
		currency?: string;
		onCopyItems: (invoice: RecentInvoice) => void;
	}

	let { clientId, clientName, currency = 'USD', onCopyItems }: Props = $props();

	let invoices = $state<RecentInvoice[]>([]);
	let loading = $state(false);

	$effect(() => {
		const id = clientId;
		let cancelled = false;
		invoices = [];
		if (!id) return;
		loading = true;
		fetch(`/api/clients/${encodeURIComponent(id)}/invoices`)
			.then((r) => (r.ok ? r.json() : { invoices: [] }))
			.then((json: { invoices?: RecentInvoice[] }) => {
				if (!cancelled) invoices = json.invoices ?? [];
			})
			.catch(() => {
				if (!cancelled) invoices = [];
			})
			.finally(() => {
				if (!cancelled) loading = false;
			});
		return () => {
			cancelled = true;
		};
	});

	const latest = $derived(invoices[0] ?? null);
	const older = $derived(invoices.slice(1));

	// Issue dates are stored as UTC midnight — format in UTC so they don't shift a day.
	function formatDate(d: string) {
		return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '—';
	}

	function statusLabel(s: string) {
		return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	}
</script>

{#if clientId}
	<section aria-labelledby="recent-invoices-heading" class="rounded-xl border p-4 md:px-6" style="background: var(--color-card); border-color: var(--color-border)">
		<div class="flex items-center justify-between gap-3 mb-3">
			<h3 id="recent-invoices-heading" class="text-sm font-semibold" style="color: var(--color-foreground)">Previous invoices</h3>
			{#if invoices.length > 0}
				<a href="/invoices?client={encodeURIComponent(clientId)}" class="text-xs font-medium" style="color: var(--color-primary)">View all</a>
			{/if}
		</div>

		<div aria-live="polite">
			{#if loading}
				<p class="text-sm" style="color: var(--color-muted-foreground)">Loading…</p>
			{:else if !latest}
				<p class="text-sm" style="color: var(--color-muted-foreground)">No previous invoices for {clientName || 'this client'}.</p>
			{:else}
				<article aria-label="Last invoice {latest.number}" class="rounded-lg border p-3" style="border-color: var(--color-border); background: var(--color-background)">
					<div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
						<a href="/invoices/{latest.id}" class="font-medium" style="color: var(--color-primary)">{latest.number}</a>
						<span style="color: var(--color-muted-foreground)">{formatDate(latest.issue_date)}</span>
						<span class={STATUS_COLORS[latest.status] ?? ''}>{statusLabel(latest.status)}</span>
						<span class="ml-auto font-mono font-medium" style="color: var(--color-foreground)">{formatCurrency(latest.total, currency)}</span>
					</div>
					{#if latest.subject}
						<p class="text-xs mt-1 truncate" style="color: var(--color-muted-foreground)" title={latest.subject}>{latest.subject}</p>
					{/if}

					{#if latest.items.length > 0}
						<ul class="mt-2 space-y-1">
							{#each latest.items as item}
								{@const text = richTextToPlainText(item.description).trim()}
								<li class="flex gap-2 text-xs items-baseline" style="color: var(--color-muted-foreground)">
									<span class="flex-1 min-w-0 truncate" style="color: var(--color-foreground)" title={text}>{text.split('\n')[0] || '—'}</span>
									<span class="hidden sm:inline font-mono">{item.quantity} × {formatCurrency(item.unit_price, currency)}</span>
									<span class="font-mono w-20 text-right" style="color: var(--color-foreground)">{formatCurrency(item.quantity * item.unit_price, currency)}</span>
								</li>
							{/each}
						</ul>
						<button type="button" onclick={() => onCopyItems(latest)}
							class="mt-3 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors hover:bg-muted"
							style="border-color: var(--color-border); color: var(--color-primary)"
						>
							<CopyPlus size={13} aria-hidden="true" /> Copy line items
						</button>
					{/if}
				</article>

				{#if older.length > 0}
					<ul class="mt-2 divide-y divide-border" aria-label="Earlier invoices">
						{#each older as inv}
							<li class="flex flex-wrap items-center gap-x-2 gap-y-1 py-2 text-xs">
								<a href="/invoices/{inv.id}" class="font-medium" style="color: var(--color-primary)">{inv.number}</a>
								<span style="color: var(--color-muted-foreground)">{formatDate(inv.issue_date)}</span>
								<span class={STATUS_COLORS[inv.status] ?? ''}>{statusLabel(inv.status)}</span>
								{#if inv.subject}
									<span class="truncate max-w-xs" style="color: var(--color-muted-foreground)" title={inv.subject}>{inv.subject}</span>
								{/if}
								<span class="ml-auto font-mono" style="color: var(--color-foreground)">{formatCurrency(inv.total, currency)}</span>
							</li>
						{/each}
					</ul>
				{/if}
			{/if}
		</div>
	</section>
{/if}
