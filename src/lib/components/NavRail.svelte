<script lang="ts">
	import { RAIL_ITEMS, navItemCurrent, type SectionId } from '$lib/nav';
	import { goSection } from '$lib/ui.svelte';
	import { weatherState } from '$lib/weather.svelte';
	import AppIcon from './AppIcon.svelte';

	function go(id: SectionId) {
		goSection(id);
	}
</script>

<nav
	class="sticky top-[4.25rem] hidden h-[calc(100dvh-4.25rem)] w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-card/80 p-3 lg:flex"
	aria-label="Bereiche"
>
	{#each RAIL_ITEMS as item}
		{@const current = navItemCurrent(item.id, weatherState.section, 'rail')}
		<button
			type="button"
			class="relative flex min-h-12 items-center gap-3 rounded-md px-3 text-left {current
				? 'bg-primary/10 text-primary'
				: 'text-foreground hover:bg-muted'}"
			aria-current={current ? 'page' : undefined}
			onclick={() => go(item.id)}
		>
			{#if current}
				<span class="absolute inset-y-2 left-0 w-0.5 bg-primary" aria-hidden="true"></span>
			{/if}
			<AppIcon name={item.icon} filled={current} class="size-5 {item.iconClass}" />
			<span class="leading-snug">{item.railLabel}</span>
		</button>
	{/each}
</nav>
