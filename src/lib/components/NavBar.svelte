<script lang="ts">
	import { NAV_ITEMS, type SectionId } from '$lib/nav';
	import { dockBarClass } from '$lib/platform';
	import { goSection } from '$lib/ui.svelte';
	import { weatherState } from '$lib/weather.svelte';
	import AppIcon from './AppIcon.svelte';

	function go(id: SectionId) {
		goSection(id);
	}
</script>

<nav class="{dockBarClass()} fixed inset-x-0 bottom-0 z-[1050]" aria-label="Bereiche">
	<ul class="grid grid-cols-5" style="padding-bottom: env(safe-area-inset-bottom, 0px);">
		{#each NAV_ITEMS as item}
			{@const current = weatherState.section === item.id}
			<li>
				<button
					type="button"
					class="flex min-h-16 w-full flex-col items-center justify-center gap-1"
					aria-current={current ? 'page' : undefined}
					onclick={() => go(item.id)}
				>
					<span
						class="flex size-10 items-center justify-center rounded-full {current
							? item.pill
							: 'text-muted-foreground'}"
					>
						<AppIcon name={item.icon} filled={current} class="size-6 {item.iconClass}" />
					</span>
					<span class="text-xs leading-none {current ? item.iconClass : 'text-muted-foreground'}">
						{item.label}
					</span>
				</button>
			</li>
		{/each}
	</ul>
</nav>
