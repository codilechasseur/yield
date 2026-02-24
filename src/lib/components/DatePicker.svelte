<script lang="ts">
	import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-svelte';

	interface Props {
		value: string;   // YYYY-MM-DD
		name?: string;
		id?: string;
		class?: string;
	}

	let { value = $bindable(''), name, id, class: className = '' }: Props = $props();

	const MONTHS = [
		'January','February','March','April','May','June',
		'July','August','September','October','November','December'
	];
	const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

	function parseDate(s: string): Date | null {
		if (!s) return null;
		const d = new Date(s + 'T00:00:00');
		return isNaN(d.getTime()) ? null : d;
	}

	function todayStr(): string {
		return new Date().toISOString().split('T')[0];
	}

	function initView() {
		const d = parseDate(value) ?? new Date();
		return { year: d.getFullYear(), month: d.getMonth() };
	}

	const init = initView();
	let open = $state(false);
	let viewYear = $state(init.year);
	let viewMonth = $state(init.month);

	const calendarCells = $derived.by(() => {
		const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
		const firstDay = new Date(viewYear, viewMonth, 1).getDay();
		const cells: Array<{ day: number | null; dateStr: string | null }> = [];
		for (let i = 0; i < firstDay; i++) cells.push({ day: null, dateStr: null });
		for (let d = 1; d <= daysInMonth; d++) {
			const mm = String(viewMonth + 1).padStart(2, '0');
			const dd = String(d).padStart(2, '0');
			cells.push({ day: d, dateStr: `${viewYear}-${mm}-${dd}` });
		}
		return cells;
	});

	function prevMonth() {
		if (viewMonth === 0) { viewYear--; viewMonth = 11; }
		else viewMonth--;
	}

	function nextMonth() {
		if (viewMonth === 11) { viewYear++; viewMonth = 0; }
		else viewMonth++;
	}

	function selectDate(dateStr: string) {
		value = dateStr;
		open = false;
	}

	function toggle() {
		if (!open) {
			const d = parseDate(value) ?? new Date();
			viewYear = d.getFullYear();
			viewMonth = d.getMonth();
		}
		open = !open;
	}

	function formatDisplay(s: string): string {
		const d = parseDate(s);
		if (!d) return 'Select date';
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	let container: HTMLDivElement;

	function handleWindowClick(e: MouseEvent) {
		if (open && container && !container.contains(e.target as Node)) {
			open = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			open = false;
			e.stopPropagation();
		}
	}
</script>

<svelte:window onclick={handleWindowClick} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div bind:this={container} class="relative {className}" onkeydown={handleKeydown}>
	{#if name}
		<input type="hidden" {name} value={value} />
	{/if}

	<button
		type="button"
		{id}
		aria-haspopup="dialog"
		aria-expanded={open}
		onclick={toggle}
		class="w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-colors hover:opacity-90"
		style="background: var(--color-background); border-color: var(--color-border); color: {value ? 'var(--color-foreground)' : 'var(--color-muted-foreground)'}"
	>
		<CalendarDays size={15} aria-hidden="true" class="shrink-0" style="color: var(--color-muted-foreground)" />
		<span>{formatDisplay(value)}</span>
	</button>

	{#if open}
		<div
			role="dialog"
			aria-label="Date picker"
			aria-modal="true"
			class="absolute z-50 mt-1 left-0 rounded-xl border shadow-lg p-3 w-64"
			style="background: var(--color-card); border-color: var(--color-border)"
		>
			<!-- Month / year navigation -->
			<div class="flex items-center justify-between mb-2">
				<button
					type="button"
					onclick={prevMonth}
					aria-label="Previous month"
					class="p-1 rounded-lg transition-opacity hover:opacity-70"
					style="color: var(--color-muted-foreground)"
				>
					<ChevronLeft size={16} aria-hidden="true" />
				</button>
				<span class="text-sm font-semibold" style="color: var(--color-foreground)">
					{MONTHS[viewMonth]} {viewYear}
				</span>
				<button
					type="button"
					onclick={nextMonth}
					aria-label="Next month"
					class="p-1 rounded-lg transition-opacity hover:opacity-70"
					style="color: var(--color-muted-foreground)"
				>
					<ChevronRight size={16} aria-hidden="true" />
				</button>
			</div>

			<!-- Weekday headers -->
			<div class="grid grid-cols-7 mb-1">
				{#each WEEKDAYS as wd}
					<span
						class="text-center text-xs font-medium py-1"
						style="color: var(--color-muted-foreground)"
					>{wd}</span>
				{/each}
			</div>

			<!-- Day cells -->
			<div class="grid grid-cols-7 gap-y-0.5">
				{#each calendarCells as cell}
					{#if cell.day === null}
						<span aria-hidden="true"></span>
					{:else}
						<button
							type="button"
							onclick={() => selectDate(cell.dateStr!)}
							aria-label="{MONTHS[viewMonth]} {cell.day}, {viewYear}"
							aria-pressed={cell.dateStr === value}
							class="rounded-lg text-sm py-1 w-full text-center transition-colors hover:opacity-80"
							style={
								cell.dateStr === value
									? 'background: var(--color-primary); color: var(--color-primary-foreground); font-weight: 600'
									: cell.dateStr === todayStr()
									? 'background: var(--color-accent); color: var(--color-accent-foreground)'
									: 'color: var(--color-foreground)'
							}
						>{cell.day}</button>
					{/if}
				{/each}
			</div>

			<!-- Today shortcut -->
			<div class="mt-2 pt-2 border-t text-center" style="border-color: var(--color-border)">
				<button
					type="button"
					onclick={() => selectDate(todayStr())}
					class="text-xs font-medium hover:opacity-70 transition-opacity"
					style="color: var(--color-primary)"
				>Today</button>
			</div>
		</div>
	{/if}
</div>
