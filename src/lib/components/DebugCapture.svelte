<script lang="ts">
	/**
	 * Invisible component that installs global error listeners when debug is
	 * enabled. Add once to the root layout; it renders no markup.
	 */
	import { addDebugEntry, debugState } from '$lib/debug.svelte.js';

	$effect(() => {
		if (!debugState.enabled) return;

		function onError(event: ErrorEvent) {
			const detail = event.filename
				? `${event.filename}:${event.lineno}:${event.colno}`
				: undefined;
			addDebugEntry('js-error', event.message || 'Unknown error', detail);
		}

		function onUnhandledRejection(event: PromiseRejectionEvent) {
			const msg =
				event.reason instanceof Error
					? event.reason.message
					: String(event.reason ?? 'Unhandled rejection');
			const detail =
				event.reason instanceof Error ? event.reason.stack : undefined;
			addDebugEntry('unhandled-rejection', msg, detail);
		}

		window.addEventListener('error', onError);
		window.addEventListener('unhandledrejection', onUnhandledRejection);

		return () => {
			window.removeEventListener('error', onError);
			window.removeEventListener('unhandledrejection', onUnhandledRejection);
		};
	});
</script>
