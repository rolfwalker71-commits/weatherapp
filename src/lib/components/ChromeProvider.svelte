<script lang="ts">
	import type { Snippet } from 'svelte';
	import { initChrome } from '$lib/chrome.svelte';
	import { initTheme } from '$lib/theme.svelte';
	import { initUnits } from '$lib/units.svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();

	$effect(() => {
		initUnits();
		const stopChrome = initChrome();
		const stopTheme = initTheme();
		return () => {
			stopChrome();
			stopTheme();
		};
	});
</script>

{@render children()}
