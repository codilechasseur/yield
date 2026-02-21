<script lang="ts">
	import { DollarSign, AlertCircle, CheckCircle, TrendingUp, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-svelte';
	import { STATUS_COLORS, formatCurrency } from '$lib/pocketbase.js';
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();

	let stats = $derived(data.stats);

	function formatDate(date: string): string {
		return new Date(date).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function daysOverdue(dueDate: string): number {
		const due = new Date(dueDate);
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		due.setHours(0, 0, 0, 0);
		return Math.floor((today.getTime() - due.getTime()) / 86_400_000);
	}

	/** Compact dollar labels for chart y-axis: $50k, $1.2M */
	function fmtK(n: number): string {
		if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
		if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
		return `$${Math.round(n)}`;
	}

	/** Stat card values: full below $10k, abbreviated above */
	function fmtCard(n: number): string {
		if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
		if (n >= 100_000)   return `$${(n / 1_000).toFixed(1)}k`;
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
	}

	const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

	function periodLabel(period: string, mode: 'year' | 'month'): string {
		if (mode === 'year') return period;
		return MONTH_ABBR[parseInt(period.slice(5)) - 1] ?? period;
	}

	const currentYear = new Date().getFullYear();
	const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });

	const statCards = $derived([
		{ label: 'Outstanding',            value: fmtCard(stats.outstanding),    icon: DollarSign,  accent: false },
		{ label: 'Overdue',                value: fmtCard(stats.overdueTotal),   icon: AlertCircle, accent: stats.overdueTotal > 0 },
		{ label: `Paid — ${currentMonth}`, value: fmtCard(stats.paidThisMonth), icon: CheckCircle, accent: false },
		{ label: `Paid — ${currentYear}`,  value: fmtCard(stats.paidYTD),       icon: TrendingUp,  accent: false }
	]);

	// SVG chart layout constants
	const W = 560, H = 220, PL = 56, PR = 8, PT = 10, PB = 36;
	const cW = W - PL - PR;
	const cH = H - PT - PB;

	// Chart state
	let viewMode: 'year' | 'month' = $state('year');
	let monthViewYear: number = $state(currentYear);
	let hoverIdx: number | null = $state(null);

	// Monthly data lookup
	const monthLookup = $derived(new Map(stats.chartDataByMonth.map((d) => [d.period, d])));
	const allYears = $derived([...new Set(stats.chartData.map((d) => Number(d.period)))].sort((a, b) => a - b));
	const minYear = $derived(allYears[0] ?? currentYear);
	const maxYear = $derived(allYears[allYears.length - 1] ?? currentYear);

	const visibleData = $derived(
		viewMode === 'year'
			? stats.chartData
			: Array.from({ length: 12 }, (_, m) => {
					const key = `${monthViewYear}-${String(m + 1).padStart(2, '0')}`;
					return monthLookup.get(key) ?? { period: key, invoiced: 0, paid: 0 };
				})
	);
</script>

<svelte:head>
	<title>Dashboard — Yield</title>
</svelte:head>

<div class="max-w-5xl mx-auto">
	<!-- Header -->
	<div class="mb-8">
		<h2 class="text-2xl font-bold" style="color: var(--color-foreground)">Dashboard</h2>
		<p class="mt-1 text-sm" style="color: var(--color-muted-foreground)">
			Overview of your invoicing activity
		</p>
	</div>

	<!-- Setup banner — shown on fresh installs with no data -->
	{#if !data.hasData}
		<div
			class="mb-6 flex items-start gap-4 rounded-xl border px-5 py-4"
			style="background-color: var(--color-accent); border-color: var(--color-primary)"
		>
			<div class="mt-0.5 shrink-0 p-2 rounded-lg" style="background-color: color-mix(in srgb, var(--color-primary) 20%, transparent)">
				<TrendingUp size={16} style="color: var(--color-primary)" />
			</div>
			<div class="flex-1 min-w-0">
				<p class="text-sm font-semibold" style="color: var(--color-foreground)">Welcome to Yield</p>
				<p class="text-sm mt-0.5" style="color: var(--color-muted-foreground)">
					No data yet. Head to <a href="/settings#import" class="font-medium underline underline-offset-2" style="color: var(--color-primary)">Settings → Data Import</a>
					to import from Harvest, or create your first <a href="/clients" class="font-medium underline underline-offset-2" style="color: var(--color-primary)">client</a>
					and <a href="/invoices/new" class="font-medium underline underline-offset-2" style="color: var(--color-primary)">invoice</a> manually.
				</p>
			</div>
		</div>
	{/if}

	<!-- Stat Cards -->
	<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
		{#each statCards as card}
			{@const Icon = card.icon}
			<div
				class="rounded-xl p-3 sm:p-5 border"
				style="background-color: var(--color-card); border-color: {card.accent ? 'var(--color-destructive)' : 'var(--color-border)'}"
			>
				<div class="flex items-start justify-between gap-2">
					<div class="min-w-0">
						<p class="text-[10px] sm:text-[11px] font-semibold tracking-wide uppercase mb-1.5 sm:mb-2 leading-tight" style="color: var(--color-muted-foreground)">
							{card.label}
						</p>
						<p class="text-lg sm:text-2xl font-semibold truncate" style="color: {card.accent ? 'var(--color-destructive)' : 'var(--color-foreground)'}">
							{card.value}
						</p>
					</div>
					<div class="hidden sm:block shrink-0 p-2.5 rounded-lg" style="background-color: {card.accent ? 'color-mix(in srgb, var(--color-destructive) 15%, transparent)' : 'var(--color-accent)'}">
						<Icon size={18} style="color: {card.accent ? 'var(--color-destructive)' : 'var(--color-primary)'}" />
					</div>
				</div>
			</div>
		{/each}
	</div>

	<!-- Revenue Chart -->
	{#if stats.chartData.length > 0}
		{@const maxVal = Math.max(...visibleData.map((d) => d.invoiced), 1)}
		{@const n = visibleData.length}
		{@const slotW = cW / n}
		{@const bw = slotW * 0.65}
		{@const bGap = (slotW - bw) / 2}
		<!-- tooltip constants -->
		{@const ttW = 188}
		{@const ttH = 76}
		<div
			class="rounded-xl border overflow-hidden mb-6"
			style="background-color: var(--color-card); border-color: var(--color-border)"
		>
			<!-- Chart header: title left, controls right -->
			<div class="px-6 py-4 border-b flex items-center justify-between gap-4 flex-wrap" style="border-color: var(--color-border)">
				<h3 class="font-semibold" style="color: var(--color-foreground)">Revenue</h3>

				<div class="flex items-center gap-3 flex-wrap justify-end">
					<!-- Legend -->
					<div class="hidden sm:flex items-center gap-3 text-xs mr-2" style="color: var(--color-muted-foreground)">
						<span class="flex items-center gap-1.5">
							<span class="inline-block w-3 h-3 rounded-sm" style="background-color: var(--color-primary)"></span>
							Paid
						</span>
						<span class="flex items-center gap-1.5">
							<span class="inline-block w-3 h-3 rounded-sm opacity-25" style="background-color: var(--color-primary)"></span>
							Outstanding
						</span>
					</div>

					<!-- Month view year navigator (only visible in month mode) -->
					{#if viewMode === 'month'}
						<div class="flex items-center gap-1">
							<button
								onclick={() => { if (monthViewYear > minYear) monthViewYear--; }}
								disabled={monthViewYear <= minYear}
								class="p-1 rounded transition-opacity"
								style="color: var(--color-muted-foreground)"
								class:opacity-30={monthViewYear <= minYear}
							>
								<ChevronLeft size={15} />
							</button>
							<span class="text-sm font-medium w-11 text-center tabular-nums" style="color: var(--color-foreground)">{monthViewYear}</span>
							<button
								onclick={() => { if (monthViewYear < maxYear) monthViewYear++; }}
								disabled={monthViewYear >= maxYear}
								class="p-1 rounded transition-opacity"
								style="color: var(--color-muted-foreground)"
								class:opacity-30={monthViewYear >= maxYear}
							>
								<ChevronRight size={15} />
							</button>
						</div>
					{/if}

					<!-- Toggle -->
					<div class="flex rounded-lg overflow-hidden border text-xs font-medium" style="border-color: var(--color-border)">
						<button
							onclick={() => { viewMode = 'year'; hoverIdx = null; }}
							class="px-3 py-1.5 transition-colors"
							style="background-color: {viewMode === 'year' ? 'var(--color-primary)' : 'transparent'}; color: {viewMode === 'year' ? 'white' : 'var(--color-muted-foreground)'}"
						>Year</button>
						<button
							onclick={() => { viewMode = 'month'; hoverIdx = null; }}
							class="px-3 py-1.5 transition-colors"
							style="background-color: {viewMode === 'month' ? 'var(--color-primary)' : 'transparent'}; color: {viewMode === 'month' ? 'white' : 'var(--color-muted-foreground)'}"
						>Month</button>
					</div>
				</div>
			</div>

			<div class="px-4 py-5">
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<svg
					viewBox="0 0 {W} {H}"
					class="w-full block"
					style="aspect-ratio: {W} / {H}; max-height: 260px;"
					onmouseleave={() => { hoverIdx = null; }}
				>
					<!-- Horizontal grid lines + Y-axis labels -->
					{#each [0, 0.25, 0.5, 0.75, 1] as tick}
						{@const ty = PT + cH * (1 - tick)}
						<line
							x1={PL} y1={ty} x2={W - PR} y2={ty}
							stroke="var(--color-border)" stroke-width="1"
						/>
						<text
							x={PL - 6} y={ty + 4}
							text-anchor="end" font-size="9"
							fill="var(--color-muted-foreground)"
						>{fmtK(maxVal * tick)}</text>
					{/each}

					<!-- Bars -->
					{#key viewMode + monthViewYear}
					{#each visibleData as d, i}
						{@const bx = PL + i * slotW + bGap}
						{@const barH = (d.invoiced / maxVal) * cH}
						{@const paidH = (d.paid / maxVal) * cH}
						{@const unpaidH = barH - paidH}
						{@const isHovered = hoverIdx === i}

						<!-- Hit area — invisible wide rect for easy hover -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<rect
							x={PL + i * slotW} y={PT}
							width={slotW} height={cH}
							fill="transparent"
							onmouseenter={() => { hoverIdx = i; }}
						/>

						<!-- Full bar background = total invoiced (desaturated) -->
						{#if barH > 0.5}
							<rect
								x={bx} y={PT + cH - barH}
								width={bw} height={barH}
								fill="var(--color-primary)"
								opacity={isHovered ? 0.35 : 0.22}
								rx="3" ry="3"
								class="bar-anim" style="animation-delay: {i * 35}ms"
							/>
						{/if}

						<!-- Paid portion (saturated, grows from bottom) -->
						{#if paidH > 0.5}
							<rect
								x={bx} y={PT + cH - paidH}
								width={bw} height={paidH}
								fill="var(--color-primary)"
								opacity={isHovered ? 0.9 : 1}
								rx="3" ry="3"
								class="bar-anim" style="animation-delay: {i * 35}ms"
							/>
							<!-- Square off top corners when unpaid portion sits above -->
							{#if unpaidH > 0.5}
								<rect
									x={bx} y={PT + cH - paidH}
									width={bw} height={Math.min(4, paidH)}
									fill="var(--color-primary)"
									opacity={isHovered ? 0.9 : 1}
								/>
							{/if}
						{/if}

						<!-- X-axis label -->
						<text
							x={bx + bw / 2} y={H - 6}
							text-anchor="middle" font-size="10"
							fill={isHovered ? 'var(--color-foreground)' : 'var(--color-muted-foreground)'}
							font-weight={isHovered ? 'bold' : 'normal'}
						>{periodLabel(d.period, viewMode)}</text>
					{/each}
					{/key}

					<!-- Tooltip -->
					{#if hoverIdx !== null}
						{@const td = visibleData[hoverIdx]}
						{@const outstanding = td.invoiced - td.paid}
						{@const barH = (td.invoiced / maxVal) * cH}
						{@const bx = PL + hoverIdx * slotW + bGap}
						{@const rawTx = bx + bw / 2 - ttW / 2}
						{@const tx = Math.min(Math.max(rawTx, PL), W - PR - ttW)}
						{@const ty = Math.max(PT + cH - barH - ttH - 8, PT + 2)}
						<g>
							<rect
								x={tx} y={ty}
								width={ttW} height={ttH}
								rx="5" ry="5"
								fill="var(--color-popover, var(--color-card))"
								stroke="var(--color-border)"
								stroke-width="1"
								filter="drop-shadow(0 2px 6px rgba(0,0,0,.15))"
							/>
							<text x={tx + 10} y={ty + 16} font-size="12" font-weight="bold" fill="var(--color-foreground)">
								{viewMode === 'month'
									? `${MONTH_ABBR[parseInt(td.period.slice(5)) - 1]} ${td.period.slice(0, 4)}`
									: td.period}
							</text>
							<text x={tx + 10} y={ty + 33} font-size="11" fill="var(--color-muted-foreground)">Invoiced</text>
							<text x={tx + ttW - 10} y={ty + 33} font-size="11" text-anchor="end" fill="var(--color-foreground)">{formatCurrency(td.invoiced)}</text>
							<text x={tx + 10} y={ty + 50} font-size="11" fill="var(--color-muted-foreground)">Paid</text>
							<text x={tx + ttW - 10} y={ty + 50} font-size="11" text-anchor="end" fill="var(--color-primary)">{formatCurrency(td.paid)}</text>
							<text x={tx + 10} y={ty + 67} font-size="11" fill="var(--color-muted-foreground)">Outstanding</text>
							<text x={tx + ttW - 10} y={ty + 67} font-size="11" text-anchor="end"
								fill={outstanding > 0 ? 'var(--color-destructive, #e53e3e)' : 'var(--color-muted-foreground)'}
							>{formatCurrency(outstanding)}</text>
						</g>
					{/if}
				</svg>
			</div>
		</div>
	{/if}

	<!-- Overdue Invoices -->
	{#if stats.overdueInvoices.length > 0}
	<div
		class="rounded-xl border overflow-hidden mb-6"
		style="background-color: var(--color-card); border-color: var(--color-destructive)"
	>
		<div class="px-6 py-4 border-b flex items-center justify-between" style="border-color: var(--color-border)">
			<div class="flex items-center gap-2">
				<AlertCircle size={16} style="color: var(--color-destructive)" />
				<h3 class="font-semibold" style="color: var(--color-destructive)">Overdue Invoices</h3>
			</div>
			<a href="/invoices?status=overdue" class="flex items-center gap-1 text-xs font-medium" style="color: var(--color-primary)">
				View all <ArrowRight size={14} />
			</a>
		</div>
		<div class="overflow-x-auto">
		<table class="w-full min-w-150">
			<thead>
				<tr style="border-bottom: 1px solid var(--color-border)">
					<th class="px-6 py-3 text-left text-xs font-medium" style="color: var(--color-muted-foreground)">Invoice</th>
					<th class="px-6 py-3 text-left text-xs font-medium" style="color: var(--color-muted-foreground)">Client</th>
					<th class="px-6 py-3 text-left text-xs font-medium" style="color: var(--color-muted-foreground)">Due Date</th>
					<th class="px-6 py-3 text-left text-xs font-medium" style="color: var(--color-muted-foreground)">Days Overdue</th>
					<th class="px-6 py-3 text-right text-xs font-medium" style="color: var(--color-muted-foreground)">Total</th>
				</tr>
			</thead>
			<tbody>
				{#each stats.overdueInvoices as inv}
					<tr class="hover:bg-muted/30 transition-colors" style="border-bottom: 1px solid var(--color-border)">
						<td class="px-6 py-4">
							<a href="/invoices/{inv.id}" class="font-medium text-sm" style="color: var(--color-primary)">
								{inv.number}
							</a>
						</td>
						<td class="px-6 py-4 text-sm" style="color: var(--color-foreground)">
							{inv.expand?.client?.name ?? '—'}
						</td>
					<td class="px-6 py-4 text-sm" style="color: var(--color-muted-foreground)">
						{inv.due_date ? formatDate(inv.due_date) : '—'}
					</td>
					<td class="px-6 py-4 text-sm font-medium" style="color: var(--color-destructive)">
						{inv.due_date ? `${daysOverdue(inv.due_date)}d` : '—'}
					</td>
					<td class="px-6 py-4 text-right text-sm font-medium" style="color: var(--color-foreground)">
							{formatCurrency(inv.total, inv.expand?.client?.currency)}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
		</div>
	</div>
	{/if}

	<!-- Recent Invoices -->
	<div
		class="rounded-xl border overflow-hidden"
		style="background-color: var(--color-card); border-color: var(--color-border)"
	>
		<div class="px-6 py-4 border-b flex items-center justify-between" style="border-color: var(--color-border)">
			<h3 class="font-semibold" style="color: var(--color-foreground)">Recent Invoices</h3>
			<a href="/invoices" class="flex items-center gap-1 text-xs font-medium" style="color: var(--color-primary)">
				View all <ArrowRight size={14} />
			</a>
		</div>

		{#if stats.recentInvoices.length === 0}
			<div class="px-6 py-12 text-center">
				<p style="color: var(--color-muted-foreground)">No invoices yet.</p>
				<a
					href="/invoices/new"
					class="mt-3 inline-block text-sm font-medium"
					style="color: var(--color-primary)"
				>
					Create your first invoice →
				</a>
			</div>
		{:else}
		<div class="overflow-x-auto">
		<table class="w-full min-w-150">
			<thead>
				<tr style="border-bottom: 1px solid var(--color-border)">
					<th class="px-6 py-3 text-left text-xs font-medium" style="color: var(--color-muted-foreground)">Invoice</th>
					<th class="px-6 py-3 text-left text-xs font-medium" style="color: var(--color-muted-foreground)">Client</th>
					<th class="px-6 py-3 text-left text-xs font-medium" style="color: var(--color-muted-foreground)">Due Date</th>
					<th class="px-6 py-3 text-left text-xs font-medium" style="color: var(--color-muted-foreground)">Status</th>
					<th class="px-6 py-3 text-right text-xs font-medium" style="color: var(--color-muted-foreground)">Total</th>
					</tr>
				</thead>
				<tbody>
					{#each stats.recentInvoices as inv}
						<tr class="hover:bg-muted/30 transition-colors" style="border-bottom: 1px solid var(--color-border)">
							<td class="px-6 py-4">
								<a
									href="/invoices/{inv.id}"
									class="font-medium text-sm"
									style="color: var(--color-primary)"
								>
									{inv.number}
								</a>
							</td>
							<td class="px-6 py-4 text-sm" style="color: var(--color-foreground)">
								{inv.expand?.client?.name ?? '—'}
							</td>
							<td class="px-6 py-4 text-sm hidden sm:table-cell" style="color: var(--color-muted-foreground)">
								{inv.due_date ? formatDate(inv.due_date) : '—'}
							</td>
							<td class="px-6 py-4">
								<span class="{STATUS_COLORS[inv.status] ?? ''}">
									{inv.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
								</span>
							</td>
							<td class="px-6 py-4 text-right text-sm font-medium" style="color: var(--color-foreground)">
								{formatCurrency(inv.total, inv.expand?.client?.currency)}
							</td>
						</tr>
				{/each}
			</tbody>
		</table>
		</div>
		{/if}
		</div>
</div>

<style>
	.bar-anim {
		transform-box: fill-box;
		transform-origin: bottom;
		animation: bar-grow 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	@keyframes bar-grow {
		from { transform: scaleY(0); }
		to   { transform: scaleY(1); }
	}
</style>
