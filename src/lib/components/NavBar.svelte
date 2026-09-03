<script lang="ts">
	import { NAV_ITEMS, navItemCurrent, type SectionId } from '$lib/nav';
	import { dockBarClass } from '$lib/platform';
	import { goSection } from '$lib/ui.svelte';
	import { weatherState } from '$lib/weather.svelte';
	import AppIcon from './AppIcon.svelte';

	function go(id: SectionId) {
		goSection(id);
	}
</script>

<nav class="wx-dock {dockBarClass()}" aria-label="Bereiche">
	<ul class="grid w-full max-w-full grid-cols-5" style="padding-bottom: env(safe-area-inset-bottom, 0px);">
		{#each NAV_ITEMS as item}
			{@const current = navItemCurrent(item.id, weatherState.section, 'dock')}
			<li class="min-w-0">
				<button
					type="button"
					class="flex min-h-12 w-full min-w-0 flex-col items-center justify-center gap-0.5 px-0.5"
					aria-current={current ? 'page' : undefined}
					onclick={() => go(item.id)}
				>
					<span
						class="flex size-12 items-center justify-center rounded-full {current
							? item.pill
							: 'text-muted-foreground'}"
					>
						<AppIcon name={item.icon} filled={current} class="size-6 {item.iconClass}" />
					</span>
					<span
						class="max-w-full text-center text-xs leading-none {current
							? item.iconClass
							: 'text-muted-foreground'}"
					>
						{item.label}
					</span>
				</button>
			</li>
		{/each}
	</ul>
</nav>
