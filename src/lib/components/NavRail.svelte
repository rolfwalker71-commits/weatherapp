<script lang="ts">
	import { NAV_ITEMS, type SectionId } from '$lib/nav';
	import { weatherState } from '$lib/weather.svelte';

	function go(id: SectionId) {
		weatherState.section = id;
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
</script>

<nav
	class="sticky top-[4.25rem] hidden h-[calc(100dvh-4.25rem)] w-56 shrink-0 flex-col gap-1 border-r border-border bg-card/80 p-3 lg:flex"
	aria-label="Bereiche"
>
	{#each NAV_ITEMS as item}
		{@const active = weatherState.section === item.id}
		<button
			type="button"
			class="relative flex min-h-12 items-center gap-3 rounded-md px-3 text-left {active
				? 'bg-primary/10 text-primary'
				: 'text-foreground hover:bg-muted'}"
			aria-current={active ? 'page' : undefined}
			onclick={() => go(item.id)}
		>
			{#if active}
				<span class="absolute inset-y-2 left-0 w-0.5 bg-primary" aria-hidden="true"></span>
			{/if}
			<item.icon class="size-4 {item.iconClass}" />
			<span class="leading-snug">{item.railLabel}</span>
		</button>
	{/each}
</nav>
