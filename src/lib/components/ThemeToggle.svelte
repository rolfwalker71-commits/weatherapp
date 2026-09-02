<script lang="ts">
	import { cycleTheme, themeState } from '$lib/theme.svelte';
	import AppIcon from './AppIcon.svelte';

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
		<AppIcon name="themeDark" class="size-5 wx-icon-night" />
	{:else if themeState.preference === 'light'}
		<AppIcon name="themeLight" class="size-5 wx-icon-sun" />
	{:else}
		<AppIcon name="themeSystem" class="size-5 wx-icon-cloud" />
	{/if}
</button>
