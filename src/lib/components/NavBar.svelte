<script lang="ts">
	import { NAV_ITEMS, type SectionId } from '$lib/nav';
	import { dockBarClass } from '$lib/platform';
	import { weatherState } from '$lib/weather.svelte';

	function go(id: SectionId) {
		weatherState.section = id;
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
</script>

<nav class="{dockBarClass()} fixed inset-x-0 bottom-0 z-20" aria-label="Bereiche">
	<ul class="grid grid-cols-5" style="padding-bottom: env(safe-area-inset-bottom, 0px);">
		{#each NAV_ITEMS as item}
			{@const active = weatherState.section === item.id}
			<li>
				<button
					type="button"
					class="flex min-h-16 w-full flex-col items-center justify-center gap-1"
					aria-current={active ? 'page' : undefined}
					onclick={() => go(item.id)}
				>
					<span
						class="flex size-10 items-center justify-center rounded-full {active
							? item.pill
							: 'text-muted-foreground'}"
					>
						<item.icon class="size-5 {item.iconClass}" />
					</span>
					<span class="text-xs leading-none {active ? item.iconClass : 'text-muted-foreground'}">
						{item.label}
					</span>
				</button>
			</li>
		{/each}
	</ul>
</nav>
