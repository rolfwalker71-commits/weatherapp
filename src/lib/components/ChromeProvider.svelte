<script lang="ts">
	import type { Snippet } from 'svelte';
	import { initChrome } from '$lib/chrome.svelte';
	import { initTheme } from '$lib/theme.svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();

	$effect(() => {
		const stopChrome = initChrome();
		const stopTheme = initTheme();
		return () => {
			stopChrome();
			stopTheme();
		};
	});
</script>

{@render children()}
