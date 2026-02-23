<script lang="ts">
	import { BarChart2, TrendingUp, Wallet, Receipt, Calculator, Users, CalendarDays, PieChart } from 'lucide-svelte';
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();

	function fmt(amount: number): string {
		return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);
	}

	// Quarter boundaries (1-indexed months): Q1=1-3, Q2=4-6, Q3=7-9, Q4=10-12
	function quarterOf(month: number) {
		return Math.ceil(month / 3);
	}

	const quarters = [1, 2, 3, 4].map((q) => {
		const qMonths = data.months.filter((m) => quarterOf(m.month) === q);
		return {
			label: `Q${q}`,
			months: `${qMonths[0]?.label.slice(0, 3)}–${qMonths[2]?.label.slice(0, 3)}`,
			invoiceCount: qMonths.reduce((s, m) => s + m.invoiceCount, 0),
			subtotal: qMonths.reduce((s, m) => s + m.subtotal, 0),
			gstCollected: qMonths.reduce((s, m) => s + m.gstCollected, 0),
			total: qMonths.reduce((s, m) => s + m.total, 0),
			estimatedIncomeTax: qMonths.reduce((s, m) => s + m.estimatedIncomeTax, 0)
		};
	});

	const currentMonth = new Date().getMonth() + 1; // 1-indexed, only used for "current" highlight
	const isCurrentYear = $derived(data.year === new Date().getFullYear());
</script>

<svelte:head>
	<title>Reports — Yield</title>
</svelte:head>

<div class="max-w-5xl mx-auto">
	<!-- Header -->
	<div class="mb-6">
		<h2 class="text-2xl font-bold" style="color: var(--color-foreground)">Reports</h2>
		<p class="mt-1 text-sm" style="color: var(--color-muted-foreground)">
			Revenue breakdown, client summary, and tax figures for the selected year
		</p>
	</div>

	<!-- Controls -->
	<form method="GET" class="flex flex-wrap items-center gap-3 mb-6">
		<!-- Year -->
		<div class="flex items-center gap-2">
			<label class="text-sm font-medium" style="color: var(--color-foreground)" for="year-select">Year</label>
			<select
				id="year-select"
				name="year"
				onchange={() => (document.querySelector('form') as HTMLFormElement)?.requestSubmit()}
				class="rounded-lg border px-3 py-1.5 text-sm"
				style="background-color: var(--color-card); border-color: var(--color-border); color: var(--color-foreground)"
			>
				{#each data.availableYears as y}
					<option value={y} selected={y === data.year}>{y}</option>
				{/each}
			</select>
		</div>

		<!-- Basis -->
		<div class="flex items-center gap-2">
			<label class="text-sm font-medium" style="color: var(--color-foreground)" for="basis-select">Basis</label>
			<select
				id="basis-select"
				name="basis"
				onchange={() => (document.querySelector('form') as HTMLFormElement)?.requestSubmit()}
				class="rounded-lg border px-3 py-1.5 text-sm"
				style="background-color: var(--color-card); border-color: var(--color-border); color: var(--color-foreground)"
			>
				<option value="cash" selected={data.basis === 'cash'}>Cash (paid invoices)</option>
				<option value="accrual" selected={data.basis === 'accrual'}>Accrual (all non-draft)</option>
			</select>
		</div>

		<span class="text-xs ml-auto" style="color: var(--color-muted-foreground)">
			{data.basisLabel}
		</span>
	</form>

	<!-- Annual Summary Cards -->
	<div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
		{#each [
			{ label: 'Revenue (pre-tax)', value: fmt(data.totals.subtotal), icon: TrendingUp },
			{ label: 'GST/HST Collected', value: fmt(data.totals.gstCollected), icon: Receipt },
			{ label: 'Total Invoiced', value: fmt(data.totals.total), icon: Wallet },
			{ label: 'Est. Income Tax', value: data.incomeTaxRate > 0 ? fmt(data.totals.estimatedIncomeTax) : 'Set rate →', icon: Calculator }
		] as card}
			{@const Icon = card.icon}
			<div
				class="rounded-xl p-5 border"
				style="background-color: var(--color-card); border-color: var(--color-border)"
			>
				<div class="flex items-center justify-between mb-2">
					<p class="text-[11px] font-semibold tracking-wide uppercase" style="color: var(--color-muted-foreground)">{card.label}</p>
					<div class="p-2.5 rounded-lg" style="background-color: var(--color-accent)">
						<Icon size={18} style="color: var(--color-primary)" />
					</div>
				</div>
				<p class="text-2xl font-semibold" style="color: var(--color-foreground)">{card.value}</p>
			</div>
		{/each}
	</div>

	<!-- By Client -->
	<div
		class="rounded-xl border overflow-hidden mb-6"
		style="background-color: var(--color-card); border-color: var(--color-border)"
	>
		<div class="px-6 py-4 border-b flex items-center gap-2" style="border-color: var(--color-border)">
			<Users size={16} style="color: var(--color-primary)" aria-hidden="true" />
			<h3 class="font-semibold" style="color: var(--color-foreground)">Revenue by Client — {data.year}</h3>
		</div>
		{#if data.clientSummaries.length === 0}
			<p class="px-6 py-8 text-sm text-center" style="color: var(--color-muted-foreground)">No data for this period.</p>
		{:else}
			<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b" style="border-color: var(--color-border)">
						<th scope="col" class="px-6 py-3 text-left font-medium" style="color: var(--color-muted-foreground)">Client</th>
						<th scope="col" class="px-4 py-3 text-right font-medium" style="color: var(--color-muted-foreground)"># Invoices</th>
						<th scope="col" class="px-4 py-3 text-right font-medium" style="color: var(--color-muted-foreground)">Revenue (pre-tax)</th>
						<th scope="col" class="px-6 py-3 text-right font-medium" style="color: var(--color-muted-foreground)">Total Invoiced</th>
						<th scope="col" class="px-4 py-3 text-right font-medium" style="color: var(--color-muted-foreground)">Share</th>
					</tr>
				</thead>
				<tbody>
					{#each data.clientSummaries as cs}
						{@const share = data.totals.subtotal > 0 ? (cs.subtotal / data.totals.subtotal) * 100 : 0}
						<tr class="border-b" style="border-color: var(--color-border)">
							<td class="px-6 py-3 font-medium" style="color: var(--color-foreground)">{cs.clientName}</td>
							<td class="px-4 py-3 text-right tabular-nums" style="color: var(--color-foreground)">{cs.invoiceCount}</td>
							<td class="px-4 py-3 text-right tabular-nums" style="color: var(--color-foreground)">{fmt(cs.subtotal)}</td>
							<td class="px-6 py-3 text-right tabular-nums font-medium" style="color: var(--color-foreground)">{fmt(cs.total)}</td>
							<td class="px-4 py-3 text-right">
								<div class="flex items-center justify-end gap-2">
									<div class="w-16 rounded-full h-1.5 overflow-hidden" style="background-color: var(--color-border)">
										<div class="h-full rounded-full" style="width: {share.toFixed(1)}%; background-color: var(--color-primary)"></div>
									</div>
									<span class="text-xs tabular-nums w-10 text-right" style="color: var(--color-muted-foreground)">{share.toFixed(1)}%</span>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			</div>
		{/if}
	</div>

	<!-- Monthly Table -->
	<div
		class="rounded-xl border overflow-hidden mb-6"
		style="background-color: var(--color-card); border-color: var(--color-border)"
	>
		<div class="px-6 py-4 border-b flex items-center gap-2" style="border-color: var(--color-border)">
			<CalendarDays size={16} style="color: var(--color-primary)" aria-hidden="true" />
			<div>
				<h3 class="font-semibold" style="color: var(--color-foreground)">Monthly Breakdown — {data.year}</h3>
				<p class="text-xs mt-0.5" style="color: var(--color-muted-foreground)">Including tax columns for remittance planning</p>
			</div>
		</div>

		<div class="overflow-x-auto">
		<table class="w-full text-sm min-w-150">
			<thead>
				<tr class="border-b" style="border-color: var(--color-border)">
					<th scope="col" class="px-6 py-3 text-left font-medium" style="color: var(--color-muted-foreground)">Month</th>
					<th scope="col" class="px-4 py-3 text-right font-medium" style="color: var(--color-muted-foreground)"># Invoices</th>
					<th scope="col" class="px-4 py-3 text-right font-medium" style="color: var(--color-muted-foreground)">Revenue (pre-tax)</th>
					<th scope="col" class="px-4 py-3 text-right font-medium" style="color: var(--color-muted-foreground)">GST/HST Collected</th>				<th scope="col" class="px-4 py-3 text-right font-medium" style="color: var(--color-muted-foreground)">Est. Income Tax</th>					<th scope="col" class="px-6 py-3 text-right font-medium" style="color: var(--color-muted-foreground)">Total Invoiced</th>
				</tr>
			</thead>
			<tbody>
				{#each data.months as m}
					{@const isPast = !isCurrentYear || m.month < currentMonth}
					{@const isCurrent = isCurrentYear && m.month === currentMonth}
					<tr
						class="border-b transition-colors"
						style="border-color: var(--color-border); {isCurrent ? 'background-color: var(--color-accent)' : ''}"
					>
						<td class="px-6 py-3 font-medium" style="color: var(--color-foreground)">
							{m.label}
							{#if isCurrent}
								<span class="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">current</span>
							{/if}
						</td>
						<td class="px-4 py-3 text-right tabular-nums" style="color: {m.invoiceCount === 0 ? 'var(--color-muted-foreground)' : 'var(--color-foreground)'}">
							{m.invoiceCount === 0 ? '—' : m.invoiceCount}
						</td>
						<td class="px-4 py-3 text-right tabular-nums" style="color: {m.subtotal === 0 ? 'var(--color-muted-foreground)' : 'var(--color-foreground)'}">
							{m.subtotal === 0 ? '—' : fmt(m.subtotal)}
						</td>
						<td class="px-4 py-3 text-right tabular-nums" style="color: {m.gstCollected === 0 ? 'var(--color-muted-foreground)' : 'var(--color-foreground)'}">
							{m.gstCollected === 0 ? '—' : fmt(m.gstCollected)}
						</td>
						<td class="px-4 py-3 text-right tabular-nums" style="color: {m.estimatedIncomeTax === 0 ? 'var(--color-muted-foreground)' : 'var(--color-foreground)'}">
							{data.incomeTaxRate <= 0 ? '—' : m.estimatedIncomeTax === 0 ? '—' : fmt(m.estimatedIncomeTax)}
						</td>
						<td class="px-6 py-3 text-right tabular-nums font-medium" style="color: {m.total === 0 ? 'var(--color-muted-foreground)' : 'var(--color-foreground)'}">
							{m.total === 0 ? '—' : fmt(m.total)}
						</td>
					</tr>
				{/each}
			</tbody>
			<tfoot>
				<tr style="background-color: var(--color-accent)">
					<td class="px-6 py-3 font-semibold" style="color: var(--color-foreground)">Total {data.year}</td>
					<td class="px-4 py-3 text-right tabular-nums font-semibold" style="color: var(--color-foreground)">{data.totals.invoiceCount}</td>
					<td class="px-4 py-3 text-right tabular-nums font-semibold" style="color: var(--color-foreground)">{fmt(data.totals.subtotal)}</td>
					<td class="px-4 py-3 text-right tabular-nums font-semibold" style="color: var(--color-foreground)">{fmt(data.totals.gstCollected)}</td>
					<td class="px-4 py-3 text-right tabular-nums font-semibold" style="color: var(--color-foreground)">{data.incomeTaxRate > 0 ? fmt(data.totals.estimatedIncomeTax) : '—'}</td>
					<td class="px-6 py-3 text-right tabular-nums font-semibold" style="color: var(--color-foreground)">{fmt(data.totals.total)}</td>
				</tr>
			</tfoot>
		</table>			</div>	</div>

	<!-- Quarterly Summary -->
	<div
		class="rounded-xl border overflow-hidden"
		style="background-color: var(--color-card); border-color: var(--color-border)"
	>
		<div class="px-6 py-4 border-b flex items-center gap-2" style="border-color: var(--color-border)">
			<PieChart size={16} style="color: var(--color-primary)" aria-hidden="true" />
			<div>
				<h3 class="font-semibold" style="color: var(--color-foreground)">Quarterly Summary</h3>
				<p class="text-xs mt-0.5" style="color: var(--color-muted-foreground)">
					Useful for quarterly GST/HST remittance filing
				</p>
			</div>
		</div>

		<div class="overflow-x-auto">
		<table class="w-full text-sm min-w-160">
			<thead>
				<tr class="border-b" style="border-color: var(--color-border)">
					<th scope="col" class="px-6 py-3 text-left font-medium" style="color: var(--color-muted-foreground)">Quarter</th>
					<th scope="col" class="px-4 py-3 text-left font-medium" style="color: var(--color-muted-foreground)">Months</th>
					<th scope="col" class="px-4 py-3 text-right font-medium" style="color: var(--color-muted-foreground)"># Invoices</th>
					<th scope="col" class="px-4 py-3 text-right font-medium" style="color: var(--color-muted-foreground)">Revenue (pre-tax)</th>
					<th scope="col" class="px-4 py-3 text-right font-medium" style="color: var(--color-muted-foreground)">GST/HST Collected</th>
					<th scope="col" class="px-4 py-3 text-right font-medium" style="color: var(--color-muted-foreground)">Est. Income Tax</th>
					<th scope="col" class="px-6 py-3 text-right font-medium" style="color: var(--color-muted-foreground)">Total Invoiced</th>
				</tr>
			</thead>
			<tbody>
				{#each quarters as q}
					<tr class="border-b" style="border-color: var(--color-border)">
						<td class="px-6 py-3 font-semibold" style="color: var(--color-foreground)">{q.label}</td>
						<td class="px-4 py-3" style="color: var(--color-muted-foreground)">{q.months}</td>
						<td class="px-4 py-3 text-right tabular-nums" style="color: var(--color-foreground)">{q.invoiceCount}</td>
						<td class="px-4 py-3 text-right tabular-nums" style="color: var(--color-foreground)">{fmt(q.subtotal)}</td>
						<td class="px-4 py-3 text-right tabular-nums font-medium" style="color: var(--color-foreground)">{fmt(q.gstCollected)}</td>
						<td class="px-4 py-3 text-right tabular-nums" style="color: var(--color-foreground)">{data.incomeTaxRate > 0 ? fmt(q.estimatedIncomeTax) : '—'}</td>
						<td class="px-6 py-3 text-right tabular-nums font-semibold" style="color: var(--color-foreground)">{fmt(q.total)}</td>
					</tr>
				{/each}
			</tbody>
		</table>			</div>	</div>

	<!-- Notes -->
	<div class="mt-6 rounded-xl border p-5 text-sm space-y-1.5" style="background-color: var(--color-card); border-color: var(--color-border); color: var(--color-muted-foreground)">
		<p class="font-medium" style="color: var(--color-foreground)">How to use these reports</p>
		<ul class="list-disc list-inside space-y-1">
			<li><strong>Revenue by Client</strong> — shows how income is distributed across clients for the selected year.</li>
			<li><strong>Revenue (pre-tax)</strong> — report as business income for income tax purposes.</li>
			<li><strong>GST/HST Collected</strong> — amount to remit to CRA each period (derived from your invoices' tax % field).</li>
			<li><strong>Est. Income Tax</strong> — estimated personal income tax based on your configured effective rate ({data.incomeTaxRate > 0 ? `${data.incomeTaxRate}%` : 'not set — configure in Settings'}). This is a rough estimate; deductions and credits are not accounted for.</li>
			<li>Use <strong>Cash basis</strong> if you remit GST only on <em>paid</em> invoices (default for most small businesses).</li>
			<li>Use <strong>Accrual basis</strong> if you remit GST on <em>invoiced</em> amounts regardless of payment.</li>
			<li>Input tax credits (ITCs) from your business expenses are not tracked here — deduct them separately.</li>
		</ul>
	</div>
</div>
