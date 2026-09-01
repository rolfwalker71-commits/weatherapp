<script lang="ts">
	import Monitor from '@lucide/svelte/icons/monitor';
	import Moon from '@lucide/svelte/icons/moon';
	import Sun from '@lucide/svelte/icons/sun';
	import { cycleTheme, themeState } from '$lib/theme.svelte';

	const label = $derived(
		themeState.preference === 'dark'
			? 'Dunkel'
			: themeState.preference === 'light'
				? 'Hell'
				: 'System'
	);
</script>

<button
	type="button"
	class="icon-btn"
	onclick={cycleTheme}
	aria-label="Darstellung wechseln, aktuell {label}"
	title="Darstellung: {label}"
>
	{#if themeState.preference === 'dark'}
		<Moon class="size-5 wx-icon-night" />
	{:else if themeState.preference === 'light'}
		<Sun class="size-5 wx-icon-sun" />
	{:else}
		<Monitor class="size-5 wx-icon-cloud" />
	{/if}
</button>
